'use client';

import { useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  startRecording,
  stopRecording,
  getFileExtension,
  type RecordingSession,
} from '@/lib/audio';
import { getQuestionById } from '@/lib/questions';
import { buildInterviewPrompt, buildClosingPrompt } from '@/lib/prompts';
import ConversationLog from '@/components/ConversationLog';
import type { Turn, SessionState } from '@/types';
import Link from 'next/link';

const MAX_PARENT_TURNS = 4;
const PARENT_NAME = '어르신';

async function playTTS(text: string): Promise<void> {
  const response = await fetch('/api/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || '음성 생성에 실패했습니다.');
  }

  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);

  return new Promise<void>((resolve, reject) => {
    const audio = new Audio(audioUrl);
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      reject(new Error('음성 재생에 실패했습니다.'));
    };
    audio.play().catch(reject);
  });
}

/** 대화에서 부모님 답변만 간단히 요약 텍스트로 만들기 */
function buildConversationSummary(turns: Turn[]): string {
  const parentAnswers = turns
    .filter((t) => t.role === 'parent')
    .map((t) => t.text);
  if (parentAnswers.length === 0) return '';
  return parentAnswers.join(' · ');
}

export default function SessionPage() {
  const searchParams = useSearchParams();
  const questionId = searchParams.get('q') || 'Q-01';
  const nameParam = searchParams.get('name') || PARENT_NAME;

  const question = getQuestionById(questionId);

  const [session, setSession] = useState<SessionState>({
    sessionId: 'test',
    parentName: nameParam,
    topic: question?.category || '어린 시절',
    currentQuestionId: questionId,
    turns: [],
    currentTurn: 0,
    maxTurns: MAX_PARENT_TURNS * 2,
    status: 'greeting',
  });

  const [errorMessage, setErrorMessage] = useState('');
  const [processingStep, setProcessingStep] = useState('');
  const sessionRef = useRef<RecordingSession | null>(null);
  const parentTurnCount = useRef(0);

  // 첫 인사 + 질문 TTS (사용자 제스처로 시작)
  const handleStartSession = useCallback(async () => {
    if (!question) return;

    setSession((prev) => ({ ...prev, status: 'asking' }));
    setErrorMessage('');

    try {
      const greetingText = `${question.greeting} ${question.question}`;
      const aiTurn: Turn = {
        role: 'ai',
        text: greetingText,
        timestamp: new Date(),
      };

      setSession((prev) => ({
        ...prev,
        turns: [...prev.turns, aiTurn],
      }));

      await playTTS(greetingText);
      setSession((prev) => ({ ...prev, status: 'waiting_answer' }));
    } catch (err: unknown) {
      console.error('Greeting error:', err);
      setErrorMessage('잠시 문제가 생겼어요.\n다시 한번 시도해 주세요.');
      setSession((prev) => ({ ...prev, status: 'waiting_answer' }));
    }
  }, [question]);

  // 녹음 시작/종료
  const handleRecord = useCallback(async () => {
    if (!question) return;

    // 녹음 중이면 → 녹음 종료 + 처리
    if (session.status === 'waiting_answer' && sessionRef.current) {
      setSession((prev) => ({ ...prev, status: 'processing' }));
      setErrorMessage('');

      try {
        setProcessingStep('음성을 듣고 있어요...');
        const audioBlob = await stopRecording(sessionRef.current);
        sessionRef.current = null;

        const ext = getFileExtension(audioBlob.type);
        const formData = new FormData();
        formData.append('audio', audioBlob, `recording.${ext}`);

        const sttResponse = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
        });
        const sttData = await sttResponse.json();

        if (!sttResponse.ok) {
          throw new Error(sttData.error || '음성 변환에 실패했습니다.');
        }

        const parentTurn: Turn = {
          role: 'parent',
          text: sttData.text,
          timestamp: new Date(),
        };

        parentTurnCount.current += 1;
        const updatedTurns = [...session.turns, parentTurn];
        setSession((prev) => ({
          ...prev,
          turns: updatedTurns,
          currentTurn: prev.currentTurn + 1,
        }));

        const isLastTurn = parentTurnCount.current >= MAX_PARENT_TURNS;

        setProcessingStep(
          isLastTurn
            ? '마무리 인사를 준비하고 있어요...'
            : '이야기를 곱씹고 있어요...'
        );

        const prompt = isLastTurn
          ? buildClosingPrompt(session.parentName, updatedTurns)
          : buildInterviewPrompt(
              session.parentName,
              session.topic,
              question.question,
              updatedTurns
            );

        const llmResponse = await fetch('/api/generate-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        const llmData = await llmResponse.json();

        if (!llmResponse.ok) {
          throw new Error(llmData.error || '질문 생성에 실패했습니다.');
        }

        const aiTurn: Turn = {
          role: 'ai',
          text: llmData.text,
          timestamp: new Date(),
        };

        setSession((prev) => ({
          ...prev,
          turns: [...prev.turns, aiTurn],
          status: 'asking',
        }));

        setProcessingStep('');
        await playTTS(llmData.text);

        if (isLastTurn) {
          setSession((prev) => ({ ...prev, status: 'completed' }));
        } else {
          setSession((prev) => ({ ...prev, status: 'waiting_answer' }));
        }
      } catch (err: unknown) {
        console.error('Processing error:', err);
        setErrorMessage('다시 한번 말씀해 주시겠어요?');
        setSession((prev) => ({ ...prev, status: 'waiting_answer' }));
        setProcessingStep('');
      }
      return;
    }

    // 녹음 시작
    if (session.status === 'waiting_answer') {
      setErrorMessage('');
      try {
        const recSession = await startRecording();
        sessionRef.current = recSession;
        setSession((prev) => ({ ...prev }));
      } catch (err: unknown) {
        console.error('Recording error:', err);
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          setErrorMessage(
            '마이크를 사용하려면 권한이 필요해요.\n화면 위쪽에 뜨는 팝업에서 "허용"을 눌러 주세요.'
          );
        } else if (err instanceof DOMException && err.name === 'NotFoundError') {
          setErrorMessage(
            '마이크가 연결되어 있지 않아요.\n마이크를 확인해 주세요.'
          );
        } else {
          setErrorMessage('다시 한번 시도해 주세요.');
        }
      }
    }
  }, [session, question]);

  const isRecording =
    sessionRef.current !== null && session.status === 'waiting_answer';

  if (!question) {
    return (
      <main className="session-container">
        <div className="session-chat-area">
          <div className="error-card">
            <p className="error-text">질문을 찾을 수 없습니다.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="session-container">
      {/* 상단 헤더 */}
      <header className="session-header">
        <h1 className="session-title">기록하다</h1>
        <p className="session-topic">{question.category} 이야기</p>
        {session.status !== 'greeting' && session.status !== 'completed' && (
          <p className="session-progress">
            {parentTurnCount.current}/{MAX_PARENT_TURNS}번째 대화
          </p>
        )}
      </header>

      {/* 대화 기록 영역 */}
      <section className="session-chat-area">
        {/* 시작 화면 */}
        {session.status === 'greeting' && (
          <div className="greeting-card">
            <p className="greeting-emoji">👋</p>
            <p className="greeting-name">{session.parentName}님,</p>
            <p className="greeting-text">
              오늘 이야기를 나눠볼까요?
            </p>
            <p className="greeting-topic">
              오늘의 주제: <strong>{question.category}</strong>
              <br />
              {question.guide}
            </p>
            <button onClick={handleStartSession} className="start-button">
              시작하기
            </button>
          </div>
        )}

        <ConversationLog
          turns={session.turns}
          parentName={session.parentName}
        />

        {/* 상태 표시 */}
        {session.status === 'processing' && (
          <div className="session-status-bar">
            <span className="session-status-icon">⏳</span>
            <p className="session-status-text">
              {processingStep || '잠시만요, 듣고 있어요...'}
            </p>
          </div>
        )}

        {session.status === 'asking' && (
          <div className="session-status-bar">
            <span className="session-status-icon">🔊</span>
            <p className="session-status-text">이야기하고 있어요...</p>
          </div>
        )}

        {/* 에러 메시지 (친절한 톤) */}
        {errorMessage && (
          <div className="error-card" style={{ marginTop: '0.75rem' }}>
            <p className="error-text">{errorMessage}</p>
          </div>
        )}

        {/* 완료 화면 */}
        {session.status === 'completed' && (
          <div className="completed-card">
            <p className="completed-emoji">🎉</p>
            <p className="completed-title">오늘 대화가 끝났어요</p>

            {/* 대화 요약 */}
            {session.turns.some((t) => t.role === 'parent') && (
              <div className="completed-summary">
                <p className="completed-summary-label">
                  오늘 들려주신 이야기
                </p>
                <p className="completed-summary-text">
                  {buildConversationSummary(session.turns)}
                </p>
              </div>
            )}

            <p className="completed-sub">
              소중한 이야기를 들려주셔서 감사합니다.
              <br />
              다음에 또 만나요!
            </p>

            <Link href="/" className="completed-home-button">
              처음으로 돌아가기
            </Link>
          </div>
        )}
      </section>

      {/* 하단 녹음 영역 (fixed) */}
      {session.status !== 'greeting' && session.status !== 'completed' && (
        <section className="session-bottom">
          <button
            onClick={handleRecord}
            disabled={
              session.status === 'processing' || session.status === 'asking'
            }
            className={`record-button ${isRecording ? 'recording' : ''}`}
            aria-label={isRecording ? '녹음 중지' : '녹음 시작'}
          >
            {isRecording ? (
              <svg width="36" height="36" viewBox="0 0 32 32" fill="white">
                <rect x="8" y="8" width="16" height="16" rx="2" />
              </svg>
            ) : (
              <svg width="36" height="36" viewBox="0 0 32 32" fill="white">
                <path d="M16 4a4 4 0 0 1 4 4v8a4 4 0 0 1-8 0V8a4 4 0 0 1 4-4z" />
                <path d="M8 14a1 1 0 0 1 2 0 6 6 0 0 0 12 0 1 1 0 0 1 2 0 8 8 0 0 1-7 7.93V26h4a1 1 0 0 1 0 2h-10a1 1 0 0 1 0-2h4v-4.07A8 8 0 0 1 8 14z" />
              </svg>
            )}
          </button>

          <p className="status-text">
            {session.status === 'waiting_answer' &&
              !isRecording &&
              '🎤 눌러서 말씀해 주세요'}
            {isRecording && '🔴 말씀해 주세요... (다시 누르면 종료)'}
            {session.status === 'processing' && '⏳ 잠시만 기다려 주세요...'}
            {session.status === 'asking' && '🔊 이야기하고 있어요...'}
          </p>

          <button
            onClick={() =>
              setSession((prev) => ({ ...prev, status: 'completed' }))
            }
            className="end-button"
            disabled={
              session.status === 'processing' || session.status === 'asking'
            }
          >
            오늘 대화 끝내기
          </button>
        </section>
      )}
    </main>
  );
}
