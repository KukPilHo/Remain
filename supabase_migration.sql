-- =============================================
-- 기록하다 - 사람별 관리 + 꼬리질문 템플릿 마이그레이션
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. 사람(인터뷰 대상자) 관리 테이블
CREATE TABLE IF NOT EXISTS persons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. questions 테이블에 person_id, photo_request, purpose 추가
ALTER TABLE questions ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(id);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS photo_request TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS purpose TEXT;

-- 3. 꼬리질문 템플릿 테이블
CREATE TABLE IF NOT EXISTS follow_up_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  follow_up_text TEXT NOT NULL,
  guide_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 응답에 사진 URL 배열 추가
ALTER TABLE responses ADD COLUMN IF NOT EXISTS photo_urls TEXT[];

-- 5. RLS 비활성 (개발용 - 이미 비활성이면 무시됨)
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for persons" ON persons FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE follow_up_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for follow_up_templates" ON follow_up_templates FOR ALL USING (true) WITH CHECK (true);
