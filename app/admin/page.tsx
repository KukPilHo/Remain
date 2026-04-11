"use client";

import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, MessageSquare, Image as ImageIcon, Check, Copy, ChevronUp, ChevronDown, Mic, Trash2, AlertTriangle, X, Eye, ZoomIn, Users, UserPlus, List, Plus, GripVertical } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Person, FollowUpTemplate } from '@/types';

/* ─────────────── 타입 정의 ─────────────── */
interface Question {
  id: string;
  type: string;
  content: { text: string; photoUrl?: string; prefixText?: string; suffixText?: string };
  recipient_name?: string;
  person_id?: string;
  photo_request?: string;
  purpose?: string;
  is_deleted?: boolean;
  created_at: string;
}

interface Response {
  id: string;
  question_id: string;
  answer: string;
  photo_urls?: string[];
  created_at: string;
}

/* ─────────────── 컴포넌트 ─────────────── */
export default function AdminPage() {
  /* ── 사람 관리 ── */
  const [persons, setPersons] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonDesc, setNewPersonDesc] = useState('');

  /* ── 질문 관리 ── */
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /* ── 답변 열람 ── */
  const [viewingResponsesId, setViewingResponsesId] = useState<string | null>(null);
  const [questionResponses, setQuestionResponses] = useState<Response[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);

  /* ── 꼬리질문 열람 ── */
  const [viewingFollowUpsId, setViewingFollowUpsId] = useState<string | null>(null);
  const [followUpTemplates, setFollowUpTemplates] = useState<FollowUpTemplate[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);

  /* ── 모달 상태 ── */
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);

  /* ── 질문 생성 폼 ── */
  const [showForm, setShowForm] = useState(false);
  const [newQuestionType, setNewQuestionType] = useState('open_ended');
  const [newQuestionContent, setNewQuestionContent] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [newPurpose, setNewPurpose] = useState('');
  const [newPhotoRequest, setNewPhotoRequest] = useState('');

  /* ── 꼬리질문 폼 ── */
  const [newFollowUps, setNewFollowUps] = useState<{ text: string; guide: string }[]>([]);

  /* ── 사진 업로드 ── */
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ══════════════ 데이터 로드 ══════════════ */
  useEffect(() => { fetchPersons(); fetchQuestions(); }, []);

  const fetchPersons = async () => {
    try {
      const { data, error } = await supabase
        .from('persons')
        .select('*')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('created_at', { ascending: true });
      if (error) console.error(error);
      else if (data) setPersons(data as Person[]);
    } catch (err) { console.error(err); }
  };

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

  /* ══════════════ 사람 관리 ══════════════ */
  const handleCreatePerson = async () => {
    if (!newPersonName.trim()) { alert('이름을 입력해주세요.'); return; }
    try {
      const { data, error } = await supabase
        .from('persons')
        .insert([{ name: newPersonName.trim(), description: newPersonDesc.trim() || null }])
        .select();
      if (error) throw error;
      if (data) {
        setPersons(prev => [...prev, data[0] as Person]);
        setNewPersonName('');
        setNewPersonDesc('');
        setShowPersonForm(false);
        setSelectedPersonId(data[0].id);
      }
    } catch (err: any) { alert('대상자 생성 실패: ' + err.message); }
  };

  const handleDeletePerson = async (personId: string) => {
    try {
      const { error } = await supabase.from('persons').update({ is_deleted: true }).eq('id', personId);
      if (error) throw error;
      setPersons(prev => prev.filter(p => p.id !== personId));
      if (selectedPersonId === personId) setSelectedPersonId(null);
    } catch (err: any) { alert('삭제 실패: ' + err.message); }
  };

  /* ══════════════ 사진 업로드 ══════════════ */
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

  /* ══════════════ 질문 생성 ══════════════ */
  const handleCreateQuestion = async () => {
    if (!newQuestionContent.trim()) {
      alert('질문 내용을 입력해주세요.');
      return;
    }
    // 대상자 이름: 선택된 사람 or 직접 입력
    const finalName = selectedPersonId
      ? persons.find(p => p.id === selectedPersonId)?.name || recipientName.trim()
      : recipientName.trim();
    if (!finalName) {
      alert('대상자를 선택하거나 이름을 입력해주세요.');
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
      const insertObj: any = {
        type: newQuestionType,
        content: contentObj,
        recipient_name: finalName,
      };
      if (selectedPersonId) insertObj.person_id = selectedPersonId;
      if (newPurpose.trim()) insertObj.purpose = newPurpose.trim();
      if (newPhotoRequest.trim()) insertObj.photo_request = newPhotoRequest.trim();

      const { data, error } = await supabase
        .from('questions')
        .insert([insertObj])
        .select();
      if (error) throw error;

      if (data && data[0]) {
        // 꼬리질문 저장
        if (newFollowUps.length > 0) {
          const followUpsToInsert = newFollowUps
            .filter(fu => fu.text.trim())
            .map((fu, i) => ({
              question_id: data[0].id,
              sort_order: i,
              follow_up_text: fu.text.trim(),
              guide_note: fu.guide.trim() || null,
            }));
          if (followUpsToInsert.length > 0) {
            const { error: fuError } = await supabase
              .from('follow_up_templates')
              .insert(followUpsToInsert);
            if (fuError) console.error('꼬리질문 저장 실패:', fuError);
          }
        }
        setQuestions([data[0] as Question, ...questions]);
        resetForm();
      }
    } catch (err: any) { alert("질문 생성 실패: " + err.message); }
  };

  const resetForm = () => {
    setShowForm(false);
    setNewQuestionContent('');
    setRecipientName('');
    setNewPurpose('');
    setNewPhotoRequest('');
    setPhotoFile(null);
    setPhotoPreview(null);
    setNewFollowUps([]);
  };

  /* ══════════════ 꼬리질문 폼 ══════════════ */
  const addFollowUpField = () => {
    setNewFollowUps(prev => [...prev, { text: '', guide: '' }]);
  };

  const updateFollowUp = (index: number, field: 'text' | 'guide', value: string) => {
    setNewFollowUps(prev => prev.map((fu, i) => i === index ? { ...fu, [field]: value } : fu));
  };

  const removeFollowUp = (index: number) => {
    setNewFollowUps(prev => prev.filter((_, i) => i !== index));
  };

  /* ══════════════ 링크 복사 ══════════════ */
  const copyLink = (id: string, name: string) => {
    const link = `${window.location.origin}/session/${id}?name=${encodeURIComponent(name)}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /* ══════════════ 답변 조회 ══════════════ */
  const toggleResponses = async (questionId: string) => {
    if (viewingResponsesId === questionId) {
      setViewingResponsesId(null);
      setQuestionResponses([]);
      return;
    }
    setViewingResponsesId(questionId);
    setViewingFollowUpsId(null);
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

  /* ══════════════ 꼬리질문 조회 ══════════════ */
  const toggleFollowUps = async (questionId: string) => {
    if (viewingFollowUpsId === questionId) {
      setViewingFollowUpsId(null);
      setFollowUpTemplates([]);
      return;
    }
    setViewingFollowUpsId(questionId);
    setViewingResponsesId(null);
    setFollowUpsLoading(true);
    try {
      const { data, error } = await supabase
        .from('follow_up_templates')
        .select('*')
        .eq('question_id', questionId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setFollowUpTemplates((data || []) as FollowUpTemplate[]);
    } catch (err) { console.error(err); }
    finally { setFollowUpsLoading(false); }
  };

  /* ══════════════ 소프트 삭제 ══════════════ */
  const handleSoftDelete = async (questionId: string) => {
    try {
      await supabase.from('responses').delete().eq('question_id', questionId);
      await supabase.from('follow_up_templates').delete().eq('question_id', questionId);
      const { error } = await supabase.from('questions').update({ is_deleted: true }).eq('id', questionId);
      if (error) throw error;
      setQuestions(prev => prev.filter(q => q.id !== questionId));
      setDeletingId(null);
      if (viewingResponsesId === questionId) { setViewingResponsesId(null); setQuestionResponses([]); }
      if (viewingFollowUpsId === questionId) { setViewingFollowUpsId(null); setFollowUpTemplates([]); }
    } catch (err: any) { alert("삭제 실패: " + err.message); }
  };

  /* ══════════════ 유틸리티 ══════════════ */
  const typeLabel = (type: string) => {
    if (type === 'photo_based') return { icon: <ImageIcon size={12} />, text: '사진' };
    if (type === 'fill_in_the_blank') return { icon: <MessageSquare size={12} />, text: '빈칸' };
    return { icon: <Mic size={12} />, text: '음성' };
  };

  const filteredQuestions = selectedPersonId
    ? questions.filter(q => q.person_id === selectedPersonId)
    : questions;

  const selectedPerson = persons.find(p => p.id === selectedPersonId);

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <div className="flex min-h-screen bg-warm-cream">

      {/* ══════ 사진 원본 보기 모달 ══════ */}
      {viewingPhotoUrl && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setViewingPhotoUrl(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setViewingPhotoUrl(null)} className="absolute -top-4 -right-4 z-10 w-10 h-10 rounded-full bg-warm-white text-deep-brown flex items-center justify-center shadow-xl hover:bg-warm-cream transition">
              <X size={20} />
            </button>
            <img src={viewingPhotoUrl} alt="원본 사진" className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl" />
          </div>
        </div>
      )}

      {/* ══════ 삭제 확인 모달 ══════ */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDeletingId(null)}>
          <div className="bg-warm-white rounded-2xl p-8 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangle size={22} className="text-red-500" /></div>
              <h3 className="text-lg font-bold text-deep-brown">정말 삭제하시겠어요?</h3>
            </div>
            <p className="text-sm text-deep-brown/60 mb-6 leading-relaxed">
              이 질문에 대한 <b>모든 답변 내역과 꼬리질문 템플릿이 함께 삭제</b>됩니다.<br/>
              질문 자체는 DB에서 비활성 처리되어 나중에 복구할 수 있습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletingId(null)} className="px-5 py-2 bg-warm-cream text-deep-brown rounded-xl font-bold hover:bg-light-taupe/30 transition">취소</button>
              <button onClick={() => handleSoftDelete(deletingId)} className="px-5 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition shadow-md">삭제 확인</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ 왼쪽 사이드바: 사람 목록 ══════ */}
      <aside className="w-64 bg-warm-white border-r border-light-taupe flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-light-taupe/50">
          <div className="flex items-center gap-2 mb-1">
            <Users size={20} className="text-deep-brown" />
            <h2 className="text-lg font-bold text-deep-brown">대상자 목록</h2>
          </div>
          <p className="text-xs text-light-taupe">인터뷰 대상자를 관리합니다</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* 전체 보기 */}
          <button
            onClick={() => setSelectedPersonId(null)}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
              selectedPersonId === null
                ? 'bg-warm-cream text-deep-brown border border-soft-gold/30'
                : 'text-deep-brown/60 hover:bg-warm-cream/50'
            }`}
          >
            <List size={16} />
            전체 보기
            <span className="ml-auto text-xs bg-light-taupe/30 text-deep-brown/60 px-2 py-0.5 rounded-full">{questions.length}</span>
          </button>

          {/* 사람별 목록 */}
          {persons.map(person => {
            const count = questions.filter(q => q.person_id === person.id).length;
            return (
              <div key={person.id} className="group relative">
                <button
                  onClick={() => setSelectedPersonId(person.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
                    selectedPersonId === person.id
                      ? 'bg-warm-cream text-deep-brown border border-soft-gold/30'
                      : 'text-deep-brown/60 hover:bg-warm-cream/50'
                  }`}
                >
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-deep-brown to-soft-gold text-warm-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {person.name.charAt(0)}
                  </span>
                  <span className="truncate">{person.name}</span>
                  <span className="ml-auto text-xs bg-light-taupe/30 text-deep-brown/60 px-2 py-0.5 rounded-full flex-shrink-0">{count}</span>
                </button>
                <button
                  onClick={() => { if(confirm(`"${person.name}" 대상자를 삭제하시겠습니까?`)) handleDeletePerson(person.id); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition p-1 hover:bg-red-50 rounded"
                >
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>
            );
          })}
        </div>

        {/* 사람 추가 */}
        <div className="p-3 border-t border-light-taupe/50">
          {showPersonForm ? (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="이름 (예: 할머니)"
                className="w-full p-2 border border-light-taupe rounded-lg text-sm focus:outline-none focus:border-soft-gold"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                autoFocus
              />
              <input
                type="text"
                placeholder="메모 (선택)"
                className="w-full p-2 border border-light-taupe rounded-lg text-sm focus:outline-none focus:border-soft-gold"
                value={newPersonDesc}
                onChange={(e) => setNewPersonDesc(e.target.value)}
              />
              <div className="flex gap-2">
                <button onClick={handleCreatePerson} className="flex-1 py-2 bg-deep-brown text-warm-white text-sm font-bold rounded-lg hover:bg-deep-brown/85 transition">추가</button>
                <button onClick={() => { setShowPersonForm(false); setNewPersonName(''); setNewPersonDesc(''); }} className="flex-1 py-2 bg-warm-cream text-deep-brown text-sm font-bold rounded-lg hover:bg-light-taupe/30 transition">취소</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowPersonForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-warm-cream text-deep-brown rounded-xl text-sm font-bold hover:bg-light-taupe/30 transition"
            >
              <UserPlus size={16} />
              새 대상자 추가
            </button>
          )}
        </div>
      </aside>

      {/* ══════ 오른쪽 메인 영역 ══════ */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* 메인 카드 */}
          <div className="bg-warm-white p-6 md:p-8 rounded-2xl shadow-sm border border-light-taupe">

            {/* 헤더 */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h2 className="text-3xl font-bold text-deep-brown">
                  {selectedPerson ? `${selectedPerson.name}` : '관리자 대시보드'}
                </h2>
                <p className="text-deep-brown/60 mt-2">
                  {selectedPerson
                    ? `${selectedPerson.description || '대상자의 질문 및 답변을 관리합니다.'}`
                    : '대상자별로 질문 링크를 보내고 남기신 답변을 관리합니다.'}
                </p>
              </div>
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 bg-deep-brown text-warm-white px-5 py-3 rounded-xl hover:bg-deep-brown/85 transition font-bold shadow-md whitespace-nowrap"
              >
                <PlusCircle size={20} /> 새 질문 만들기
              </button>
            </div>

            {/* ──────── 질문 생성 폼 ──────── */}
            {showForm && (
              <div className="mb-8 bg-warm-cream p-6 rounded-2xl border border-light-taupe">
                <h3 className="text-lg font-bold text-deep-brown mb-5">새 질문 만들기</h3>
                <div className="flex flex-col gap-5">

                  {/* 대상자 이름 */}
                  {!selectedPersonId ? (
                    <div>
                      <label className="block text-sm text-deep-brown/70 mb-2 font-bold">대상자 이름 (필수)</label>
                      <input
                        type="text"
                        className="w-full p-3 border border-light-taupe rounded-xl bg-warm-white focus:outline-none focus:border-soft-gold transition shadow-sm text-deep-brown font-medium"
                        placeholder="예: 어머니, 할머니, 아버지, 김순자 등"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                      />
                      <p className="text-xs text-light-taupe mt-1">💡 왼쪽 사이드바에서 대상자를 먼저 추가하면 자동으로 연결됩니다.</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-warm-cream rounded-lg">
                      <span className="w-6 h-6 rounded-full bg-deep-brown text-warm-white flex items-center justify-center text-xs font-bold">
                        {selectedPerson?.name?.charAt(0)}
                      </span>
                      <span className="text-sm font-bold text-deep-brown">{selectedPerson?.name} 대상자에게 질문</span>
                    </div>
                  )}

                  {/* 유형 */}
                  <div>
                    <label className="block text-sm text-deep-brown/70 mb-2 font-bold">질문 유형 선택</label>
                    <select
                      className="w-full p-3 border border-light-taupe rounded-xl bg-warm-white focus:outline-none focus:border-soft-gold transition shadow-sm font-medium text-deep-brown"
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
                      <label className="block text-sm text-deep-brown/70 mb-2 font-bold">📷 사진 첨부</label>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-light-taupe rounded-xl p-6 text-center cursor-pointer hover:border-soft-gold hover:bg-warm-cream transition"
                      >
                        {photoPreview ? (
                          <div className="relative">
                            <img src={photoPreview} alt="미리보기" className="max-h-48 mx-auto rounded-lg shadow-md" />
                            <p className="text-xs text-light-taupe mt-3">클릭하여 다른 사진으로 교체</p>
                          </div>
                        ) : (
                          <div>
                            <ImageIcon size={36} className="mx-auto text-light-taupe mb-2" />
                            <p className="text-sm text-deep-brown/60 font-medium">클릭하여 추억 사진을 선택하세요</p>
                            <p className="text-xs text-light-taupe mt-1">JPG, PNG, WEBP 지원</p>
                          </div>
                        )}
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                    </div>
                  )}

                  {/* 메인 질문 내용 */}
                  <div>
                    <label className="block text-sm text-deep-brown/70 mb-2 font-bold">메인 질문</label>
                    <textarea
                      className="w-full p-3 border border-light-taupe rounded-xl bg-warm-white focus:outline-none focus:border-soft-gold transition shadow-sm text-deep-brown font-medium resize-none"
                      rows={2}
                      placeholder='예: "인생에서 가장 큰 전환점이 된 순간이 있다면, 언제였나요?"'
                      value={newQuestionContent}
                      onChange={(e) => setNewQuestionContent(e.target.value)}
                    />
                  </div>

                  {/* 질문 목적 */}
                  <div>
                    <label className="block text-sm text-deep-brown/70 mb-2 font-bold">이 질문이 노리는 것 <span className="font-normal text-light-taupe">(관리자 메모, 선택)</span></label>
                    <input
                      type="text"
                      className="w-full p-3 border border-light-taupe rounded-xl bg-warm-white focus:outline-none focus:border-soft-gold transition shadow-sm text-deep-brown font-medium"
                      placeholder='예: "이 사람의 의지와 선택 서사를 끌어내기"'
                      value={newPurpose}
                      onChange={(e) => setNewPurpose(e.target.value)}
                    />
                  </div>

                  {/* ──── 꼬리질문 템플릿 ──── */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm text-deep-brown/70 font-bold">꼬리질문 설계 <span className="font-normal text-light-taupe">(선택, AI 가이드용)</span></label>
                      <button
                        onClick={addFollowUpField}
                        className="flex items-center gap-1 text-xs font-bold text-deep-brown hover:text-deep-brown/80 transition px-3 py-1.5 rounded-lg bg-soft-gold/20 hover:bg-soft-gold/30"
                      >
                        <Plus size={14} /> 꼬리질문 추가
                      </button>
                    </div>

                    {newFollowUps.length === 0 && (
                      <p className="text-xs text-light-taupe bg-warm-cream p-3 rounded-lg">
                        꼬리질문을 추가하지 않으면 AI가 자유롭게 꼬리질문을 생성합니다.<br/>
                        추가하면 AI가 이 목록을 가이드로 활용하되, 답변에 맞게 자연스럽게 변형합니다.
                      </p>
                    )}

                    <div className="space-y-3 mt-2">
                      {newFollowUps.map((fu, i) => (
                        <div key={i} className="flex gap-2 items-start bg-warm-white p-3 rounded-xl border border-light-taupe shadow-sm">
                          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-soft-gold/20 text-deep-brown text-xs font-bold flex-shrink-0 mt-1">
                            {i + 1}
                          </div>
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              className="w-full p-2 border border-light-taupe rounded-lg text-sm focus:outline-none focus:border-soft-gold"
                              placeholder={`꼬리질문 ${i + 1}: "그 선택을 할 때 무서웠나요?"`}
                              value={fu.text}
                              onChange={(e) => updateFollowUp(i, 'text', e.target.value)}
                            />
                            <input
                              type="text"
                              className="w-full p-2 border border-light-taupe/50 rounded-lg text-xs text-deep-brown/50 focus:outline-none focus:border-soft-gold"
                              placeholder="메모 (선택): 이 질문으로 끌어내고 싶은 것"
                              value={fu.guide}
                              onChange={(e) => updateFollowUp(i, 'guide', e.target.value)}
                            />
                          </div>
                          <button onClick={() => removeFollowUp(i)} className="p-1 hover:bg-red-50 rounded mt-1">
                            <X size={16} className="text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 사진 요청 문구 */}
                  <div>
                    <label className="block text-sm text-deep-brown/70 mb-2 font-bold">📸 사진 요청 문구 <span className="font-normal text-light-taupe">(대화 완료 후 표시, 선택)</span></label>
                    <input
                      type="text"
                      className="w-full p-3 border border-light-taupe rounded-xl bg-warm-white focus:outline-none focus:border-soft-gold transition shadow-sm text-deep-brown font-medium"
                      placeholder='예: "그 시절의 사진, 직장 시절 사진, 결혼 사진 등"'
                      value={newPhotoRequest}
                      onChange={(e) => setNewPhotoRequest(e.target.value)}
                    />
                  </div>

                  <button
                    onClick={handleCreateQuestion}
                    disabled={uploading}
                    className="self-end bg-deep-brown text-warm-white px-8 py-3 rounded-xl hover:bg-deep-brown/85 transition font-bold shadow-md mt-2 disabled:opacity-50"
                  >
                    {uploading ? '사진 업로드 중...' : '저장 후 링크 생성'}
                  </button>
                </div>
              </div>
            )}

            {/* ──────── 질문 카드 리스트 ──────── */}
            <div className="flex flex-col gap-4">
              {loading ? (
                <div className="text-center py-12 text-light-taupe font-medium">데이터를 불러오는 중...</div>
              ) : filteredQuestions.length === 0 ? (
                <div className="text-center py-12 text-light-taupe font-medium">
                  {selectedPersonId
                    ? '이 대상자에 대한 질문이 아직 없어요. 위 버튼을 눌러 만들어보세요!'
                    : '발급된 질문 링크가 없어요. 위 버튼을 눌러 첫 링크를 만들어보세요!'}
                </div>
              ) : filteredQuestions.map((q) => {
                const label = typeLabel(q.type);
                return (
                  <div key={q.id} className="rounded-2xl border border-light-taupe shadow-sm overflow-hidden bg-warm-white">
                    {/* 질문 요약 카드 */}
                    <div className="p-5 flex flex-col sm:flex-row gap-4">
                      {/* 왼쪽: 사진 썸네일 또는 아이콘 */}
                      <div className="flex-shrink-0">
                        {q.content?.photoUrl ? (
                          <div
                            className="relative w-24 h-20 rounded-xl overflow-hidden border border-light-taupe shadow-sm cursor-pointer group"
                            onClick={() => setViewingPhotoUrl(q.content.photoUrl!)}
                          >
                            <img src={q.content.photoUrl} alt="첨부 사진" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <ZoomIn size={20} className="text-white drop-shadow-lg" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-warm-cream flex items-center justify-center">
                            {q.type === 'open_ended' ? <Mic size={22} className="text-deep-brown" /> : <MessageSquare size={22} className="text-deep-brown" />}
                          </div>
                        )}
                      </div>

                      {/* 가운데: 질문 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-bold text-deep-brown text-lg">{q.recipient_name || '어르신'}</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold text-deep-brown bg-soft-gold/20">
                            {label.icon} {label.text}
                          </span>
                        </div>
                        <p className="text-deep-brown/80 font-medium leading-snug">{q.content?.text}</p>
                        {q.purpose && (
                          <p className="text-[11px] text-light-taupe mt-1.5 italic">🎯 {q.purpose}</p>
                        )}
                        {q.photo_request && (
                          <p className="text-[11px] text-soft-gold mt-1">📸 {q.photo_request}</p>
                        )}
                        <p className="text-[11px] text-light-taupe mt-2">생성: {new Date(q.created_at).toLocaleString('ko-KR')}</p>
                      </div>

                      {/* 오른쪽: 버튼 그룹 */}
                      <div className="flex sm:flex-col gap-2 items-start sm:items-end flex-shrink-0">
                        <button
                          onClick={() => copyLink(q.id, q.recipient_name || '어르신')}
                          className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors w-28 ${
                            copiedId === q.id
                              ? 'bg-warm-cream text-deep-brown border border-soft-gold/30'
                              : 'bg-warm-white text-deep-brown/60 border border-light-taupe hover:bg-warm-cream'
                          }`}
                        >
                          {copiedId === q.id ? <><Check size={14} /> 복사 완료</> : <><Copy size={14} /> 링크 복사</>}
                        </button>
                        <button
                          onClick={() => toggleFollowUps(q.id)}
                          className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors w-28 ${
                            viewingFollowUpsId === q.id
                              ? 'bg-soft-gold text-deep-brown'
                              : 'bg-soft-gold/15 text-deep-brown/70 hover:bg-soft-gold/25'
                          }`}
                        >
                          {viewingFollowUpsId === q.id ? <><ChevronUp size={14} /> 닫기</> : <><List size={14} /> 꼬리질문</>}
                        </button>
                        <button
                          onClick={() => toggleResponses(q.id)}
                          className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors w-28 ${
                            viewingResponsesId === q.id
                              ? 'bg-deep-brown text-warm-white'
                              : 'bg-warm-cream text-deep-brown/60 hover:bg-light-taupe/30'
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

                    {/* ──── 꼬리질문 패널 ──── */}
                    {viewingFollowUpsId === q.id && (
                      <div className="border-t border-light-taupe/50 bg-soft-gold/10 p-5">
                        <div className="ml-2 pl-4 border-l-4 border-soft-gold/40">
                          <h4 className="text-sm font-bold text-deep-brown mb-4 flex items-center gap-2">
                            <List size={16} />
                            사전 설계된 꼬리질문
                          </h4>
                          {followUpsLoading ? (
                            <p className="text-sm text-light-taupe py-4">불러오는 중...</p>
                          ) : followUpTemplates.length === 0 ? (
                            <div className="bg-warm-white p-4 rounded-xl border border-light-taupe shadow-sm inline-block">
                              <p className="text-sm text-light-taupe font-medium">등록된 꼬리질문이 없습니다. AI가 자유롭게 생성합니다.</p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-3">
                              {followUpTemplates.map((fu, i) => (
                                <div key={fu.id} className="bg-warm-white p-4 rounded-xl border border-light-taupe shadow-sm relative">
                                  <div className="absolute top-4 left-4 w-6 h-6 rounded-full bg-soft-gold/20 text-deep-brown flex items-center justify-center text-xs font-bold">
                                    {i + 1}
                                  </div>
                                  <div className="pl-9">
                                    <p className="text-deep-brown font-medium text-[14px]">"{fu.follow_up_text}"</p>
                                    {fu.guide_note && (
                                      <p className="text-[11px] text-light-taupe mt-1.5 italic">💡 {fu.guide_note}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ──── 답변 내역 패널 ──── */}
                    {viewingResponsesId === q.id && (
                      <div className="border-t border-light-taupe/50 bg-warm-cream/60 p-5">
                        <div className="ml-2 pl-4 border-l-4 border-deep-brown/20">
                          <h4 className="text-sm font-bold text-deep-brown mb-4 flex items-center gap-2">
                            <MessageSquare size={16} />
                            {q.recipient_name || '어르신'}님이 남기신 이야기
                          </h4>
                          {responsesLoading ? (
                            <p className="text-sm text-light-taupe py-4">불러오는 중...</p>
                          ) : questionResponses.length === 0 ? (
                            <div className="bg-warm-white p-4 rounded-xl border border-light-taupe shadow-sm inline-block">
                              <p className="text-sm text-light-taupe font-medium">아직 수집된 답변이 없어요. 링크를 전달해보세요!</p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-3">
                              {questionResponses.map((res, i) => (
                                <div key={res.id} className="bg-warm-white p-5 rounded-xl border border-light-taupe shadow-sm relative">
                                  <div className="absolute top-5 left-5 w-7 h-7 rounded-full bg-warm-cream text-deep-brown flex items-center justify-center text-xs font-bold ring-2 ring-warm-white">
                                    {i + 1}
                                  </div>
                                  <div className="pl-10">
                                    <p className="text-deep-brown leading-relaxed whitespace-pre-wrap text-[15px]">{res.answer}</p>
                                    {res.photo_urls && res.photo_urls.length > 0 && (
                                      <div className="flex gap-2 mt-3 flex-wrap">
                                        {res.photo_urls.map((url, pi) => (
                                          <img
                                            key={pi}
                                            src={url}
                                            alt={`첨부 사진 ${pi + 1}`}
                                            className="w-20 h-20 object-cover rounded-lg border border-light-taupe cursor-pointer hover:opacity-80 transition"
                                            onClick={() => setViewingPhotoUrl(url)}
                                          />
                                        ))}
                                      </div>
                                    )}
                                    <p className="text-[11px] text-light-taupe mt-3 font-medium">{new Date(res.created_at).toLocaleString('ko-KR')}</p>
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
      </main>
    </div>
  );
}
