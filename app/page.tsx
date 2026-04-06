'use client';

import { useState, useRef, useCallback } from 'react';
import {
  startRecording,
  stopRecording,
  getFileExtension,
  type RecordingSession,
} from '@/lib/audio';
import Link from 'next/link';

type Status = 'idle' | 'recording' | 'processing' | 'done' | 'error';
type TTSStatus = 'idle' | 'loading' | 'playing' | 'done' | 'error';

export default function Home() {
  const [status, setStatus] = useState<Status>('idle');
  const [transcribedText, setTranscribedText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const sessionRef = useRef<RecordingSession | null>(null);
  const [ttsStatus, setTtsStatus] = useState<TTSStatus>('idle');
  const [ttsError, setTtsError] = useState('');

  const handleRecord = useCallback(async () => {
    if (status === 'recording' && sessionRef.current) {
      setStatus('processing');
      try {
        const audioBlob = await stopRecording(sessionRef.current);
        sessionRef.current = null;

        const ext = getFileExtension(audioBlob.type);
        const formData = new FormData();
        formData.append('audio', audioBlob, `recording.${ext}`);

        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '음성 변환에 실패했습니다.');

        setTranscribedText(data.text);
        setErrorMessage('');
        setStatus('done');
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : '다시 시도해 주세요.');
        setStatus('error');
      }
      return;
    }

    setErrorMessage('');
    setTranscribedText('');
    try {
      const session = await startRecording();
      sessionRef.current = session;
      setStatus('recording');
    } catch (err: unknown) {
      console.error('Recording error:', err);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setErrorMessage('마이크 권한을 허용해 주세요.');
      } else {
        setErrorMessage('마이크를 사용할 수 없습니다.');
      }
      setStatus('error');
    }
  }, [status]);

  const handleTTSTest = useCallback(async () => {
    setTtsStatus('loading');
    setTtsError('');
    try {
      const response = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '안녕하세요, 오늘 이야기를 나눠볼까요? 편하게 말씀해 주시면 돼요.',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '음성 생성에 실패했습니다.');
      }

      setTtsStatus('playing');
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setTtsStatus('done');
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setTtsError('음성 재생에 실패했습니다.');
        setTtsStatus('error');
      };

      await audio.play();
    } catch (err: unknown) {
      setTtsError(err instanceof Error ? err.message : '오류가 발생했습니다.');
      setTtsStatus('error');
    }
  }, []);

  return (
    <main className="main-container">
      <header className="header">
        <h1 className="title">기록하다</h1>
        <p className="subtitle">부모님의 이야기를 AI가 기록합니다</p>
      </header>

      {/* 결과 표시 */}
      {transcribedText && (
        <section className="result-area">
          <div className="result-card">
            <p className="result-label">변환된 텍스트</p>
            <p className="result-text">{transcribedText}</p>
          </div>
        </section>
      )}

      {errorMessage && (
        <section className="result-area">
          <div className="error-card">
            <p className="error-text">{errorMessage}</p>
            <button onClick={() => { setStatus('idle'); setErrorMessage(''); }} className="retry-button">
              다시 시도하기
            </button>
          </div>
        </section>
      )}

      {status === 'processing' && (
        <section className="result-area">
          <div className="processing-card">
            <div className="spinner" />
            <p className="processing-text">텍스트로 변환 중...</p>
          </div>
        </section>
      )}

      {/* 액션 버튼들 */}
      <section className="home-actions">
        <Link href="/session/test?q=Q-01" className="home-main-button">
          🎙️ 대화 시작하기
        </Link>

        <div className="home-sub-buttons">
          <button
            onClick={handleRecord}
            disabled={status === 'processing'}
            className={`home-sub-button ${status === 'recording' ? 'recording' : ''}`}
          >
            {status === 'idle' && '🎤 녹음 테스트'}
            {status === 'recording' && '⏹️ 녹음 중지'}
            {status === 'processing' && '⏳ 변환 중...'}
            {status === 'done' && '🎤 다시 녹음'}
            {status === 'error' && '🎤 다시 시도'}
          </button>

          <button
            onClick={handleTTSTest}
            disabled={ttsStatus === 'loading' || ttsStatus === 'playing'}
            className="home-sub-button"
          >
            {ttsStatus === 'idle' && '🔊 음성 테스트'}
            {ttsStatus === 'loading' && '⏳ 생성 중...'}
            {ttsStatus === 'playing' && '🔊 재생 중...'}
            {ttsStatus === 'done' && '✅ 다시 듣기'}
            {ttsStatus === 'error' && '❌ 다시 시도'}
          </button>
        </div>

        {ttsError && <p className="error-text" style={{ fontSize: '0.95rem' }}>{ttsError}</p>}
      </section>
    </main>
  );
}
