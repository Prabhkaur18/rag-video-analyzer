import os
import asyncio
from typing import AsyncIterator
import chromadb
from chromadb.utils import embedding_functions
from groq import AsyncGroq

groq_client = AsyncGroq(api_key=os.environ.get("GROQ_API_KEY", ""))

SYSTEM_PROMPT = """You are an expert social media content analyst.

You have metadata and transcript chunks from two videos:
- Video A: {video_a_summary}
- Video B: {video_b_summary}

RETRIEVED TRANSCRIPT CHUNKS:
{context}

CONVERSATION HISTORY:
{history}

Instructions:
- Answer based on the context and metadata above.
- Always cite which video (A or B) your answer comes from.
- Be specific with numbers — engagement rates, views, likes.
- If data is unavailable, say so clearly.
- Think like a growth strategist.

Question: {question}"""

def build_rag_chain(session_id: str):
    return {"session_id": session_id}

def get_collection(session_id: str):
    client = chromadb.PersistentClient(path="./chroma_store")
    ef = embedding_functions.DefaultEmbeddingFunction()
    return client.get_or_create_collection(
        name=f"session_{session_id}",
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"}
    )

def retrieve_context(query: str, session_id: str, n_results: int = 6) -> list[dict]:
    try:
        collection = get_collection(session_id)
        count = collection.count()
        if count == 0:
            return []
        results = collection.query(
            query_texts=[query],
            n_results=min(n_results, count),
            include=["documents", "metadatas", "distances"]
        )
        chunks = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0]
        ):
            chunks.append({
                "text": doc,
                "video_label": meta.get("video_label", "?"),
                "chunk_index": meta.get("chunk_index", 0),
                "distance": round(dist, 4),
                "metadata": meta
            })
        return chunks
    except Exception as e:
        print(f"Retrieval error: {e}")
        return []

def format_context(chunks: list[dict]) -> str:
    if not chunks:
        return "No transcript chunks found."
    lines = []
    for c in chunks:
        relevance = round(1 - c['distance'], 2)
        lines.append(f"[Video {c['video_label']} | Chunk {c['chunk_index']} | Relevance: {relevance}]\n{c['text']}")
    return "\n\n---\n\n".join(lines)

def format_video_summary(meta: dict, label: str) -> str:
    return (
        f"Video {label} ({meta.get('platform','?').upper()}) - '{meta.get('title','N/A')}' "
        f"by {meta.get('creator','N/A')} | "
        f"Views: {meta.get('views',0):,} | Likes: {meta.get('likes',0):,} | "
        f"Comments: {meta.get('comments',0):,} | "
        f"Engagement Rate: {meta.get('engagement_rate',0):.4f}% | "
        f"Duration: {meta.get('duration',0)}s | "
        f"Followers: {meta.get('follower_count','N/A')} | "
        f"Hashtags: {', '.join(meta.get('hashtags',[])[:5]) or 'N/A'} | "
        f"Upload date: {meta.get('upload_date','N/A')}"
    )

def format_history(history: list[dict]) -> str:
    if not history:
        return "No prior conversation."
    lines = []
    for h in history[-6:]:
        lines.append(f"User: {h['user']}\nAssistant: {h['assistant']}")
    return "\n\n".join(lines)

async def ensure_embedded(session_id: str, video_a: dict, video_b: dict):
    collection = get_collection(session_id)
    if collection.count() == 0:
        from ingest import chunk_and_embed
        chunk_and_embed(video_a.get("_transcript_for_embed", ""), video_a, "A", collection)
        chunk_and_embed(video_b.get("_transcript_for_embed", ""), video_b, "B", collection)

async def chat_with_memory(
    chain: dict,
    message: str,
    history: list,
    video_a: dict,
    video_b: dict,
    session_id: str
) -> AsyncIterator[dict]:
    await ensure_embedded(session_id, video_a, video_b)

    chunks = retrieve_context(message, session_id, n_results=6)

    prompt = SYSTEM_PROMPT.format(
        video_a_summary=format_video_summary(video_a, "A"),
        video_b_summary=format_video_summary(video_b, "B"),
        context=format_context(chunks),
        history=format_history(history),
        question=message
    )

    full_response = ""
    stream = await groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=1200,
        stream=True,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta.content or ""
        if delta:
            full_response += delta
            yield {"type": "token", "content": delta}

    sources = [
        {
            "video": c["video_label"],
            "chunk": c["chunk_index"],
            "relevance": round(1 - c["distance"], 3),
            "preview": c["text"][:120]
        }
        for c in chunks
    ]
    yield {"type": "sources", "sources": sources}

    history.append({"user": message, "assistant": full_response})
