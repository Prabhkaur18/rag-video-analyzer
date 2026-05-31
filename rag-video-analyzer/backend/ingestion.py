"""
ingestion.py
------------
Handles transcript + metadata extraction for YouTube and Instagram Reels.
Returns a unified VideoData object regardless of source platform.
"""

import re
import os
import json
import httpx
import asyncio
from typing import Optional
from dataclasses import dataclass, field
from urllib.parse import urlparse, parse_qs

from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled
import yt_dlp


@dataclass
class VideoData:
    video_id: str          # "A" or "B"
    platform: str          # "youtube" | "instagram"
    url: str
    title: str
    creator: str
    follower_count: int
    views: int
    likes: int
    comments: int
    duration: int          # seconds
    upload_date: str
    hashtags: list[str]
    transcript: str
    thumbnail: str
    engagement_rate: float = field(init=False)

    def __post_init__(self):
        if self.views > 0:
            self.engagement_rate = round((self.likes + self.comments) / self.views * 100, 4)
        else:
            self.engagement_rate = 0.0

    def to_dict(self) -> dict:
        return {
            "video_id": self.video_id,
            "platform": self.platform,
            "url": self.url,
            "title": self.title,
            "creator": self.creator,
            "follower_count": self.follower_count,
            "views": self.views,
            "likes": self.likes,
            "comments": self.comments,
            "duration": self.duration,
            "upload_date": self.upload_date,
            "hashtags": self.hashtags,
            "transcript": self.transcript,
            "thumbnail": self.thumbnail,
            "engagement_rate": self.engagement_rate,
        }


# ──────────────────────────────────────────────
# YouTube
# ──────────────────────────────────────────────

def _extract_yt_id(url: str) -> str:
    """Extract YouTube video ID from any YT URL format."""
    patterns = [
        r"(?:v=|youtu\.be/|/embed/|/shorts/)([A-Za-z0-9_-]{11})",
    ]
    for pat in patterns:
        m = re.search(pat, url)
        if m:
            return m.group(1)
    raise ValueError(f"Cannot extract YouTube ID from: {url}")


