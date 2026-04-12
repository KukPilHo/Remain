-- =============================================
-- 기록하다 - 세션 + 턴 단위 대화 저장 마이그레이션
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. 대화 세션 테이블
-- 한 질문에 대해 여러 번 대화할 수 있음 (질문 1개 → 세션 N개)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'in_progress',  -- 'in_progress', 'completed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 대화 턴 테이블
-- 세션 안에서 AI 질문 + 사용자 답변을 턴 단위로 저장
CREATE TABLE IF NOT EXISTS session_turns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL DEFAULT 0,  -- 대화 순서 (0부터)
  role TEXT NOT NULL,                      -- 'ai' 또는 'parent'
  text TEXT NOT NULL,                      -- 텍스트 내용
  audio_url TEXT,                          -- Supabase Storage 음성 파일 URL
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_sessions_question_id ON sessions(question_id);
CREATE INDEX IF NOT EXISTS idx_sessions_person_id ON sessions(person_id);
CREATE INDEX IF NOT EXISTS idx_session_turns_session_id ON session_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_session_turns_session_order ON session_turns(session_id, turn_index);

-- 4. RLS (개발용 - 전체 허용)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE session_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for session_turns" ON session_turns FOR ALL USING (true) WITH CHECK (true);

-- 5. follow_up_templates.question_id를 UUID로 수정 (기존 TEXT → UUID)
-- 주의: 기존 데이터가 없는 경우에만 안전. 데이터가 있다면 먼저 백업 후 실행.
-- ALTER TABLE follow_up_templates ALTER COLUMN question_id TYPE UUID USING question_id::uuid;
-- ALTER TABLE follow_up_templates ADD CONSTRAINT fk_follow_up_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;

-- =============================================
-- Supabase Storage 버킷 생성 필요 (Dashboard에서 수동)
-- 버킷 이름: "audio"
-- Public: true
-- =============================================
