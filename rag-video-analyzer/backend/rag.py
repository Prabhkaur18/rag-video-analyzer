import os
import asyncio
from typing import AsyncIterator
import chromadb
from chromadb.utils import embedding_functions
from openai import AsyncOpenAI
from ingest import get_collection, chunk_and_embed

client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

SYSTEM_PROMPT = """You are an expert social media content analyst specializing in video performance analysis.

You have access to transcripts and metadata from two videos:
- Video A: {video_a_summary}
- Video B: {video_b_summary}

RETRIEVED CONTEXT (from vector search):
{context}

CONVERSATION HISTORY:
{history}

INSTRUCTIONS:
1. Answer based on the retrieved context and metadata provided.
2. Always cite your sources: mention which video (A or B) and approximate chunk position.
3. Be specific with numbers — engagement rates, views, likes, follower counts.
4. If asked to compare, give structured analysis.
5. If data is unavailable (e.g. private API data), say so clearly and explain why.
6. Think like a growth strategist, not just a data reader.

Current question: {question}"""

def build_rag_chain(session_id: str):
    """Returns a callable that does retrieval + LLM generation."""
    return {"session_id": session_id}

def retrieve_context(query: str, session_id: str, n_results: int = 6) -> list[dict]:
    openai_ef = embedding_functions.OpenAIEmbeddingFunction(
        api_key=os.environ["OPENAI_API_KEY"],
        model_name="text-embedding-3-small"
    )
    client_chroma = chromadb.PersistentClient(path="./chroma_store")
    try:
        collection = client_chroma.get_collection(
            name=f"session_{session_id}",
            embedding_function=openai_ef
        )
    except Exception:
        return []

    results = collection.query(
        query_texts=[query],
        n_results=min(n_results, collection.count() or 1),
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

def format_context(chunks: list[dict]) -> str:
    if not chunks:
        return "No relevant transcript chunks found."
    lines = []
    for c in chunks:
        lines.append(f"[Video {c['video_label']} | Chunk {c['chunk_index']} | Relevance: {1-c['distance']:.2f}]\n{c['text']}")
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
    for h in history[-6:]:  # last 3 turns
        lines.append(f"User: {h['user']}\nAssistant: {h['assistant']}")
    return "\n\n".join(lines)

async def ensure_embedded(session_id: str, video_a: dict, video_b: dict):
    """Embed transcripts into ChromaDB if not already done."""
    openai_ef = embedding_functions.OpenAIEmbeddingFunction(
        api_key=os.environ["OPENAI_API_KEY"],
        model_name="text-embedding-3-small"
    )
    client_chroma = chromadb.PersistentClient(path="./chroma_store")
    collection = client_chroma.get_or_create_collection(
        name=f"session_{session_id}",
        embedding_function=openai_ef,
        metadata={"hnsw:space": "cosine"}
    )
    if collection.count() == 0:
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
    # Ensure transcripts are embedded
    await ensure_embedded(session_id, video_a, video_b)

    # Retrieve relevant chunks
    chunks = retrieve_context(message, session_id, n_results=6)

    # Build prompt
    prompt = SYSTEM_PROMPT.format(
        video_a_summary=format_video_summary(video_a, "A"),
        video_b_summary=format_video_summary(video_b, "B"),
        context=format_context(chunks),
        history=format_history(history),
        question=message
    )

    # Stream from OpenAI
    full_response = ""
    async with client.chat.completions.stream(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=1200,
    ) as stream:
        async for text in stream.text_stream:
            full_response += text
            yield {"type": "token", "content": text}

    # Yield sources
    sources = [{"video": c["video_label"], "chunk": c["chunk_index"], "relevance": round(1 - c["distance"], 3), "preview": c["text"][:120]} for c in chunks]
    yield {"type": "sources", "sources": sources}

    # Update history in-place
    history.append({"user": message, "assistant": full_response})
