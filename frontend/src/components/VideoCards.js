import React, { useState } from 'react';
import './VideoCards.css';

function StatPill({ label, value, highlight }) {
  return (
    <div className={`stat-pill ${highlight ? 'stat-pill--highlight' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function VideoCard({ meta, label }) {
  const views = Number(meta?.views || 0);
  const likes = Number(meta?.likes || 0);
  const comments = Number(meta?.comments || 0);
  const er = Number(meta?.engagement_rate || 0);
  const duration = Number(meta?.duration || 0);

  const fmt = (n) => n >= 1000000
    ? (n / 1000000).toFixed(1) + 'M'
    : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n);

  const fmtDur = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="video-card">
      <div className="card-header">
        <div className={`card-label ${label === "B" ? "card-label-b" : ""}`}>{label}</div>
        <div className="card-platform">{meta?.platform?.toUpperCase() || '?'}</div>
      </div>

      <div className="card-embed">
        {meta?.platform === 'youtube' && meta?.video_id_internal ? (
          <iframe
            src={`https://www.youtube.com/embed/${meta.video_id_internal}`}
            title={`Video ${label}`}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="card-embed-placeholder">
            <a href={meta?.url} target="_blank" rel="noreferrer" className="embed-link">
              View on {meta?.platform || 'platform'} ↗
            </a>
          </div>
        )}
      </div>

      <div className="card-title">{meta?.title || 'Untitled'}</div>
      <div className="card-creator">by {meta?.creator || 'Unknown'}</div>

      <div className="card-stats">
        <StatPill label="Views" value={fmt(views)} />
        <StatPill label="Likes" value={fmt(likes)} />
        <StatPill label="Comments" value={fmt(comments)} />
        <StatPill label="ER%" value={er > 0 ? er.toFixed(3) + '%' : 'N/A'} highlight={er > 0} />
        <StatPill label="Duration" value={duration > 0 ? fmtDur(duration) : 'N/A'} />
        <StatPill label="Followers" value={meta?.follower_count || 'N/A'} />
      </div>

      {meta?.hashtags?.length > 0 && (
        <div className="card-hashtags">
          {meta.hashtags.slice(0, 6).map(h => (
            <span key={h} className="hashtag">{h.startsWith('#') ? h : `#${h}`}</span>
          ))}
        </div>
      )}

      {meta?.note && <div className="card-note">{meta.note}</div>}
    </div>
  );
}

export default function VideoCards({ videoA, videoB, urls, onReload }) {
  const [editing, setEditing] = useState(false);
  const [newYt, setNewYt] = useState(urls?.yt || '');
  const [newIg, setNewIg] = useState(urls?.ig || '');
  const [loading, setLoading] = useState(false);

  const handleReload = async () => {
    if (!newYt.trim() || !newIg.trim()) return;
    setLoading(true);
    await onReload(newYt.trim(), newIg.trim());
    setEditing(false);
    setLoading(false);
  };

  return (
    <div className="video-cards-wrapper">
      <div className="video-cards">
        <VideoCard meta={videoA} label="A" />
        <VideoCard meta={videoB} label="B" />
      </div>

      <div className="url-edit-bar">
        {!editing ? (
          <button className="edit-urls-btn" onClick={() => setEditing(true)}>
            ✎ Change video URLs
          </button>
        ) : (
          <div className="url-edit-form">
            <input
              className="url-edit-input"
              value={newYt}
              onChange={e => setNewYt(e.target.value)}
              placeholder="YouTube URL"
            />
            <input
              className="url-edit-input"
              value={newIg}
              onChange={e => setNewIg(e.target.value)}
              placeholder="Instagram Reel URL"
            />
            <div className="url-edit-actions">
              <button className="url-reload-btn" onClick={handleReload} disabled={loading}>
                {loading ? 'Loading...' : 'Reload videos →'}
              </button>
              <button className="url-cancel-btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
