# RAG Video Analyzer

A full-stack RAG chatbot that ingests two social media videos (YouTube + Instagram Reel), embeds their transcripts into a vector DB, and lets you chat with the data — with streaming responses, source citations, and conversation memory.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React | Fast SPA, CRA for zero-config |
| Backend | FastAPI | Async Python, great SSE support |
| Orchestration | LangChain (chunking + retrieval) | Industry standard, flexible |
| Embeddings | OpenAI `text-embedding-3-small` | Best quality/cost ratio at $0.02/1M tokens |
| Vector DB | ChromaDB (local persistent) | Zero infra, free, production-ready |
| LLM | GPT-4o-mini | ~10× cheaper than GPT-4o, 90%+ quality |
| Transcripts | youtube-transcript-api + yt-dlp | Free, no API key for YT captions |

## Architecture

```
User → React Frontend
         ↓ POST /ingest
      FastAPI Backend
         ↓ fetch transcript + metadata
      youtube-transcript-api / yt-dlp
         ↓ chunk (500 tokens, 80 overlap)
      LangChain RecursiveCharacterTextSplitter
         ↓ embed (text-embedding-3-small)
      ChromaDB (persisted to ./chroma_store)
         ↓ SSE stream /chat
      GPT-4o-mini ← retrieved chunks (top-6 cosine)
         ↓
      Streaming tokens + source citations → Frontend
```

## Engagement Rate Formula

```
ER = (likes + comments) / views × 100
```

## Setup

```bash
# Backend
cd backend
cp .env.example .env
# Add your OPENAI_API_KEY to .env
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm start
```

Open http://localhost:3000

## Scalability at 1000 creators/day

### Cost breakdown (per video pair)
- Embeddings: ~3000 tokens × $0.02/1M = **~$0.00006**
- LLM (5 chat turns × ~1500 tokens): **~$0.003**
- **Total per session: ~$0.003**
- **1000 sessions/day: ~$3/day**

### Scale strategy
1. **ChromaDB → Qdrant Cloud** for multi-node horizontal scaling
2. **Redis** for session memory instead of in-process dict
3. **Celery + Redis** queue for async ingest (yt-dlp is slow)
4. **Whisper on GPU** (RunPod/Modal) for Instagram audio transcription
5. **CDN cache** YouTube embeds, rate-limit per session

## Trade-offs

- ChromaDB is single-node; swap for Qdrant/Pinecone at 10K+ daily sessions
- Instagram metadata is limited without official API (yt-dlp public extraction only)
- YouTube engagement stats require YouTube Data API v3 key (added to .env)

## Commits

- `init`: project scaffold
- `feat: ingest pipeline` — transcript fetch + metadata + engagement rate
- `feat: vector DB` — ChromaDB embed + chunk with LangChain splitter
- `feat: RAG chain` — retrieval + GPT-4o-mini streaming
- `feat: frontend` — React UI with video cards + streaming chat
- `fix: SSE streaming` — proper async generator for token-by-token output