def _yt_transcript(yt_id: str) -> str:
    """Fetch transcript via youtube-transcript-api; fall back to yt-dlp auto-captions."""
    try:
        segments = YouTubeTranscriptApi.get_transcript(yt_id)
        return " ".join(s["text"] for s in segments)
    except (NoTranscriptFound, TranscriptsDisabled):
        pass

    # yt-dlp fallback — tries auto-generated subtitles
    ydl_opts = {
        "writeautomaticsub": True,
        "subtitlesformat": "vtt",
        "skip_download": True,
        "quiet": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={yt_id}", download=False)
        subs = info.get("automatic_captions", {})
        for lang in ("en", "en-US"):
            if lang in subs:
                # grab the first available URL for plain text
                for fmt in subs[lang]:
                    if fmt.get("ext") == "vtt":
                        import urllib.request
                        with urllib.request.urlopen(fmt["url"]) as r:
                            raw = r.read().decode("utf-8")
                        # strip VTT markup
                        lines = [l for l in raw.splitlines()
                                 if l and not l.startswith("WEBVTT")
                                 and not re.match(r"\d{2}:\d{2}", l)
                                 and not re.match(r"\d+$", l)
                                 and "<" not in l]
                        return " ".join(lines)
    return "[Transcript unavailable]"


def fetch_youtube(url: str, video_id: str) -> VideoData:
    yt_id = _extract_yt_id(url)

    ydl_opts = {"quiet": True, "skip_download": True}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={yt_id}", download=False)

    title = info.get("title", "Unknown Title")
    creator = info.get("uploader", info.get("channel", "Unknown"))
    views = int(info.get("view_count") or 0)
    likes = int(info.get("like_count") or 0)
    comments = int(info.get("comment_count") or 0)
    duration = int(info.get("duration") or 0)
    upload_date_raw = info.get("upload_date", "")
    upload_date = (
        f"{upload_date_raw[:4]}-{upload_date_raw[4:6]}-{upload_date_raw[6:]}"
        if len(upload_date_raw) == 8 else upload_date_raw
    )
    hashtags = info.get("tags", []) or []
    thumbnail = info.get("thumbnail", "")
    follower_count = int(info.get("channel_follower_count") or 0)

    transcript = _yt_transcript(yt_id)

    return VideoData(
        video_id=video_id,
        platform="youtube",
        url=url,
        title=title,
        creator=creator,
        follower_count=follower_count,
        views=views,
        likes=likes,
        comments=comments,
        duration=duration,
        upload_date=upload_date,
        hashtags=hashtags[:10],
        transcript=transcript,
        thumbnail=thumbnail,
    )


# ──────────────────────────────────────────────
# Instagram
# ──────────────────────────────────────────────

def _ig_transcript_via_ydlp(url: str) -> str:
    """
    Instagram has no native transcript API.
    We try yt-dlp auto-subs; if none exist we return a placeholder
    (Whisper integration would be the production path — see README).
    """
    ydl_opts = {
        "writeautomaticsub": True,
        "subtitlesformat": "vtt",
        "skip_download": True,
        "quiet": True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            subs = info.get("automatic_captions", {}) or {}
            for lang in ("en", "en-US"):
                if lang in subs:
                    for fmt in subs[lang]:
                        if fmt.get("ext") == "vtt":
                            import urllib.request
                            with urllib.request.urlopen(fmt["url"]) as r:
                                raw = r.read().decode("utf-8")
                            lines = [l for l in raw.splitlines()
                                     if l and not l.startswith("WEBVTT")
                                     and not re.match(r"\d{2}:\d{2}", l)
                                     and not re.match(r"\d+$", l)
                                     and "<" not in l]
                            return " ".join(lines)
    except Exception:
        pass
    return "[Instagram transcript unavailable — upload audio to Whisper for production use]"


def fetch_instagram(url: str, video_id: str) -> VideoData:
    ydl_opts = {"quiet": True, "skip_download": True}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as e:
        raise RuntimeError(f"yt-dlp failed for Instagram URL: {e}")

    title = info.get("title", info.get("description", "Instagram Reel")[:80])
    creator = info.get("uploader", info.get("channel", "Unknown"))
    views = int(info.get("view_count") or 0)
    likes = int(info.get("like_count") or 0)
    comments = int(info.get("comment_count") or 0)
    duration = int(info.get("duration") or 0)
    upload_date_raw = info.get("upload_date", "")
    upload_date = (
        f"{upload_date_raw[:4]}-{upload_date_raw[4:6]}-{upload_date_raw[6:]}"
        if len(upload_date_raw) == 8 else upload_date_raw
    )
    # Instagram tags come from description hashtags
    desc = info.get("description", "") or ""
    hashtags = re.findall(r"#\w+", desc)[:10]
    thumbnail = info.get("thumbnail", "")
    follower_count = int(info.get("channel_follower_count") or 0)

    transcript = _ig_transcript_via_ydlp(url)

    return VideoData(
        video_id=video_id,
        platform="instagram",
        url=url,
        title=title,
        creator=creator,
        follower_count=follower_count,
        views=views,
        likes=likes,
        comments=comments,
        duration=duration,
        upload_date=upload_date,
        hashtags=hashtags,
        transcript=transcript,
        thumbnail=thumbnail,
    )


# ──────────────────────────────────────────────
# Unified entry point
# ──────────────────────────────────────────────

def fetch_video(url: str, video_id: str) -> VideoData:
    """Route to the correct platform fetcher based on URL."""
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if "youtube" in host or "youtu.be" in host:
        return fetch_youtube(url, video_id)
    elif "instagram" in host:
        return fetch_instagram(url, video_id)
    else:
        raise ValueError(f"Unsupported platform for URL: {url}")
