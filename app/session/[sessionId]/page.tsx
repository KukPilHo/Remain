'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { startRecording, stopRecording, getFileExtension, type RecordingSession } from '@/lib/audio';
import { buildInterviewPrompt, buildClosingPrompt } from '@/lib/prompts';
import ConversationLog from '@/components/ConversationLog';
import MemoryStimulator from '@/components/MemoryStimulator';
import type { Turn, SessionState, FollowUpTemplate } from '@/types';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Camera, Upload, Check } from 'lucide-react';

const MAX_PARENT_TURNS = 4;
const PARENT_NAME = '어르신';

/* ── 음성 업로드 헬퍼 ── */
async function uploadAudioBlob(
  blob: Blob,
  dbSessionId: string,
  turnIndex: number,
  role: 'ai' | 'parent'
): Promise<string | null> {
  try {
    const ext = blob.type.includes('webm') ? 'webm' : blob.type.includes('mp4') ? 'm4a' : 'mp3';
    const formData = new FormData();
    formData.append('audio', blob, `recording.${ext}`);
    formData.append('sessionId', dbSessionId);
    formData.append('turnIndex', String(turnIndex));
    formData.append('role', role);

    const response = await fetch('/api/upload-audio', { method: 'POST', body: formData });
    if (!response.ok) return null;
    const data = await response.json();
    return data.audioUrl || null;
  } catch (err) {
    console.error('Audio upload failed:', err);
    return null;
  }
}

/* ── 턴 DB 저장 헬퍼 ── */
async function saveTurnToDb(
  dbSessionId: string,
  turnIndex: number,
  role: 'ai' | 'parent',
  text: string,
  audioUrl?: string | null
) {
  try {
    await supabase.from('session_turns').insert([{
      session_id: dbSessionId,
      turn_index: turnIndex,
      role,
      text,
      audio_url: audioUrl || null,
    }]);
  } catch (err) {
    console.error('Turn save failed:', err);
  }
}

