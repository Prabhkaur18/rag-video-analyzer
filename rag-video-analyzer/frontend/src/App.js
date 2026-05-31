import React, { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import URLInput from './components/URLInput';
import VideoCards from './components/VideoCards';
import ChatPanel from './components/ChatPanel';
import './App.css';

const SESSION_ID = uuidv4();

export default function App() {
  const [phase, setPhase] = useState('input'); // input | loading | chat
  const [videoData, setVideoData] = useState({ a: null, b: null });
  const [error, setError] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState('');

  const handleIngest = useCallback(async (youtubeUrl, instagramUrl) => {
    setPhase('loading');
    setError(null);
    setLoadingMsg('Fetching transcripts & metadata...');
    try {
      const res = await fetch('/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtube_url: youtubeUrl,
          instagram_url: instagramUrl,
          session_id: SESSION_ID
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Ingest failed');
      }
      const data = await res.json();
      setVideoData({ a: data.video_a, b: data.video_b });
      setLoadingMsg('Embedding into vector DB...');
      await new Promise(r => setTimeout(r, 800));
      setPhase('chat');
    } catch (e) {
      setError(e.message);
      setPhase('input');
    }
  }, []);

  const handleReset = useCallback(async () => {
    await fetch(`/session/${SESSION_ID}`, { method: 'DELETE' });
    setPhase('input');
    setVideoData({ a: null, b: null });
    setError(null);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-bracket">[</span>
            <span className="logo-text">RAG</span>
            <span className="logo-dot">.</span>
            <span className="logo-text2">ANALYZER</span>
            <span className="logo-bracket">]</span>
          </div>
          <div className="header-meta">
            <span className="badge">LangChain</span>
            <span className="badge">ChromaDB</span>
            <span className="badge">GPT-4o-mini</span>
            {phase === 'chat' && (
              <button className="reset-btn" onClick={handleReset}>↺ Reset</button>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        {phase === 'input' && (
          <URLInput onSubmit={handleIngest} error={error} />
        )}
        {phase === 'loading' && (
          <div className="loading-screen">
            <div className="loading-spinner" />
            <p className="loading-msg">{loadingMsg}</p>
            <p className="loading-sub">Chunking → Embedding → Storing in vector DB</p>
          </div>
        )}
        {phase === 'chat' && videoData.a && videoData.b && (
          <div className="chat-layout">
            <VideoCards videoA={videoData.a} videoB={videoData.b} />
            <ChatPanel sessionId={SESSION_ID} videoA={videoData.a} videoB={videoData.b} />
          </div>
        )}
      </main>
    </div>
  );
}
