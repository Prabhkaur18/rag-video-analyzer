import React from 'react';
import { Eye, Heart, MessageCircle, Users, Clock, Calendar, TrendingUp } from 'lucide-react';

const fmt = (n) => {
  if (n === undefined || n === null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
};

const fmtSeconds = (s) => {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
};

const PLATFORM_COLORS = {
  youtube: '#ff3b30',
  instagram: '#c13584',
};

export default function VideoCard({ video, label }) {
  if (!video) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyLabel}>Video {label}</div>
        <div style={styles.emptyText}>Not yet ingested</div>
      </div>
    );
  }

  const platformColor = PLATFORM_COLORS[video.platform] || '#7c3aed';
  const engagementColor = video.engagement_rate > 5 ? 'var(--green)' : video.engagement_rate > 2 ? 'var(--accent)' : 'var(--accent2)';

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ ...styles.badge, background: platformColor + '20', color: platformColor, borderColor: platformColor + '40' }}>
          {video.platform.toUpperCase()}
        </div>
        <div style={{ ...styles.videoLabel, color: label === 'A' ? 'var(--accent)' : 'var(--accent2)' }}>
          VIDEO {label}
        </div>
      </div>

      {/* Thumbnail */}
      {video.thumbnail && (
        <div style={styles.thumbWrap}>
          <img
            src={video.thumbnail}
            alt={video.title}
            style={styles.thumb}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div style={styles.duration}>{fmtSeconds(video.duration)}</div>
        </div>
      )}

      {/* Title */}
      <div style={styles.title} title={video.title}>
        {video.title?.length > 70 ? video.title.slice(0, 67) + '…' : video.title}
      </div>

      {/* Creator */}
      <div style={styles.creator}>
        <Users size={12} color="var(--text3)" />
        <span style={{ color: 'var(--text2)' }}>{video.creator}</span>
        <span style={styles.dot}>·</span>
        <span style={{ color: 'var(--text3)' }}>{fmt(video.follower_count)} followers</span>
      </div>

      {/* Stat grid */}
      <div style={styles.stats}>
        <Stat icon={<Eye size={12} />} label="Views" value={fmt(video.views)} />
        <Stat icon={<Heart size={12} />} label="Likes" value={fmt(video.likes)} />
        <Stat icon={<MessageCircle size={12} />} label="Comments" value={fmt(video.comments)} />
        <Stat icon={<Calendar size={12} />} label="Uploaded" value={video.upload_date || '—'} small />
      </div>

      {/* Engagement rate */}
      <div style={styles.engagementRow}>
        <div style={styles.engagementLabel}>
          <TrendingUp size={13} color={engagementColor} />
          <span>Engagement Rate</span>
        </div>
        <div style={{ ...styles.engagementValue, color: engagementColor }}>
          {video.engagement_rate?.toFixed(4)}%
        </div>
      </div>

      {/* Hashtags */}
      {video.hashtags?.length > 0 && (
        <div style={styles.tags}>
          {video.hashtags.slice(0, 5).map((tag) => (
            <span key={tag} style={styles.tag}>{tag.startsWith('#') ? tag : '#' + tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, small }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statIcon}>{icon}</div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    height: '100%',
  },
  empty: {
    background: 'var(--surface)',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius-lg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '8px',
  },
  emptyLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text3)',
    letterSpacing: '0.1em',
  },
  emptyText: {
    fontSize: '12px',
    color: 'var(--text3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    padding: '2px 8px',
    borderRadius: '4px',
    border: '1px solid',
  },
  videoLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.12em',
  },
  thumbWrap: {
    position: 'relative',
    borderRadius: '6px',
    overflow: 'hidden',
    aspectRatio: '16/9',
    background: 'var(--surface2)',
  },
  thumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  duration: {
    position: 'absolute',
    bottom: '6px',
    right: '6px',
    background: 'rgba(0,0,0,0.8)',
    color: '#fff',
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    padding: '1px 5px',
    borderRadius: '3px',
  },
  title: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text)',
    lineHeight: 1.4,
  },
  creator: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '11px',
    flexWrap: 'wrap',
  },
  dot: {
    color: 'var(--text3)',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '6px',
  },
  stat: {
    background: 'var(--surface2)',
    borderRadius: '6px',
    padding: '8px 4px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
  },
  statIcon: {
    color: 'var(--text3)',
  },
  statValue: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--text)',
  },
  statLabel: {
    fontSize: '9px',
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  engagementRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--surface2)',
    borderRadius: '6px',
    padding: '8px 10px',
  },
  engagementLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: 'var(--text2)',
  },
  engagementValue: {
    fontFamily: 'var(--font-mono)',
    fontSize: '14px',
    fontWeight: 700,
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
  tag: {
    fontSize: '9px',
    fontFamily: 'var(--font-mono)',
    background: 'var(--surface2)',
    color: 'var(--text3)',
    border: '1px solid var(--border)',
    borderRadius: '3px',
    padding: '1px 5px',
  },
};
