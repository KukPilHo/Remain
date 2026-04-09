/**
 * TypeScript 타입 정의
 */

/* ── 사람(인터뷰 대상자) ── */
export interface Person {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  is_deleted?: boolean;
  created_at: string;
}

/* ── 꼬리질문 템플릿 ── */
export interface FollowUpTemplate {
  id: string;
  question_id: string;
  sort_order: number;
  follow_up_text: string;
  guide_note?: string;
  created_at: string;
}

/* ── 대화 턴 ── */
export interface Turn {
  role: 'ai' | 'parent';
  text: string;
  audioUrl?: string;
  timestamp: Date;
}

/* ── 세션 상태 ── */
export interface SessionState {
  sessionId: string;
  parentName: string;
  topic: string;
  currentQuestionId: string;
  turns: Turn[];
  currentTurn: number;
  maxTurns: number; // 기본 8 (AI 4턴 + 부모님 4턴)
  status:
    | 'greeting'
    | 'waiting_answer'
    | 'processing'
    | 'asking'
    | 'completed';
}

/* ── 질문 (하드코딩용 레거시) ── */
export interface Question {
  id: string;
  category: string;
  question: string;
  guide: string;
  greeting: string;
}

/* ── DB 질문 (Supabase questions 테이블) ── */
export interface DbQuestion {
  id: string;
  type: string;
  content: {
    text: string;
    photoUrl?: string;
    prefixText?: string;
    suffixText?: string;
  };
  recipient_name?: string;
  person_id?: string;
  photo_request?: string;   // 요청할 사진 안내 문구
  purpose?: string;         // 이 질문이 노리는 것 (관리자 메모)
  follow_ups?: FollowUpTemplate[];
  is_deleted?: boolean;
  created_at: string;
}
