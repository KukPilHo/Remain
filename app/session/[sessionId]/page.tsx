'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { startRecording, stopRecording, getFileExtension, type RecordingSession } from '@/lib/audio';
import { getQuestionById } from '@/lib/questions';
import { buildInterviewPrompt, buildClosingPrompt } from '@/lib/prompts';
import ConversationLog from '@/components/ConversationLog';
import MemoryStimulator from '@/components/MemoryStimulator';
import type { Turn, SessionState } from '@/types';
import Link from 'next/link';

const MAX_PARENT_TURNS = 4;
const PARENT_NAME = '어르신';

// Mock DB Fetch based on Session ID
const MOCK_DB = {
  'mock-uuid-photo': { id: 'photo-q', type: 'photo_based', content: { text: "이 사진 기억나세요? 우리 가족 첫 바다 여행 때인데, 이 때 어떤 일이 있었는지 들려주세요.", photoUrl: "https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=640&auto=format&fit=crop" } },
  'mock-uuid-fill': { id: 'fill-q', type: 'fill_in_the_blank', content: { text: "인생에서 가장 잘한 결정을 알려주세요.", prefixText: "내가 살면서 가장 잘한 결정은", suffixText: "이다." } },
  'mock-uuid-multi': { id: 'multi-q', type: 'multiple_choice', content: { text: "가장 좋아하셨던 계절은 언제인가요?", options: ["따뜻한 봄", "무더운 여름", "시원한 가을", "눈내리는 겨울"] } }
};

