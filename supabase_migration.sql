-- =============================================
-- 기록하다 — 통합 마이그레이션 스크립트
-- Supabase SQL Editor에서 순서대로 실행하세요
-- =============================================

-- ═══════════════ 1. 기본 테이블 ═══════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'senior',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 대상자(인터뷰 대상) 테이블
CREATE TABLE IF NOT EXISTS persons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 질문 테이블
CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content JSONB NOT NULL,
  scheduled_at TIMESTAMPTZ,
  recipient_name TEXT DEFAULT '어르신',
  is_deleted BOOLEAN DEFAULT false,
  person_id UUID REFERENCES persons(id),
  photo_request TEXT,
  purpose TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 응답 테이블 (레거시 — 하위 호환용)
CREATE TABLE IF NOT EXISTS responses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  session_id UUID,
  answer TEXT,
  audio_url TEXT,
  photo_urls TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════ 2. 꼬리질문 템플릿 ═══════════════

CREATE TABLE IF NOT EXISTS follow_up_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  follow_up_text TEXT NOT NULL,
  guide_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════ 3. 세션 + 턴 단위 대화 저장 ═══════════════

-- 대화 세션 (질문 1개 → 세션 N개)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'in_progress',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 대화 턴 (세션 1개 → 턴 N개)
CREATE TABLE IF NOT EXISTS session_turns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL,       -- 'ai' | 'parent'
  text TEXT NOT NULL,
  audio_url TEXT,           -- Supabase Storage URL
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════ 4. 인덱스 ═══════════════

CREATE INDEX IF NOT EXISTS idx_sessions_question_id ON sessions(question_id);
CREATE INDEX IF NOT EXISTS idx_sessions_person_id ON sessions(person_id);
CREATE INDEX IF NOT EXISTS idx_session_turns_session_id ON session_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_session_turns_session_order ON session_turns(session_id, turn_index);

-- ═══════════════ 5. RLS (개발용 전체 허용) ═══════════════

ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all for persons" ON persons FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE follow_up_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all for follow_up_templates" ON follow_up_templates FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all for sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE session_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all for session_turns" ON session_turns FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════ 주의 사항 ═══════════════
-- Supabase Dashboard > Storage에서 아래 버킷 2개를 수동 생성하세요:
-- 1. "photos" (Public: true) — 사진 업로드용
-- 2. "audio"  (Public: true) — 음성 녹음 저장용
