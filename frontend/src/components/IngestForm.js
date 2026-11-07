import React, { useState } from 'react';
import { Youtube, Instagram, Zap, Loader } from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  'Why did Video A get more engagement than Video B?',
  'What is the engagement rate of each video?',
  'Compare the hooks in the first 5 seconds.',
  'Who is the creator of Video B and what is their follower count?',
  'Suggest improvements for B based on what worked in A.',
];

export default function IngestForm({ onIngest, loading }) {
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');

  const handleSubmit = () => {
    if (!urlA.trim() || !urlB.trim()) return;
    onIngest(urlA.trim(), urlB.trim());
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoAccent}>VIDEO</span>
          <span style={styles.logoMain}>RAG</span>
        </div>
        <div style={styles.subtitle}>Creator Intelligence Engine</div>
      </div>

      <div style={styles.inputs}>
        <InputField
          icon={<Youtube size={14} color="#ff3b30" />}
          label="VIDEO A — YouTube URL"
          placeholder="https://youtube.com/watch?v=..."
          value={urlA}
          onChange={setUrlA}
          accent="var(--accent)"
        />
        <InputField
          icon={<Instagram size={14} color="#c13584" />}
          label="VIDEO B — Instagram Reel URL"
          placeholder="https://instagram.com/reel/..."
          value={urlB}
          onChange={setUrlB}
          accent="var(--accent2)"
        />
      </div>

      <button
        style={{
          ...styles.btn,
          opacity: (!urlA.trim() || !urlB.trim() || loading) ? 0.5 : 1,
          cursor: (!urlA.trim() || !urlB.trim() || loading) ? 'not-allowed' : 'pointer',
        }}
        onClick={handleSubmit}
        disabled={!urlA.trim() || !urlB.trim() || loading}
      >
        {loading ? (
          <>
            <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
            Fetching + Embedding...
          </>
        ) : (
          <>
            <Zap size={14} />
            Ingest & Analyze
          </>
        )}
      </button>

      <div style={styles.suggestions}>
        <div style={styles.suggestLabel}>Suggested questions after ingestion:</div>
        {SUGGESTED_QUESTIONS.map((q) => (
          <div key={q} style={styles.suggest}>{q}</div>
        ))}
      </div>
    </div>
  );
}

function InputField({ icon, label, placeholder, value, onChange, accent }) {
  return (
    <div style={styles.field}>
      <div style={styles.fieldLabel}>
        {icon}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', color: 'var(--text3)' }}>
          {label}
        </span>
      </div>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...styles.input, '--focus-color': accent }}
        onFocus={(e) => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 2px ${accent}20`; }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
      />
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
    marginBottom: '4px',
  },
  logo: {
    fontFamily: 'var(--font-mono)',
    fontSize: '22px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  logoAccent: {
    color: 'var(--accent)',
  },
  logoMain: {
    color: 'var(--text)',
  },
  subtitle: {
    fontSize: '11px',
    color: 'var(--text3)',
    letterSpacing: '0.05em',
  },
  inputs: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  fieldLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  input: {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
    padding: '9px 12px',
    fontSize: '12px',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    width: '100%',
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    background: 'var(--accent)',
    color: 'var(--bg)',
    border: 'none',
    borderRadius: 'var(--radius)',
    padding: '10px 18px',
    fontSize: '13px',
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em',
    transition: 'opacity 0.15s',
  },
  suggestions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    borderTop: '1px solid var(--border)',
    paddingTop: '12px',
  },
  suggestLabel: {
    fontSize: '10px',
    color: 'var(--text3)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '4px',
  },
  suggest: {
    fontSize: '11px',
    color: 'var(--text3)',
    padding: '4px 8px',
    borderRadius: '4px',
    background: 'var(--surface2)',
    lineHeight: 1.5,
  },
};
