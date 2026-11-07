import React, { useState } from 'react';
import './URLInput.css';

export default function URLInput({ onSubmit, error, initialYt = '', initialIg = '' }) {
  const [yt, setYt] = useState(initialYt);
  const [ig, setIg] = useState(initialIg);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!yt.trim() || !ig.trim()) return;
    setSubmitting(true);
    await onSubmit(yt.trim(), ig.trim());
    setSubmitting(false);
  };

  return (
    <div className="url-input-page">
      <div className="url-hero">
        <div className="hero-pill">RAG-powered · Free · Open source</div>
        <h1 className="hero-title">Compare any two videos.<br /><span>Ask anything about them.</span></h1>
        <p className="hero-sub">
          Drop a YouTube and Instagram Reel URL. We fetch transcripts, compute engagement
          metrics, embed everything into a vector DB, and let you chat with the data in real time.
        </p>
      </div>

      <form className="url-form" onSubmit={handleSubmit}>
        <div className="url-field">
          <label className="url-label">
            <span className="label-badge label-a">A</span>
            YouTube URL
          </label>
          <input
            className="url-input"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={yt}
            onChange={e => setYt(e.target.value)}
            required
          />
        </div>

        <div className="url-vs">
          <div className="vs-line" />
          <span className="vs-text">VS</span>
          <div className="vs-line" />
        </div>

        <div className="url-field">
          <label className="url-label">
            <span className="label-badge label-b">B</span>
            Instagram Reel URL
          </label>
          <input
            className="url-input"
            type="url"
            placeholder="https://www.instagram.com/reel/..."
            value={ig}
            onChange={e => setIg(e.target.value)}
            required
          />
        </div>

        {error && <div className="url-error">⚠ {error}</div>}

        <button className="submit-btn" type="submit" disabled={submitting || !yt || !ig}>
          {submitting ? (
            <span className="btn-loading"><span className="btn-spinner" /> Analyzing...</span>
          ) : (
            'Analyze videos →'
          )}
        </button>
      </form>

      <div className="feature-grid">
        {[
          { icon: '⬡', label: 'Transcript RAG', desc: 'Chunked & embedded in ChromaDB with cosine similarity search' },
          { icon: '⟳', label: 'Streaming chat', desc: 'Token-by-token responses via Groq + Llama 3' },
          { icon: '◈', label: 'Source citations', desc: 'Every answer cites the exact video and chunk' },
          { icon: '◎', label: 'Conversation memory', desc: 'Full chat history kept in context across turns' },
        ].map(f => (
          <div key={f.label} className="feature-card">
            <span className="feature-icon">{f.icon}</span>
            <span className="feature-label">{f.label}</span>
            <span className="feature-desc">{f.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
