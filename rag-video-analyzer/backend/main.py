import os
import json
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

from ingest import ingest_video
from rag import build_rag_chain, chat_with_memory

load_dotenv()

app = FastAPI(title="RAG Video Analyzer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions: dict = {}

class IngestRequest(BaseModel):
    youtube_url: str
    instagram_url: str
    session_id: str

class ChatRequest(BaseModel):
    session_id: str
    message: str

@app.post("/ingest")
async def ingest(req: IngestRequest):
    try:
        video_a = await ingest_video(req.youtube_url, video_id="A", platform="youtube")
        video_b = await ingest_video(req.instagram_url, video_id="B", platform="instagram")
        sessions[req.session_id] = {
            "video_a": video_a,
            "video_b": video_b,
            "history": [],
            "chain": build_rag_chain(req.session_id)
        }
        return {"status": "ok", "video_a": video_a, "video_b": video_b}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(req: ChatRequest):
    if req.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found. Please ingest videos first.")
    session = sessions[req.session_id]

    async def event_stream():
        async for chunk in chat_with_memory(
            chain=session["chain"],
            message=req.message,
            history=session["history"],
            video_a=session["video_a"],
            video_b=session["video_b"],
            session_id=req.session_id
        ):
            yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.get("/session/{session_id}")
async def get_session(session_id: str):
    if session_id not in sessions:
        return {"exists": False}
    s = sessions[session_id]
    return {"exists": True, "video_a": s["video_a"], "video_b": s["video_b"], "history_length": len(s["history"])}

@app.delete("/session/{session_id}")
async def reset_session(session_id: str):
    if session_id in sessions:
        del sessions[session_id]
    return {"status": "reset"}
