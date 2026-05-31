import React from 'react';
import './VideoCards.css';

function StatPill({ label, value, highlight }) {
  return (
    <div className={`stat-pill ${highlight ? 'stat-pill--highlight' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function VideoCard({ meta, label, color }) {
  const views = Number(meta?.views || 0);
  const likes = Number(meta?.likes || 0);
  const comments = Number(meta?.comments || 0);
  const er = Number(meta?.engagement_rate || 0);
  const duration = Number(meta?.duration || 0);

  const fmt = (n) => n >= 1000000
    ? (n / 1000000).toFixed(1) + 'M'
    : n >= 1000
      ? (n / 1000).toFixed(1) + 'K'
      : String(n);

  const fmtDur = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const hashtags = meta?.hashtags || [];

  return (
    <div className="video-card" style={{ '--card-color': color }}>
      <div className="card-header">
        <div className="card-label">[{label}]</div>
        <div className="card-platform">{meta?.platform?.toUpperCase() || '?'}</div>
      </div>

      {meta?.url && (
        <div className="card-embed">
          {meta.platform === 'youtube' && meta.video_id_internal ? (
            <iframe
              src={`https://www.youtube.com/embed/${meta.video_id_internal}`}
              title="Video A"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="card-embed-placeholder">
              <span className="embed-icon">▶</span>
              <a href={meta.url} target="_blank" rel="noreferrer" className="embed-link">
                View on {meta?.platform || 'Platform'} ↗
              </a>
            </div>
          )}
        </div>
      )}

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

      {hashtags.length > 0 && (
        <div className="card-hashtags">
          {hashtags.slice(0, 6).map(h => (
            <span key={h} className="hashtag">{h.startsWith('#') ? h : `#${h}`}</span>
          ))}
        </div>
      )}

      {meta?.note && (
        <div className="card-note">{meta.note}</div>
      )}
    </div>
  );
}

export default function VideoCards({ videoA, videoB }) {
  return (
    <div className="video-cards">
      <VideoCard meta={videoA} label="A" color="var(--accent2)" />
      <VideoCard meta={videoB} label="B" color="var(--accent3)" />
    </div>
  );
}
