import React, { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import URLInput from './components/URLInput';
import VideoCards from './components/VideoCards';
import ChatPanel from './components/ChatPanel';
import './App.css';

const SESSION_ID = uuidv4();

export default function App() {
  const [phase, setPhase] = useState('input');
  const [videoData, setVideoData] = useState({ a: null, b: null });
  const [urls, setUrls] = useState({ yt: '', ig: '' });
  const [error, setError] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const handleIngest = useCallback(async (youtubeUrl, instagramUrl) => {
    setPhase('loading');
    setError(null);
    setUrls({ yt: youtubeUrl, ig: instagramUrl });
    setLoadingMsg('Fetching transcripts and metadata...');
    try {
      const res = await fetch('https://rag-video-analyzer-7euf.onrender.com/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtube_url: youtubeUrl, instagram_url: instagramUrl, session_id: SESSION_ID })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Something went wrong');
      }
      const data = await res.json();
      setVideoData({ a: data.video_a, b: data.video_b });
      setLoadingMsg('Embedding into vector DB...');
      await new Promise(r => setTimeout(r, 600));
      setPhase('chat');
    } catch (e) {
      setError(e.message);
      setPhase('input');
    }
  }, []);

  const handleReset = useCallback(async () => {
    await fetch(`https://rag-video-analyzer-7euf.onrender.com/session/${SESSION_ID}`, { method: 'DELETE' });
    setPhase('input');
    setVideoData({ a: null, b: null });
    setError(null);
  }, []);

  const handleReload = useCallback(async (newYt, newIg) => {
    await fetch(`https://rag-video-analyzer-7euf.onrender.com/session/${SESSION_ID}`, { method: 'DELETE' });
    await handleIngest(newYt, newIg);
  }, [handleIngest]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">▲</span>
            video<span>rag</span>
          </div>
          <div className="header-meta">
            <span className="badge">LangChain</span>
            <span className="badge">ChromaDB</span>
            <span className="badge">Groq</span>
            {phase === 'chat' && (
              <button className="reset-btn" onClick={handleReset}>← start over</button>
            )}
            <button className="theme-toggle" onClick={() => setDark(d => !d)} title="Toggle theme">
              {dark ? '☀' : '☾'}
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {phase === 'input' && <URLInput onSubmit={handleIngest} error={error} initialYt={urls.yt} initialIg={urls.ig} />}
        {phase === 'loading' && (
          <div className="loading-screen">
            <div className="loading-spinner" />
            <p className="loading-msg">{loadingMsg}</p>
            <p className="loading-sub">chunk → embed → store → ready</p>
          </div>
        )}
        {phase === 'chat' && videoData.a && videoData.b && (
          <div className="chat-layout">
            <VideoCards videoA={videoData.a} videoB={videoData.b} urls={urls} onReload={handleReload} />
            <ChatPanel sessionId={SESSION_ID} videoA={videoData.a} videoB={videoData.b} />
          </div>
        )}
      </main>
    </div>
  );
}
