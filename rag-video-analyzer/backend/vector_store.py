"""
vector_store.py
---------------
Chunks transcripts, embeds them via OpenAI, stores in ChromaDB.
Each chunk is tagged with video_id so retrieval can filter by source.
"""

import os
from typing import List

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document

from ingestion import VideoData

CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "500"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "50"))
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
COLLECTION_NAME = "video_transcripts"


def _build_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(model=EMBEDDING_MODEL)


def get_vectorstore() -> Chroma:
    """Return (or load) the persistent Chroma collection."""
    return Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=_build_embeddings(),
        persist_directory=CHROMA_PERSIST_DIR,
    )


def ingest_video(video: VideoData) -> int:
    """
    Chunk + embed a VideoData transcript and upsert into ChromaDB.
    Returns the number of chunks stored.
    Also injects a synthetic 'metadata chunk' so RAG can answer
    factual questions (views, likes, follower count, etc.) directly.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    transcript_chunks = splitter.split_text(video.transcript)

    # Build LangChain Documents with rich metadata
    docs: List[Document] = []

    # 1. Transcript chunks
    for i, chunk in enumerate(transcript_chunks):
        docs.append(Document(
            page_content=chunk,
            metadata={
                "video_id": video.video_id,
                "platform": video.platform,
                "creator": video.creator,
                "title": video.title,
                "chunk_index": i,
                "source_type": "transcript",
                "url": video.url,
            }
        ))

    # 2. Metadata chunk — a single document summarising all stats
    metadata_text = f"""
Video {video.video_id} Metadata Summary:
Title: {video.title}
Platform: {video.platform}
Creator / Channel: {video.creator}
Follower Count: {video.follower_count:,}
Views: {video.views:,}
Likes: {video.likes:,}
Comments: {video.comments:,}
Engagement Rate: {video.engagement_rate:.4f}%
Duration: {video.duration} seconds
Upload Date: {video.upload_date}
Hashtags: {', '.join(video.hashtags) if video.hashtags else 'None'}
URL: {video.url}
""".strip()

    docs.append(Document(
        page_content=metadata_text,
        metadata={
            "video_id": video.video_id,
            "platform": video.platform,
            "creator": video.creator,
            "title": video.title,
            "chunk_index": -1,
            "source_type": "metadata",
            "url": video.url,
        }
    ))

    # Delete old chunks for this video_id before re-ingesting
    vectorstore = get_vectorstore()
    try:
        existing = vectorstore.get(where={"video_id": video.video_id})
        if existing["ids"]:
            vectorstore.delete(ids=existing["ids"])
    except Exception:
        pass

    vectorstore.add_documents(docs)
    return len(docs)


def clear_all() -> None:
    """Wipe the entire collection (useful for fresh demo runs)."""
    vs = get_vectorstore()
    try:
        existing = vs.get()
        if existing["ids"]:
            vs.delete(ids=existing["ids"])
    except Exception:
        pass
