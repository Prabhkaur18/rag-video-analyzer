import os
import re
import asyncio
import httpx
from typing import Optional
from youtube_transcript_api import YouTubeTranscriptApi
import chromadb
from chromadb.utils import embedding_functions
from langchain.text_splitter import RecursiveCharacterTextSplitter

CHROMA_PATH = "./chroma_store"

def get_chroma_client():
    return chromadb.PersistentClient(path=CHROMA_PATH)

def get_collection(session_id: str):
    client = get_chroma_client()
    openai_ef = embedding_functions.OpenAIEmbeddingFunction(
        api_key=os.environ["OPENAI_API_KEY"],
        model_name="text-embedding-3-small"
    )
    return client.get_or_create_collection(
        name=f"session_{session_id}",
        embedding_function=openai_ef,
        metadata={"hnsw:space": "cosine"}
    )

def extract_youtube_id(url: str) -> str:
    patterns = [
        r"(?:v=|\/)([0-9A-Za-z_-]{11})",
        r"youtu\.be\/([0-9A-Za-z_-]{11})"
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    raise ValueError(f"Could not extract YouTube ID from: {url}")

async def fetch_youtube_metadata(video_id: str) -> dict:
    """Fetch YouTube metadata via oembed (no API key needed) + transcript."""
    oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            r = await client.get(oembed_url)
            data = r.json()
            title = data.get("title", "Unknown Title")
            author = data.get("author_name", "Unknown Creator")
        except Exception:
            title = "Unknown Title"
            author = "Unknown Creator"

    # Get transcript
    try:
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        transcript = " ".join([t["text"] for t in transcript_list])
        duration = int(transcript_list[-1]["start"] + transcript_list[-1].get("duration", 0)) if transcript_list else 0
    except Exception as e:
        transcript = f"[Transcript unavailable: {str(e)}]"
        duration = 0

    return {
        "platform": "youtube",
        "video_id_internal": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "title": title,
        "creator": author,
        "follower_count": "N/A (YouTube oembed)",
        "views": 0,
        "likes": 0,
        "comments": 0,
        "engagement_rate": 0.0,
        "hashtags": [],
        "upload_date": "N/A",
        "duration": duration,
        "transcript": transcript,
        "note": "Metadata limited: YouTube Data API v3 key required for full stats"
    }

async def fetch_instagram_metadata(url: str) -> dict:
    """Fetch Instagram reel metadata via public endpoints."""
    shortcode = None
    m = re.search(r"(?:reel|p)\/([A-Za-z0-9_-]+)", url)
    if m:
        shortcode = m.group(1)

    meta = {
        "platform": "instagram",
        "shortcode": shortcode or "unknown",
        "url": url,
        "title": f"Instagram Reel ({shortcode or 'unknown'})",
        "creator": "N/A",
        "follower_count": "N/A",
        "views": 0,
        "likes": 0,
        "comments": 0,
        "engagement_rate": 0.0,
        "hashtags": [],
        "upload_date": "N/A",
        "duration": 0,
        "transcript": "[Instagram transcript: Audio download + Whisper transcription required in production. yt-dlp can extract audio from Reels for Whisper processing.]",
        "note": "Instagram API requires app review. yt-dlp + Whisper handles transcripts at scale."
    }

    # Try to get some public data via yt-dlp info extraction
    try:
        import subprocess, json as _json
        result = subprocess.run(
            ["yt-dlp", "--dump-json", "--no-download", url],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0 and result.stdout.strip():
            info = _json.loads(result.stdout.strip().split('\n')[0])
            meta["title"] = info.get("title", meta["title"])
            meta["creator"] = info.get("uploader", info.get("channel", "N/A"))
            meta["views"] = info.get("view_count") or 0
            meta["likes"] = info.get("like_count") or 0
            meta["comments"] = info.get("comment_count") or 0
            meta["duration"] = info.get("duration") or 0
            meta["upload_date"] = info.get("upload_date", "N/A")
            tags = info.get("tags", [])
            meta["hashtags"] = [f"#{t}" for t in tags[:10]]
            desc = info.get("description", "")
            meta["hashtags"] += re.findall(r"#\w+", desc)[:10]
            meta["hashtags"] = list(set(meta["hashtags"]))[:10]
            if meta["views"] > 0 and (meta["likes"] + meta["comments"]) > 0:
                meta["engagement_rate"] = round((meta["likes"] + meta["comments"]) / meta["views"] * 100, 4)
            # Try subtitle/caption extraction
            desc_text = info.get("description", "")
            if desc_text:
                meta["transcript"] = f"[Description/Caption]: {desc_text}"
    except Exception as e:
        meta["note"] += f" | yt-dlp error: {str(e)}"

    return meta

def compute_engagement(meta: dict) -> dict:
    views = meta.get("views", 0) or 0
    likes = meta.get("likes", 0) or 0
    comments = meta.get("comments", 0) or 0
    if views > 0:
        meta["engagement_rate"] = round((likes + comments) / views * 100, 4)
    else:
        meta["engagement_rate"] = 0.0
    return meta

def chunk_and_embed(transcript: str, metadata: dict, video_label: str, collection):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=80,
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    chunks = splitter.split_text(transcript)
    if not chunks:
        chunks = [transcript or "[No transcript available]"]

    ids = [f"{video_label}_chunk_{i}" for i in range(len(chunks))]
    metas = [{
        "video_label": video_label,
        "platform": metadata.get("platform", "unknown"),
        "creator": str(metadata.get("creator", "N/A")),
        "chunk_index": i,
        "total_chunks": len(chunks),
        "engagement_rate": str(metadata.get("engagement_rate", 0)),
        "views": str(metadata.get("views", 0)),
        "likes": str(metadata.get("likes", 0)),
        "comments": str(metadata.get("comments", 0)),
    } for i in range(len(chunks))]

    # Upsert in batches of 50
    batch_size = 50
    for i in range(0, len(chunks), batch_size):
        collection.upsert(
            documents=chunks[i:i+batch_size],
            ids=ids[i:i+batch_size],
            metadatas=metas[i:i+batch_size]
        )
    return len(chunks)

async def ingest_video(url: str, video_id: str, platform: str, session_id: str = None) -> dict:
    if platform == "youtube":
        yt_id = extract_youtube_id(url)
        meta = await fetch_youtube_metadata(yt_id)
    else:
        meta = await fetch_instagram_metadata(url)

    meta = compute_engagement(meta)
    meta["label"] = video_id

    # We defer embedding to the session-level call
    meta["_transcript_for_embed"] = meta.get("transcript", "")
    return meta
