import React, { useState, useRef, useEffect } from 'react';
import './ChatPanel.css';

const SUGGESTED = [
  'Why did Video A get more engagement than Video B?',
  'What is the engagement rate of each video?',
  'Compare the hooks in the first 5 seconds.',
  'Who is the creator of Video B and what is their follower count?',
  'Suggest improvements for B based on what worked in A.',
];

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`message message--${isUser ? 'user' : 'assistant'}`}>
      <div className="message-role">{isUser ? '[YOU]' : '[AI]'}</div>
      <div className="message-body">
        <div className="message-text">{msg.content}</div>
        {!isUser && msg.sources && msg.sources.length > 0 && (
          <div className="message-sources">
            <div className="sources-label">// sources</div>
            {msg.sources.map((s, i) => (
              <div key={i} className="source-chip">
                <span className="source-video">Video {s.video}</span>
                <span className="source-chunk">chunk #{s.chunk}</span>
                <span className="source-rel">{(s.relevance * 100).toFixed(0)}%</span>
                <span className="source-preview">{s.preview}...</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPanel({ sessionId, videoA, videoB }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    if (!text.trim() || streaming) return;
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);

    const assistantMsg = { role: 'assistant', content: '', sources: [] };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const res = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: text })
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const chunk = JSON.parse(raw);
            if (chunk.type === 'token') {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + chunk.content
                };
                return updated;
              });
            } else if (chunk.type === 'sources') {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  sources: chunk.sources
                };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (e) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: `Error: ${e.message}` };
        return updated;
      });
    }
    setStreaming(false);
    inputRef.current?.focus();
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="chat-title">// RAG CHAT</span>
        <span className="chat-meta">memory enabled · streaming · source citations</span>
      </div>

      {messages.length === 0 && (
        <div className="chat-suggestions">
          <div className="suggestions-label">Try asking:</div>
          <div className="suggestions-grid">
            {SUGGESTED.map((s, i) => (
              <button key={i} className="suggestion-btn" onClick={() => sendMessage(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="chat-messages">
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        {streaming && messages[messages.length - 1]?.role === 'assistant' &&
          messages[messages.length - 1]?.content === '' && (
          <div className="thinking">
            <span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <input
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          placeholder="Ask anything about these two videos..."
          disabled={streaming}
        />
        <button
          className="send-btn"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || streaming}
        >
          {streaming ? '◌' : '→'}
        </button>
      </div>
    </div>
  );
}