export default function SessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const questionId = typeof params.sessionId === 'string' ? params.sessionId : '';
  const nameParam = searchParams.get('name') || PARENT_NAME;

  const [dbQuestion, setDbQuestion] = useState<any>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  /* ── DB 세션 ID (sessions 테이블의 row) ── */
  const [dbSessionId, setDbSessionId] = useState<string | null>(null);
  const turnIndexRef = useRef(0);

  /* ── 꼬리질문 템플릿 ── */
  const [followUpTemplates, setFollowUpTemplates] = useState<FollowUpTemplate[]>([]);
  const [usedFollowUpIndices, setUsedFollowUpIndices] = useState<number[]>([]);

  /* ── 사진 업로드 ── */
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<SessionState>({
    sessionId: questionId,
    parentName: nameParam,
    topic: '추억 이야기',
    currentQuestionId: questionId,
    turns: [],
    currentTurn: 0,
    maxTurns: MAX_PARENT_TURNS * 2,
    status: 'greeting',
  });

  const [errorMessage, setErrorMessage] = useState('');
  const [processingStep, setProcessingStep] = useState('');

  const sessionRef = useRef<RecordingSession | null>(null);
  const [recordingStatus, setRecordingStatus] = useState(false);
  const parentTurnCount = useRef(0);

  /* ── 마지막 녹음된 blob 보관 (Storage 업로드용) ── */
  const lastRecordedBlobRef = useRef<Blob | null>(null);

  /* ══════════════ 질문 + 꼬리질문 로드 ══════════════ */
  useEffect(() => {
    if (!questionId) return;
    const fetchQuestion = async () => {
      try {
        const { data, error } = await supabase
          .from('questions').select('*').eq('id', questionId).single();
        if (error) {
          console.error(error);
          setErrorMessage('질문을 찾을 수 없거나 데이터베이스 연결이 없습니다.');
        }
        if (data) {
          setDbQuestion(data);
          if (data.recipient_name) {
            setSession(prev => ({ ...prev, parentName: data.recipient_name }));
          }
        }
        const { data: fuData, error: fuError } = await supabase
          .from('follow_up_templates').select('*')
          .eq('question_id', questionId)
          .order('sort_order', { ascending: true });
        if (!fuError && fuData) {
          setFollowUpTemplates(fuData as FollowUpTemplate[]);
        }
      } catch (err) { console.error(err); }
      finally { setLoadingInitial(false); }
    };
    fetchQuestion();
  }, [questionId]);

  /* ══════════════ 세션 시작 ══════════════ */
  const handleStartSession = useCallback(async () => {
    // DB에 세션 row 생성
    try {
      const insertObj: any = {
        question_id: questionId,
        status: 'in_progress',
      };
      if (dbQuestion?.person_id) insertObj.person_id = dbQuestion.person_id;

      const { data, error } = await supabase
        .from('sessions').insert([insertObj]).select();
      if (error) {
        console.error('Session creation failed:', error);
      } else if (data && data[0]) {
        setDbSessionId(data[0].id);
      }
    } catch (err) { console.error(err); }

    setSession(prev => ({ ...prev, status: 'waiting_answer' }));
  }, [questionId, dbQuestion]);

  /* ══════════════ 녹음 시작/중지 ══════════════ */
  const handleRecord = async () => {
    if (recordingStatus && sessionRef.current) {
      setProcessingStep('말씀을 들었습니다. 텍스트로 정리하는 중입니다...');
      setRecordingStatus(false);
      try {
        const audioBlob = await stopRecording(sessionRef.current);
        sessionRef.current = null;

        // blob을 보관해둠 (나중에 Storage 업로드)
        lastRecordedBlobRef.current = audioBlob;

        const ext = getFileExtension(audioBlob.type);
        const formData = new FormData();
        formData.append('audio', audioBlob, `recording.${ext}`);
        const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '음성 변환에 실패했습니다.');

        handleAnswerSubmit(data.text);
      } catch (err: any) {
        setErrorMessage(err.message || '음성을 처리하는데 실패했습니다.');
        setSession(prev => ({ ...prev, status: 'waiting_answer' }));
        setProcessingStep('');
        lastRecordedBlobRef.current = null;
      }
      return;
    }

    try {
      setErrorMessage('');
      lastRecordedBlobRef.current = null;
      const audioSession = await startRecording();
      sessionRef.current = audioSession;
      setRecordingStatus(true);
    } catch (err) {
      console.error(err);
      setErrorMessage('마이크를 사용할 수 없습니다. 권한을 허용해주세요!');
    }
  };

  /* ══════════════ 답변 처리 (핵심 로직) ══════════════ */
  const handleAnswerSubmit = async (textAnswer: string) => {
    setSession(prev => ({ ...prev, status: 'processing' }));
    setErrorMessage('');
    setProcessingStep('이야기를 곱씹고 저장하고 있어요...');

    try {
      // 1) 사용자 음성 Storage 업로드 (blob이 있을 때만)
      let parentAudioUrl: string | null = null;
      if (lastRecordedBlobRef.current && dbSessionId) {
        parentAudioUrl = await uploadAudioBlob(
          lastRecordedBlobRef.current,
          dbSessionId,
          turnIndexRef.current,
          'parent'
        );
      }
      lastRecordedBlobRef.current = null;

      // 2) 사용자 턴 DB 저장
      if (dbSessionId) {
        await saveTurnToDb(dbSessionId, turnIndexRef.current, 'parent', textAnswer, parentAudioUrl);
      }

      // 3) 레거시 responses에도 저장 (하위 호환)
      await supabase.from('responses').insert([{ question_id: questionId, answer: textAnswer, audio_url: parentAudioUrl }]);

      // 4) 클라이언트 상태 업데이트
      const parentTurn: Turn = { role: 'parent', text: textAnswer, audioUrl: parentAudioUrl || undefined, timestamp: new Date() };
      parentTurnCount.current += 1;
      turnIndexRef.current += 1;
      const updatedTurns = [...session.turns, parentTurn];
      setSession(prev => ({ ...prev, turns: updatedTurns, currentTurn: prev.currentTurn + 1 }));

      // 5) LLM 꼬리질문 생성
      const isLastTurn = parentTurnCount.current >= MAX_PARENT_TURNS;
      setProcessingStep(isLastTurn ? '마무리 인사를 준비하고 있어요...' : '새로운 질문을 만들고 있어요...');

      const prompt = isLastTurn
        ? buildClosingPrompt(session.parentName, updatedTurns)
        : buildInterviewPrompt(
            session.parentName, session.topic,
            dbQuestion?.content?.text || '', updatedTurns,
            followUpTemplates.length > 0 ? followUpTemplates : undefined,
            usedFollowUpIndices.length > 0 ? usedFollowUpIndices : undefined
          );

      const llmResponse = await fetch('/api/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const llmData = await llmResponse.json();
      if (!llmResponse.ok) throw new Error(llmData.error || '질문 생성에 실패했습니다.');

      // 꼬리질문 추적
      if (!isLastTurn && followUpTemplates.length > 0) {
        const nextIdx = usedFollowUpIndices.length;
        if (nextIdx < followUpTemplates.length) {
          setUsedFollowUpIndices(prev => [...prev, nextIdx]);
        }
      }

      // 6) TTS 생성 + Storage 업로드 + 재생
      setProcessingStep('AI 음성을 준비하고 있어요...');
      const ttsRes = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: llmData.text }),
      });

      const ttsBlob = await ttsRes.blob();

      // AI 음성 Storage 업로드
      let aiAudioUrl: string | null = null;
      if (dbSessionId) {
        aiAudioUrl = await uploadAudioBlob(ttsBlob, dbSessionId, turnIndexRef.current, 'ai');
      }

      // AI 턴 DB 저장
      if (dbSessionId) {
        await saveTurnToDb(dbSessionId, turnIndexRef.current, 'ai', llmData.text, aiAudioUrl);
      }

      const aiTurn: Turn = { role: 'ai', text: llmData.text, audioUrl: aiAudioUrl || undefined, timestamp: new Date() };
      turnIndexRef.current += 1;
      setSession(prev => ({ ...prev, turns: [...prev.turns, aiTurn], status: 'asking' }));
      setProcessingStep('');

      // 브라우저에서 재생
      const audioUrl = URL.createObjectURL(ttsBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        if (isLastTurn && dbSessionId) {
          // 세션 완료 처리
          supabase.from('sessions').update({ status: 'completed' }).eq('id', dbSessionId).then(() => {});
        }
        setSession(prev => ({ ...prev, status: isLastTurn ? 'completed' : 'waiting_answer' }));
      };
      audio.play().catch(console.error);

    } catch (err: any) {
      console.error(err);
      setErrorMessage('오류가 발생했어요. 다시 시도해주세요.');
      setSession(prev => ({ ...prev, status: 'waiting_answer' }));
      setProcessingStep('');
    }
  };

  /* ══════════════ 사진 업로드 ══════════════ */
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setPhotoUploading(true);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const ext = file.name.split('.').pop();
        const fileName = `${questionId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('photos').upload(fileName, file, { cacheControl: '3600', upsert: false });
        if (error) { console.error('사진 업로드 실패:', error); continue; }
        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName);
        if (urlData?.publicUrl) newUrls.push(urlData.publicUrl);
      } catch (err) { console.error(err); }
    }
    if (newUrls.length > 0) {
      setUploadedPhotos(prev => [...prev, ...newUrls]);
      try {
        const { data: latestResp } = await supabase
          .from('responses').select('id, photo_urls')
          .eq('question_id', questionId).order('created_at', { ascending: false }).limit(1).single();
        if (latestResp) {
          const existing = latestResp.photo_urls || [];
          await supabase.from('responses').update({ photo_urls: [...existing, ...newUrls] }).eq('id', latestResp.id);
        }
      } catch (err) { console.error(err); }
    }
    setPhotoUploading(false);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  /* ══════════════ 빠른 테스트 ══════════════ */
  const handleFastForwardComplete = useCallback(async () => {
    setProcessingStep('빠른 테스트(4턴) 자동 진행 중...');
    setSession(prev => ({ ...prev, status: 'processing' }));
    const mockTurns: Turn[] = [
      { role: 'ai', text: '테스트: 첫 인사를 드립니다.', timestamp: new Date() },
      { role: 'parent', text: '네, 정말 좋았던 기억입니다.', timestamp: new Date() },
      { role: 'ai', text: '그렇군요. 어떤 감정이 드셨나요?', timestamp: new Date() },
      { role: 'parent', text: '참 따뜻하고 즐거웠습니다.', timestamp: new Date() },
      { role: 'ai', text: '특별한 감정이군요. 비슷한 순간이 있으신가요?', timestamp: new Date() },
      { role: 'parent', text: '가끔 가족과 밥 먹을 때요.', timestamp: new Date() },
      { role: 'ai', text: '소중한 이야기 잘 들었습니다. 마지막으로 하실 말씀은?', timestamp: new Date() },
      { role: 'parent', text: '여기까지 할게요, 감사합니다.', timestamp: new Date() }
    ];
    try {
      if (questionId) {
        await supabase.from('responses').insert([{ question_id: questionId, answer: '빠른 전체 스킵 테스트' }]);
      }
    } catch(err) {}
    parentTurnCount.current = 4;
    if (dbSessionId) {
      await supabase.from('sessions').update({ status: 'completed' }).eq('id', dbSessionId);
    }
    setSession(prev => ({ ...prev, turns: mockTurns, status: 'completed', currentTurn: 8 }));
    setProcessingStep('');
  }, [questionId, dbSessionId]);

  /* ══════════════ 렌더링 ══════════════ */

  if (loadingInitial) {
    return <main className="min-h-screen bg-warm-cream flex flex-col items-center justify-center p-10"><p className="text-deep-brown">로딩 중입니다...</p></main>;
  }

  if (!dbQuestion && errorMessage) {
    return <main className="min-h-screen bg-warm-cream flex flex-col items-center justify-center p-10"><p className="text-red-700 font-bold">{errorMessage}</p><p className="mt-4 text-sm text-light-taupe">Supabase 테이블 생성 및 .env 변수를 확인해주세요.</p></main>;
  }

  return (
    <main className="min-h-screen bg-warm-cream flex flex-col items-center py-10 px-4 font-sans text-deep-brown">
      <header className="mb-8 text-center pt-8">
        <div className="w-10 h-px bg-light-taupe mx-auto mb-3" />
        <h1 className="text-4xl font-extrabold text-deep-brown tracking-tight mb-2">기록하다</h1>
        <p className="text-light-taupe font-medium text-base tracking-wide">부모님의 이야기를 AI가 기록합니다</p>
        <div className="w-10 h-px bg-light-taupe mx-auto mt-3" />
      </header>

      <section className="w-full max-w-2xl bg-warm-white shadow-xl rounded-2xl overflow-hidden flex flex-col border border-light-taupe min-h-[500px]">
        {session.status === 'greeting' && (
          <div className="p-10 text-center flex flex-col items-center flex-1 justify-center">
            <h2 className="text-3xl font-bold mb-4 text-deep-brown">{session.parentName}님, 안녕하세요.</h2>
            <p className="text-deep-brown/70 text-lg mb-8 max-w-md leading-relaxed">
              가족이 남긴 특별한 질문이 도착했습니다.<br/>아래 버튼을 눌러 이야기를 시작해보세요!
            </p>
            <button onClick={handleStartSession} className="px-10 py-4 bg-deep-brown text-warm-white font-bold text-xl rounded-xl hover:bg-deep-brown/85 transition shadow-lg w-full sm:w-auto flex items-center justify-center gap-2">
              <span>🎙️</span> 오늘의 대화 시작하기
            </button>
          </div>
        )}

        {(session.status === 'waiting_answer' || session.status === 'processing' || session.status === 'asking') && (
          <div className="flex-1 flex flex-col">
            {parentTurnCount.current === 0 && dbQuestion && (
              <div className="border-b border-light-taupe bg-warm-cream p-4">
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
              {processingStep && <div className="text-sm text-light-taupe text-center animate-pulse mt-4 font-medium">{processingStep}</div>}
              {session.status === 'asking' && <div className="text-sm text-soft-gold font-bold text-center animate-pulse mt-4">AI가 말씀드리고 있습니다...</div>}
            </div>

            {parentTurnCount.current > 0 && (
               <div className="p-6 bg-warm-cream border-t border-light-taupe flex flex-col items-center justify-center gap-2">
                 {session.status === 'processing' || session.status === 'asking' ? (
                    <p className="text-sm text-deep-brown/60 font-medium text-center">잠시만 기다려주세요...</p>
                 ) : (
                    <>
                      <button
                        onClick={handleRecord}
                        className={`w-28 h-28 rounded-full flex flex-col items-center justify-center text-warm-white shadow-lg transition-all ${recordingStatus ? 'bg-red-600 animate-pulse' : 'bg-deep-brown hover:bg-deep-brown/85'}`}
                      >
                        <span className="text-3xl mb-1">{recordingStatus ? "🔴" : "🎤"}</span>
                        <span className="font-bold text-sm">{recordingStatus ? "마치기" : "말씀하기"}</span>
                      </button>
                      <p className="text-sm text-deep-brown/60 font-medium text-center mt-3">
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
            <h3 className="text-2xl font-bold mb-4 text-deep-brown">모든 대화가 무사히 기록되었습니다.</h3>
            <p className="text-deep-brown/70 text-lg mb-6 leading-relaxed">
              소중한 이야기를 들려주셔서 대단히 감사합니다.<br/>멋진 자서전의 한 페이지가 완성되었어요!
            </p>

            {dbQuestion?.photo_request && (
              <div className="w-full max-w-md bg-warm-cream rounded-2xl border border-light-taupe p-6 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Camera size={20} className="text-soft-gold" />
                  <h4 className="font-bold text-deep-brown">추억 사진을 남겨주세요</h4>
                </div>
                <p className="text-sm text-deep-brown/60 mb-4 leading-relaxed">📸 {dbQuestion.photo_request}</p>

                {uploadedPhotos.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-4">
                    {uploadedPhotos.map((url, i) => (
                      <div key={i} className="relative group">
                        <img src={url} alt={`업로드된 사진 ${i + 1}`} className="w-20 h-20 object-cover rounded-xl border border-light-taupe shadow-sm" />
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={() => photoInputRef.current?.click()} disabled={photoUploading}
                  className="w-full py-3 bg-warm-white border-2 border-dashed border-light-taupe rounded-xl text-deep-brown font-bold hover:bg-warm-cream transition flex items-center justify-center gap-2 disabled:opacity-50">
                  {photoUploading ? <>⏳ 업로드 중...</> : <><Upload size={18} /> 사진 선택하기</>}
                </button>
                <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                {uploadedPhotos.length > 0 && (
                  <p className="text-xs text-muted-sage mt-2 font-medium flex items-center gap-1 justify-center">
                    <Check size={14} /> {uploadedPhotos.length}장의 사진이 저장되었습니다
                  </p>
                )}
              </div>
            )}

            <Link href="/" className="px-8 py-3 bg-warm-cream text-deep-brown font-bold rounded-xl hover:bg-light-taupe/30 transition border border-light-taupe">
              처음으로 돌아가기
            </Link>
          </div>
        )}
      </section>

      {session.status !== 'greeting' && session.status !== 'completed' && (
        <div className="fixed bottom-4 right-4 flex flex-col items-end gap-3 z-50">
          {process.env.NODE_ENV === 'development' && (
            <button onClick={handleFastForwardComplete} className="px-5 py-2 bg-gray-800 text-white text-xs font-semibold rounded-full shadow-lg hover:bg-black transition border border-gray-600"
              disabled={session.status === 'processing' || session.status === 'asking'}>
               ⏩ 빠른 테스트 완료 (4턴)
            </button>
          )}
        </div>
      )}
    </main>
  );
}
