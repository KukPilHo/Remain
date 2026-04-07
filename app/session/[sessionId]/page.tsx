'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { startRecording, stopRecording, getFileExtension, type RecordingSession } from '@/lib/audio';
import { buildInterviewPrompt, buildClosingPrompt } from '@/lib/prompts';
import ConversationLog from '@/components/ConversationLog';
import MemoryStimulator from '@/components/MemoryStimulator';
import type { Turn, SessionState } from '@/types';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const MAX_PARENT_TURNS = 4;
const PARENT_NAME = '어르신';

export default function SessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId : '';
  const nameParam = searchParams.get('name') || PARENT_NAME;

  const [dbQuestion, setDbQuestion] = useState<any>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const [session, setSession] = useState<SessionState>({
    sessionId,
    parentName: nameParam,
    topic: '추억 이야기',
    currentQuestionId: sessionId,
    turns: [],
    currentTurn: 0,
    maxTurns: MAX_PARENT_TURNS * 2,
    status: 'greeting',
  });

  const [errorMessage, setErrorMessage] = useState('');
  const [processingStep, setProcessingStep] = useState('');
  
  // Microphone Control States
  const sessionRef = useRef<RecordingSession | null>(null);
  const [recordingStatus, setRecordingStatus] = useState(false);
  
  const parentTurnCount = useRef(0);

  useEffect(() => {
    if (!sessionId) return;
    
    const fetchQuestion = async () => {
      try {
        const { data, error } = await supabase
          .from('questions')
          .select('*')
          .eq('id', sessionId)
          .single();
        if (error) {
          console.error(error);
          setErrorMessage('질문을 찾을 수 없거나 데이터베이스 연결이 없습니다. 환경변수(.env.local)를 확인해주세요.');
        }
        if (data) {
          setDbQuestion(data);
          // DB에 저장된 recipient_name이 있으면 그걸 우선 사용
          if (data.recipient_name) {
            setSession(prev => ({ ...prev, parentName: data.recipient_name }));
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingInitial(false);
      }
    };
    fetchQuestion();
  }, [sessionId]);

  const handleStartSession = useCallback(() => {
    setSession(prev => ({ ...prev, status: 'waiting_answer' }));
  }, []);

  const handleRecord = async () => {
    if (recordingStatus && sessionRef.current) {
      setProcessingStep('말씀을 들었습니다. 텍스트로 정리하는 중입니다...');
      setRecordingStatus(false);
      
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

        // Transcribed text obtained, auto submit it!
        handleAnswerSubmit(data.text);
      } catch (err: any) {
        setErrorMessage(err.message || '음성을 처리하는데 실패했습니다.');
        setSession(prev => ({ ...prev, status: 'waiting_answer' }));
        setProcessingStep('');
      }
      return;
    }

    // Start Recording
    try {
      setErrorMessage('');
      const audioSession = await startRecording();
      sessionRef.current = audioSession;
      setRecordingStatus(true);
    } catch (err) {
      console.error(err);
      setErrorMessage('마이크를 사용할 수 없습니다. 권한을 허용해주세요!');
    }
  };

  const handleAnswerSubmit = async (textAnswer: string) => {
    setSession(prev => ({ ...prev, status: 'processing' }));
    setErrorMessage('');
    setProcessingStep('이야기를 곱씹고 저장하고 있어요...');

    try {
      const { error: dbError } = await supabase
        .from('responses')
        .insert([{ question_id: sessionId, answer: textAnswer }]);
      
      if (dbError) {
        console.warn('DB에 저장하지 못했습니다:', dbError);
      }

      const parentTurn: Turn = { role: 'parent', text: textAnswer, timestamp: new Date() };
      parentTurnCount.current += 1;
      const updatedTurns = [...session.turns, parentTurn];
      setSession(prev => ({ ...prev, turns: updatedTurns, currentTurn: prev.currentTurn + 1 }));

      const isLastTurn = parentTurnCount.current >= MAX_PARENT_TURNS;
      setProcessingStep(isLastTurn ? '마무리 인사를 준비하고 있어요...' : '새로운 질문을 만들고 있어요...');

      const prompt = isLastTurn
        ? buildClosingPrompt(session.parentName, updatedTurns)
        : buildInterviewPrompt(session.parentName, session.topic, dbQuestion?.content?.text || '', updatedTurns);

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

  const handleFastForwardComplete = useCallback(async () => {
    setProcessingStep('빠른 테스트(4턴) 자동 진행 중...');
    setSession(prev => ({ ...prev, status: 'processing' }));
    
    const mockTurns: Turn[] = [
      { role: 'ai', text: '테스트 환경 변수 기반으로 첫 인사를 먼저 드립니다.', timestamp: new Date() },
      { role: 'parent', text: '네, 정말 좋았던 기억입니다.', timestamp: new Date() },
      { role: 'ai', text: '그렇군요. 혹시 그때 어떤 감정이 드셨나요?', timestamp: new Date() },
      { role: 'parent', text: '참 따뜻하고 즐거웠습니다.', timestamp: new Date() },
      { role: 'ai', text: '특별한 감정을 느끼셨군요. 지금도 비슷한 순간이 있으신가요?', timestamp: new Date() },
      { role: 'parent', text: '가끔 가족과 밥 먹을 때 그런 것 같습니다.', timestamp: new Date() },
      { role: 'ai', text: '소중한 이야기 잘 들었습니다. 마지막으로 하시고 싶은 말씀 있나요?', timestamp: new Date() },
      { role: 'parent', text: '여기까지 할게요, 감사합니다.', timestamp: new Date() }
    ];

    try {
      if (sessionId) {
        await supabase.from('responses').insert([{ question_id: sessionId, answer: '빠른 전체 스킵 테스트 답변 완료' }]);
      }
    } catch(err) {}

    parentTurnCount.current = 4;
    setSession(prev => ({ 
      ...prev, 
      turns: mockTurns, 
      status: 'completed',
      currentTurn: 8
    }));
    setProcessingStep('');
  }, [sessionId]);

  if (loadingInitial) {
    return <main className="min-h-screen bg-[#fef9f1] flex flex-col items-center justify-center p-10"><p>로딩 중입니다...</p></main>;
  }

  if (!dbQuestion && errorMessage) {
    return <main className="min-h-screen bg-[#fef9f1] flex flex-col items-center justify-center p-10"><p className="text-red-500 font-bold">{errorMessage}</p><p className="mt-4 text-sm text-gray-500">Supabase 테이블 생성 및 .env 변수를 확인해주세요.</p></main>;
  }

  return (
    <main className="min-h-screen bg-[#fef9f1] flex flex-col items-center py-10 px-4 font-sans text-[#333]">
      <header className="mb-8 text-center pt-8">
        <h1 className="text-4xl font-extrabold text-[#3a352f] tracking-tight mb-3">기록하다</h1>
        <p className="text-[#6d6455] font-medium text-lg">부모님의 이야기를 AI가 기록합니다</p>
      </header>

      <section className="w-full max-w-2xl bg-white shadow-xl rounded-2xl overflow-hidden flex flex-col border border-[#ebd8c5] min-h-[500px]">
        {session.status === 'greeting' && (
          <div className="p-10 text-center flex flex-col items-center flex-1 justify-center">
            <h2 className="text-3xl font-bold mb-4 text-[#4a4238]">{session.parentName}님, 안녕하세요.</h2>
            <p className="text-[#6d6455] text-lg mb-8 max-w-md leading-relaxed">
              가족이 남긴 특별한 질문이 도착했습니다.<br/>아래 버튼을 눌러 이야기를 시작해보세요!
            </p>
            <button onClick={handleStartSession} className="px-10 py-4 bg-[#2F6F4F] text-white font-bold text-xl rounded-xl hover:bg-[#23533b] transition shadow-lg w-full sm:w-auto flex items-center justify-center gap-2">
              <span>🎙️</span> 오늘의 대화 시작하기
            </button>
          </div>
        )}

        {(session.status === 'waiting_answer' || session.status === 'processing' || session.status === 'asking') && (
          <div className="flex-1 flex flex-col">
            {parentTurnCount.current === 0 && dbQuestion && (
              <div className="border-b border-[#ebd8c5] bg-[#f9fdfa] p-4">
                <MemoryStimulator 
                  type={dbQuestion.type as any} 
                  content={dbQuestion.content} 
                  onAnswerSubmit={handleAnswerSubmit} 
                  isRecording={recordingStatus}
                  onToggleRecording={handleRecord}
                />
              </div>
            )}
            
            <div className="flex-1 p-4 max-h-[50vh] overflow-y-auto">
              <ConversationLog turns={session.turns} parentName={session.parentName} />
              {processingStep && <div className="text-sm text-gray-500 text-center animate-pulse mt-4 font-medium">{processingStep}</div>}
              {session.status === 'asking' && <div className="text-sm text-[#2F6F4F] font-bold text-center animate-pulse mt-4">AI가 말씀드리고 있습니다...</div>}
            </div>

            {parentTurnCount.current > 0 && (
               <div className="p-6 bg-[#f9fdfa] border-t border-[#ebd8c5] flex flex-col items-center justify-center gap-2">
                 {session.status === 'processing' || session.status === 'asking' ? (
                    <p className="text-sm text-[#6d6455] font-medium text-center">잠시만 기다려주세요...</p>
                 ) : (
                    <>
                      <button
                        onClick={handleRecord}
                        className={`w-28 h-28 rounded-full flex flex-col items-center justify-center text-white shadow-lg transition-all ${recordingStatus ? 'bg-red-500 animate-pulse' : 'bg-[#2F6F4F] hover:bg-[#23533b]'}`}
                      >
                        <span className="text-3xl mb-1">{recordingStatus ? "🔴" : "🎤"}</span>
                        <span className="font-bold text-sm">{recordingStatus ? "마치기" : "말씀하기"}</span>
                      </button>
                      <p className="text-sm text-[#6d6455] font-medium text-center mt-3">
                        {recordingStatus ? '말씀을 다 하셨으면 이 버튼을 한 번 더 눌러주세요.' : '위 마이크 버튼을 눌러 자유롭게 답변을 이어가주세요.'}
                      </p>
                    </>
                 )}
               </div>
            )}
          </div>
        )}

        {session.status === 'completed' && (
          <div className="p-10 text-center flex flex-col items-center flex-1 justify-center">
            <div className="text-6xl mb-6">🎉</div>
            <h3 className="text-2xl font-bold mb-4 text-[#4a4238]">모든 대화가 무사히 기록되었습니다.</h3>
            <p className="text-[#6d6455] text-lg mb-8 leading-relaxed">
              소중한 이야기를 들려주셔서 대단히 감사합니다.<br/>멋진 자서전의 한 페이지가 완성되었어요!
            </p>
            <Link href="/" className="px-8 py-3 bg-[#eef1ed] text-[#2F6F4F] font-bold rounded-xl hover:bg-[#d8e3da] transition border border-[#2F6F4F]/20">
              처음으로 돌아가기
            </Link>
          </div>
        )}
      </section>
      
      {/* Dev Mode Fully Skip Button */}
      {session.status !== 'greeting' && session.status !== 'completed' && (
        <div className="fixed bottom-4 right-4 flex flex-col items-end gap-3 z-50">
          {process.env.NODE_ENV === 'development' && (
            <button
               onClick={handleFastForwardComplete} 
               className="px-5 py-2 bg-gray-800 text-white text-xs font-semibold rounded-full shadow-lg hover:bg-black transition border border-gray-600"
               disabled={session.status === 'processing' || session.status === 'asking'}
            >
               ⏩ 빠른 테스트 완료 (4턴)
            </button>
          )}
        </div>
      )}
    </main>
  );
}
