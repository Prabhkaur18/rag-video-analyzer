"""
rag_chain.py
------------
LangChain RAG pipeline:
  - Retrieves top-k chunks from ChromaDB (filtered or global)
  - Streams responses token by token
  - Maintains per-session conversation memory
  - Returns source citations with every answer
"""

import os
from typing import AsyncGenerator, Optional
from collections import defaultdict

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.documents import Document as LCDocument

from vector_store import get_vectorstore

LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

# Per-session conversation histories  { session_id: [messages] }
_session_histories: dict[str, list] = defaultdict(list)

SYSTEM_PROMPT = """You are a social media analytics expert helping creators understand their video performance.

You have access to transcripts and metadata for two videos (Video A and Video B).
Always cite which video and chunk you're drawing from using the format [Video X | chunk N] or [Video X | metadata].

When comparing videos:
- Be specific about numbers (engagement rates, views, likes, etc.)
- Quote or paraphrase transcript snippets when relevant
- Give actionable, data-driven recommendations
- If data is missing or unavailable, say so clearly

Context from the knowledge base:
{context}

Previous conversation:
{chat_history}
"""

PROMPT = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human", "{question}"),
])


def _format_docs(docs) -> str:
    """Format retrieved documents into a readable context block."""
    parts = []
    for doc in docs:
        meta = doc.metadata
        vid = meta.get("video_id", "?")
        src_type = meta.get("source_type", "transcript")
        chunk_idx = meta.get("chunk_index", 0)
        creator = meta.get("creator", "")
        title = meta.get("title", "")

        if src_type == "metadata":
            label = f"[Video {vid} | metadata | {title} by {creator}]"
        else:
            label = f"[Video {vid} | chunk {chunk_idx} | {title}]"

        parts.append(f"{label}\n{doc.page_content}")
    return "\n\n---\n\n".join(parts)


def _format_history(messages: list) -> str:
    lines = []
    for msg in messages[-10:]:  # keep last 10 turns
        role = "Human" if isinstance(msg, HumanMessage) else "Assistant"
        lines.append(f"{role}: {msg.content}")
    return "\n".join(lines)


def _build_sources(docs) -> list[dict]:
    """Build source citation list to return alongside the answer."""
    sources = []
    seen = set()
    for doc in docs:
        meta = doc.metadata
        vid = meta.get("video_id", "?")
        src_type = meta.get("source_type", "transcript")
        chunk_idx = meta.get("chunk_index", 0)
        key = (vid, chunk_idx)
        if key in seen:
            continue
        seen.add(key)
        sources.append({
            "video_id": vid,
            "source_type": src_type,
            "chunk_index": chunk_idx,
            "title": meta.get("title", ""),
            "creator": meta.get("creator", ""),
            "platform": meta.get("platform", ""),
            "snippet": doc.page_content[:200] + ("…" if len(doc.page_content) > 200 else ""),
        })
    return sources


async def stream_answer(
    question: str,
    session_id: str,
    top_k: int = 6,
) -> AsyncGenerator[dict, None]:
    """
    Async generator that yields dicts:
      {"type": "token", "content": "..."}          — streaming LLM token
      {"type": "sources", "content": [...]}         — source citations (sent first)
      {"type": "done"}                              — stream complete
    """
    vectorstore = get_vectorstore()
    retriever = vectorstore.as_retriever(
        search_type="similarity",
        search_kwargs={"k": top_k},
    )

    # Retrieve relevant docs
    docs = retriever.invoke(question)

    # Always also pull the metadata chunk for both videos
    try:
        meta_docs = vectorstore.get(where={"source_type": "metadata"})
        for i, doc_id in enumerate(meta_docs["ids"]):
            existing_ids = [d.metadata.get("chunk_index") for d in docs]
            if meta_docs["metadatas"][i].get("video_id") not in [d.metadata.get("video_id") for d in docs if d.metadata.get("source_type") == "metadata"]:
                docs.append(LCDocument(
                    page_content=meta_docs["documents"][i],
                    metadata=meta_docs["metadatas"][i],
                ))
    except Exception:
        pass

    context = _format_docs(docs)
    history = _session_histories[session_id]
    chat_history_str = _format_history(history)

    # Emit sources first so frontend can render them immediately
    yield {"type": "sources", "content": _build_sources(docs)}

    # Stream LLM response
    llm = ChatOpenAI(
        model=LLM_MODEL,
        temperature=0.3,
        streaming=True,
    )

    full_response = ""
    messages = PROMPT.format_messages(
        context=context,
        chat_history=chat_history_str,
        question=question,
    )

    async for chunk in llm.astream(messages):
        token = chunk.content
        if token:
            full_response += token
            yield {"type": "token", "content": token}

    # Save to memory
    _session_histories[session_id].append(HumanMessage(content=question))
    _session_histories[session_id].append(AIMessage(content=full_response))

    yield {"type": "done"}


def clear_session(session_id: str) -> None:
    """Reset conversation memory for a session."""
    _session_histories.pop(session_id, None)
