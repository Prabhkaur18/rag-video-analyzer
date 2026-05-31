import React, { useState } from 'react';
import './URLInput.css';

const SAMPLE_YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const SAMPLE_IG = 'https://www.instagram.com/reel/C_example123/';

export default function URLInput({ onSubmit, error }) {
  const [yt, setYt] = useState('');
  const [ig, setIg] = useState('');
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
      <div className="url-input-hero">
        <div className="hero-tag">// RAG-POWERED VIDEO ANALYTICS</div>
        <h1 className="hero-title">
          Compare Any Two<br />
          <span className="hero-accent">Social Videos</span>
        </h1>
        <p className="hero-sub">
          Paste a YouTube and Instagram Reel URL. We'll pull transcripts,
          compute engagement, embed everything into a vector DB, and let you
          ask anything.
        </p>
      </div>

      <form className="url-form" onSubmit={handleSubmit}>
        <div className="url-field">
          <label className="url-label">
            <span className="label-tag">[A]</span>
            <span className="label-platform">YouTube URL</span>
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

        <div className="url-connector">
          <div className="connector-line" />
          <span className="connector-vs">VS</span>
          <div className="connector-line" />
        </div>

        <div className="url-field">
          <label className="url-label">
            <span className="label-tag">[B]</span>
            <span className="label-platform">Instagram Reel URL</span>
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
            <span>Processing<span className="dots">...</span></span>
          ) : (
            <span>Analyze Videos →</span>
          )}
        </button>
      </form>

      <div className="feature-grid">
        {[
          { icon: '◈', label: 'Transcript RAG', desc: 'Chunked & embedded in ChromaDB' },
          { icon: '◉', label: 'Streaming Chat', desc: 'Token-by-token streamed responses' },
          { icon: '◎', label: 'Source Citations', desc: 'Every answer cites video + chunk' },
          { icon: '◐', label: 'Memory', desc: 'Full conversation context retained' },
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
