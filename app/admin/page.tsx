"use client";

import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, MessageSquare, Image as ImageIcon, Check, Copy, ChevronUp, Mic, Trash2, AlertTriangle, X, Eye, ZoomIn } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/* ─────────────── 타입 정의 ─────────────── */
interface Question {
  id: string;
  type: string;
  content: { text: string; photoUrl?: string; prefixText?: string; suffixText?: string };
  recipient_name?: string;
  is_deleted?: boolean;
  created_at: string;
}

interface Response {
  id: string;
  question_id: string;
  answer: string;
  created_at: string;
}

/* ─────────────── 컴포넌트 ─────────────── */
export default function AdminPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 답변 열람
  const [viewingResponsesId, setViewingResponsesId] = useState<string | null>(null);
  const [questionResponses, setQuestionResponses] = useState<Response[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);

  // 모달 상태
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);

  // 질문 생성 폼
  const [showForm, setShowForm] = useState(false);
  const [newQuestionType, setNewQuestionType] = useState('open_ended');
  const [newQuestionContent, setNewQuestionContent] = useState('');
  const [recipientName, setRecipientName] = useState('');

  // 사진 업로드
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ──── 질문 목록 가져오기 ──── */
  useEffect(() => { fetchQuestions(); }, []);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('created_at', { ascending: false });
      if (error) console.error(error);
      else if (data) setQuestions(data as Question[]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  /* ──── 사진 업로드 ──── */
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile) return null;
    setUploading(true);
    const ext = photoFile.name.split('.').pop();
    const fileName = `${Date.now()}_photo.${ext}`;
    const { error } = await supabase.storage
      .from('photos')
      .upload(fileName, photoFile, { cacheControl: '3600', upsert: false });
    setUploading(false);
    if (error) {
      alert('사진 업로드 실패: ' + error.message + '\n\nSupabase Dashboard > Storage에서 "photos" 버킷(Public)을 확인해주세요!');
      return null;
    }
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName);
    return urlData?.publicUrl || null;
  };

  /* ──── 질문 생성 ──── */
  const handleCreateQuestion = async () => {
    if (!newQuestionContent || !recipientName.trim()) {
      alert('대상자 이름과 질문 내용을 모두 입력해주세요.');
      return;
    }
    let contentObj: any = { text: newQuestionContent };
    if (newQuestionType === 'photo_based') {
      if (!photoFile) { alert('사진 기반 질문에는 사진을 첨부해주세요.'); return; }
      const photoUrl = await uploadPhoto();
      if (!photoUrl) return;
      contentObj.photoUrl = photoUrl;
    } else if (newQuestionType === 'fill_in_the_blank') {
      contentObj.prefixText = "내가 살면서 가장";
      contentObj.suffixText = "순간이었다.";
    }
    try {
      const { data, error } = await supabase
        .from('questions')
        .insert([{ type: newQuestionType, content: contentObj, recipient_name: recipientName.trim() }])
        .select();
      if (error) throw error;
      if (data) {
        setQuestions([data[0] as Question, ...questions]);
        resetForm();
      }
    } catch (err: any) { alert("질문 생성 실패: " + err.message); }
  };

  const resetForm = () => {
    setShowForm(false);
    setNewQuestionContent('');
    setRecipientName('');
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  /* ──── 링크 복사 ──── */
  const copyLink = (id: string, name: string) => {
    const link = `${window.location.origin}/session/${id}?name=${encodeURIComponent(name)}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /* ──── 답변 조회 ──── */
  const toggleResponses = async (questionId: string) => {
    if (viewingResponsesId === questionId) {
      setViewingResponsesId(null);
      setQuestionResponses([]);
      return;
    }
    setViewingResponsesId(questionId);
    setResponsesLoading(true);
    try {
      const { data, error } = await supabase
        .from('responses')
        .select('*')
        .eq('question_id', questionId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setQuestionResponses((data || []) as Response[]);
    } catch (err) { console.error(err); }
    finally { setResponsesLoading(false); }
  };

  /* ──── 소프트 삭제 ──── */
  const handleSoftDelete = async (questionId: string) => {
    try {
      await supabase.from('responses').delete().eq('question_id', questionId);
      const { error } = await supabase.from('questions').update({ is_deleted: true }).eq('id', questionId);
      if (error) throw error;
      setQuestions(prev => prev.filter(q => q.id !== questionId));
      setDeletingId(null);
      if (viewingResponsesId === questionId) {
        setViewingResponsesId(null);
        setQuestionResponses([]);
      }
    } catch (err: any) { alert("삭제 실패: " + err.message); }
  };

  /* ──── 유형 라벨 (가독성용) ──── */
  const typeLabel = (type: string) => {
    if (type === 'photo_based') return { icon: <ImageIcon size={12} />, text: '사진' };
    if (type === 'fill_in_the_blank') return { icon: <MessageSquare size={12} />, text: '빈칸' };
    return { icon: <Mic size={12} />, text: '음성' };
  };

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <div className="max-w-5xl mx-auto p-4 py-8 space-y-6">

      {/* ──── 사진 원본 보기 모달 ──── */}
      {viewingPhotoUrl && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setViewingPhotoUrl(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setViewingPhotoUrl(null)}
              className="absolute -top-4 -right-4 z-10 w-10 h-10 rounded-full bg-white text-gray-800 flex items-center justify-center shadow-xl hover:bg-gray-100 transition"
            >
              <X size={20} />
            </button>
            <img
              src={viewingPhotoUrl}
              alt="원본 사진"
              className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* ──── 삭제 확인 모달 ──── */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDeletingId(null)}>
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangle size={22} className="text-red-500" /></div>
              <h3 className="text-lg font-bold text-gray-800">정말 삭제하시겠어요?</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              이 질문에 대한 <b>모든 답변 내역이 함께 삭제</b>됩니다.<br/>
              질문 자체는 DB에서 비활성 처리되어 나중에 복구할 수 있습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletingId(null)} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition">취소</button>
              <button onClick={() => handleSoftDelete(deletingId)} className="px-5 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition shadow-md">삭제 확인</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ 메인 카드 ══════ */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">

        {/* 헤더 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">관리자 대시보드</h2>
            <p className="text-gray-500 mt-2">대상자별로 질문 링크를 보내고 남기신 답변을 관리합니다.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-[#2F6F4F] text-white px-5 py-3 rounded-xl hover:bg-[#23533b] transition font-bold shadow-md whitespace-nowrap"
          >
            <PlusCircle size={20} /> 새 링크 발급하기
          </button>
        </div>

        {/* ──────── 질문 생성 폼 ──────── */}
        {showForm && (
          <div className="mb-8 bg-[#f9fdfa] p-6 rounded-2xl border border-[#2F6F4F]/20">
            <h3 className="text-lg font-bold text-gray-800 mb-4">새 질문 만들기</h3>
            <div className="flex flex-col gap-5">
              {/* 대상자 이름 */}
              <div>
                <label className="block text-sm text-gray-600 mb-2 font-bold">대상자 이름 (필수)</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-xl bg-white focus:outline-none focus:border-[#2F6F4F] transition shadow-sm text-gray-800 font-medium"
                  placeholder="예: 어머니, 할머니, 아버지, 김순자 등"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>
              {/* 유형 */}
              <div>
                <label className="block text-sm text-gray-600 mb-2 font-bold">질문 유형 선택</label>
                <select
                  className="w-full p-3 border border-gray-300 rounded-xl bg-white focus:outline-none focus:border-[#2F6F4F] transition shadow-sm font-medium text-gray-700"
                  value={newQuestionType}
                  onChange={(e) => { setNewQuestionType(e.target.value); setPhotoFile(null); setPhotoPreview(null); }}
                >
                  <option value="open_ended">🎙️ 음성 대화 (개방형)</option>
                  <option value="photo_based">📷 사진 기반 질문</option>
                  <option value="fill_in_the_blank">✏️ 빈칸 채우기</option>
                </select>
              </div>
              {/* 사진 업로드 */}
              {newQuestionType === 'photo_based' && (
                <div>
                  <label className="block text-sm text-gray-600 mb-2 font-bold">📷 사진 첨부</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-[#2F6F4F] hover:bg-[#f0f9f4] transition"
                  >
                    {photoPreview ? (
                      <div className="relative">
                        <img src={photoPreview} alt="미리보기" className="max-h-48 mx-auto rounded-lg shadow-md" />
                        <p className="text-xs text-gray-400 mt-3">클릭하여 다른 사진으로 교체</p>
                      </div>
                    ) : (
                      <div>
                        <ImageIcon size={36} className="mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500 font-medium">클릭하여 추억 사진을 선택하세요</p>
                        <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP 지원</p>
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                </div>
              )}
              {/* 질문 내용 */}
              <div>
                <label className="block text-sm text-gray-600 mb-2 font-bold">대상자에게 표시될 주요 질문</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-xl bg-white focus:outline-none focus:border-[#2F6F4F] transition shadow-sm text-gray-800 font-medium"
                  placeholder="예: 어머니, 가을에 가장 생각나는 추억은 무엇인가요?"
                  value={newQuestionContent}
                  onChange={(e) => setNewQuestionContent(e.target.value)}
                />
              </div>
              <button
                onClick={handleCreateQuestion}
                disabled={uploading}
                className="self-end bg-gray-800 text-white px-8 py-3 rounded-xl hover:bg-gray-900 transition font-bold shadow-md mt-2 disabled:opacity-50"
              >
                {uploading ? '사진 업로드 중...' : '저장 후 링크 생성'}
              </button>
            </div>
          </div>
        )}

        {/* ──────── 질문 카드 리스트 ──────── */}
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="text-center py-12 text-gray-500 font-medium">데이터를 불러오는 중...</div>
          ) : questions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 font-medium">발급된 질문 링크가 없어요. 위 버튼을 눌러 첫 링크를 만들어보세요!</div>
          ) : questions.map((q) => {
            const label = typeLabel(q.type);
            return (
              <div key={q.id} className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden bg-white">
                {/* 질문 요약 카드 */}
                <div className="p-5 flex flex-col sm:flex-row gap-4">
                  {/* 왼쪽: 사진 썸네일 또는 아이콘 */}
                  <div className="flex-shrink-0">
                    {q.content?.photoUrl ? (
                      <div
                        className="relative w-24 h-20 rounded-xl overflow-hidden border border-gray-200 shadow-sm cursor-pointer group"
                        onClick={() => setViewingPhotoUrl(q.content.photoUrl!)}
                      >
                        <img src={q.content.photoUrl} alt="첨부 사진" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <ZoomIn size={20} className="text-white drop-shadow-lg" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-[#eef5f0] flex items-center justify-center">
                        {q.type === 'open_ended' ? <Mic size={22} className="text-[#2F6F4F]" /> : <MessageSquare size={22} className="text-[#2F6F4F]" />}
                      </div>
                    )}
                  </div>

                  {/* 가운데: 질문 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-bold text-gray-800 text-lg">{q.recipient_name || '어르신'}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold text-[#2F6F4F] bg-[#eef5f0]">
                        {label.icon} {label.text}
                      </span>
                    </div>
                    <p className="text-gray-700 font-medium leading-snug">{q.content?.text}</p>
                    <p className="text-[11px] text-gray-400 mt-2">생성: {new Date(q.created_at).toLocaleString('ko-KR')}</p>
                  </div>

                  {/* 오른쪽: 버튼 그룹 */}
                  <div className="flex sm:flex-col gap-2 items-start sm:items-end flex-shrink-0">
                    <button
                      onClick={() => copyLink(q.id, q.recipient_name || '어르신')}
                      className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors w-28 ${
                        copiedId === q.id
                          ? 'bg-[#eef5f0] text-[#2F6F4F] border border-[#2F6F4F]/20'
                          : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {copiedId === q.id ? <><Check size={14} /> 복사 완료</> : <><Copy size={14} /> 링크 복사</>}
                    </button>
                    <button
                      onClick={() => toggleResponses(q.id)}
                      className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors w-28 ${
                        viewingResponsesId === q.id
                          ? 'bg-gray-800 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {viewingResponsesId === q.id ? <><ChevronUp size={14} /> 닫기</> : <><Eye size={14} /> 답변 보기</>}
                    </button>
                    <button
                      onClick={() => setDeletingId(q.id)}
                      className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors w-28 border border-transparent hover:border-red-200"
                    >
                      <Trash2 size={14} /> 삭제
                    </button>
                  </div>
                </div>

                {/* ──── 답변 내역 패널 (Accordion) ──── */}
                {viewingResponsesId === q.id && (
                  <div className="border-t border-gray-100 bg-gray-50/60 p-5">
                    <div className="ml-2 pl-4 border-l-4 border-[#2F6F4F]/30">
                      <h4 className="text-sm font-bold text-[#2F6F4F] mb-4 flex items-center gap-2">
                        <MessageSquare size={16} />
                        {q.recipient_name || '어르신'}님이 남기신 이야기
                      </h4>
                      {responsesLoading ? (
                        <p className="text-sm text-gray-500 py-4">불러오는 중...</p>
                      ) : questionResponses.length === 0 ? (
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm inline-block">
                          <p className="text-sm text-gray-400 font-medium">아직 수집된 답변이 없어요. 링크를 전달해보세요!</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {questionResponses.map((res, i) => (
                            <div key={res.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative">
                              <div className="absolute top-5 left-5 w-7 h-7 rounded-full bg-[#eef5f0] text-[#2F6F4F] flex items-center justify-center text-xs font-bold ring-2 ring-white">
                                {i + 1}
                              </div>
                              <div className="pl-10">
                                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-[15px]">{res.answer}</p>
                                <p className="text-[11px] text-gray-400 mt-3 font-medium">{new Date(res.created_at).toLocaleString('ko-KR')}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