export default function SessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId : 'mock-session';
  const nameParam = searchParams.get('name') || PARENT_NAME;

  // Fetch specific question based on session Link instead of query param
  const dbQuestion = (MOCK_DB as any)[sessionId] || MOCK_DB['mock-uuid-photo']; // fallback to photo for demo

  const [session, setSession] = useState<SessionState>({
    sessionId,
    parentName: nameParam,
    topic: '추억 이야기',
    currentQuestionId: dbQuestion.id,
    turns: [],
    currentTurn: 0,
    maxTurns: MAX_PARENT_TURNS * 2,
    status: 'greeting',
  });

  const [errorMessage, setErrorMessage] = useState('');
  const [processingStep, setProcessingStep] = useState('');
  const sessionRef = useRef<RecordingSession | null>(null);
  const parentTurnCount = useRef(0);

  const handleStartSession = useCallback(() => {
    setSession(prev => ({ ...prev, status: 'waiting_answer' }));
    // No initial TTS here to allow the MemoryStimulator UI to be the primary interaction.
  }, []);

  const handleAnswerSubmit = async (textAnswer: string) => {
    // Shared processing for both Voice and Text UI (MemoryStimulator)
    setSession(prev => ({ ...prev, status: 'processing' }));
    setErrorMessage('');
    setProcessingStep('이야기를 곱씹고 있어요...');

    try {
      const parentTurn: Turn = { role: 'parent', text: textAnswer, timestamp: new Date() };
      parentTurnCount.current += 1;
      const updatedTurns = [...session.turns, parentTurn];
      
      setSession(prev => ({ ...prev, turns: updatedTurns, currentTurn: prev.currentTurn + 1 }));

      const isLastTurn = parentTurnCount.current >= MAX_PARENT_TURNS;
      setProcessingStep(isLastTurn ? '마무리 인사를 준비하고 있어요...' : '새로운 질문을 만들고 있어요...');

      const prompt = isLastTurn
        ? buildClosingPrompt(session.parentName, updatedTurns)
        : buildInterviewPrompt(session.parentName, session.topic, dbQuestion.content.text, updatedTurns);

      const llmResponse = await fetch('/api/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const llmData = await llmResponse.json();

      if (!llmResponse.ok) throw new Error(llmData.error || '질문 생성에 실패했습니다.');

      const aiTurn: Turn = { role: 'ai', text: llmData.text, timestamp: new Date() };

      setSession(prev => ({ ...prev, turns: [...prev.turns, aiTurn], status: 'asking' }));
      setProcessingStep('');

      // Play AI TTS
      await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: llmData.text }),
      })
      .then(res => res.blob())
      .then(blob => {
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.onended = () => { URL.revokeObjectURL(audioUrl); setSession(prev => ({ ...prev, status: isLastTurn ? 'completed' : 'waiting_answer' })); };
        audio.play().catch(console.error);
      });

    } catch (err: any) {
      console.error(err);
      setErrorMessage('오류가 발생했어요. 다시 시도해주세요.');
      setSession(prev => ({ ...prev, status: 'waiting_answer' }));
      setProcessingStep('');
    }
  };

  const isRecording = sessionRef.current !== null && session.status === 'waiting_answer';

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold text-orange-600 mb-2">기록하다</h1>
        <p className="text-gray-600">당신의 소중한 이야기를 남겨주세요</p>
      </header>

      <section className="w-full max-w-2xl bg-white shadow-xl rounded-2xl overflow-hidden flex flex-col">
        {session.status === 'greeting' && (
          <div className="p-10 text-center flex flex-col items-center">
            <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center text-4xl mb-6">👋</div>
            <h2 className="text-2xl font-bold mb-4">{session.parentName}님, 좋은 하루 되셨나요?</h2>
            <p className="text-gray-600 mb-8 max-w-md">가족이 남긴 특별한 시작 질문이 도착했습니다. 편안하게 이야기를 들려주세요.</p>
            <button onClick={handleStartSession} className="px-8 py-3 bg-orange-500 text-white font-bold rounded-full hover:bg-orange-600 transition shadow-md w-full sm:w-auto">이야기 시작하기</button>
          </div>
        )}

        {(session.status === 'waiting_answer' || session.status === 'processing' || session.status === 'asking') && (
          <div className="flex-1 flex flex-col">
            {/* Show MemoryStimulator ONLY for the first turn (0 parent turns) */}
            {parentTurnCount.current === 0 && (
              <div className="border-b border-gray-100 bg-gray-50/50 p-4">
                <MemoryStimulator 
                  type={dbQuestion.type as any} 
                  content={dbQuestion.content} 
                  onAnswerSubmit={handleAnswerSubmit} 
                />
              </div>
            )}
            
            <div className="flex-1 p-4 max-h-[50vh] overflow-y-auto">
              <ConversationLog turns={session.turns} parentName={session.parentName} />
              {processingStep && <div className="text-sm text-gray-500 text-center animate-pulse mt-4">{processingStep}</div>}
              {session.status === 'asking' && <div className="text-sm text-orange-500 text-center animate-pulse mt-4">AI가 말씀드리고 있습니다...</div>}
            </div>

            {/* General Chat Input Area for turn 2+ */}
            {parentTurnCount.current > 0 && (
              <div className="p-4 bg-gray-50 border-t flex flex-col items-center gap-2">
                <p className="text-xs text-gray-500 mb-2">하단의 말씀하기 버튼을 눌러 답변해주세요.</p>
              </div>
            )}
          </div>
        )}

        {session.status === 'completed' && (
          <div className="p-10 text-center">
            <h2 className="text-3xl mb-4">🎉</h2>
            <h3 className="text-2xl font-bold mb-2">대화가 마무리되었습니다.</h3>
            <p className="text-gray-600 mb-8">소중한 이야기를 들려주셔서 감사합니다. 다른 질문이 도착하면 또 카카오톡으로 알려드릴게요.</p>
            <Link href="/" className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">메인으로 가기</Link>
          </div>
        )}
      </section>

      {/* Voice Recording Control Float */}
      {session.status !== 'greeting' && session.status !== 'completed' && parentTurnCount.current > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
           <button
            className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-orange-500 hover:bg-orange-600'}`}
            disabled={session.status === 'processing' || session.status === 'asking'}
          >
            {isRecording ? "🔴" : "🎤"}
          </button>
        </div>
      )}
    </main>
  );
}
