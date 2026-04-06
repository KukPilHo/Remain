-- Supabase Initial Schema for Girokhada Phase 2
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (both Seniors and Admins/Children)
CREATE TABLE users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'senior', -- 'admin', 'senior'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Active interview sessions uniquely identifying each access link
CREATE TABLE interview_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Questions configurations including types, custom per-user links, and content constraints
CREATE TABLE questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL means it is a common question
  type TEXT NOT NULL, -- 'open_ended', 'multiple_choice', 'fill_in_the_blank', 'photo_based'
  content JSONB NOT NULL, -- e.g. { "text": "...", "photoUrl": "...", "options": [...] }
  scheduled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User answers to questions
CREATE TABLE responses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  session_id UUID REFERENCES interview_sessions(id) ON DELETE CASCADE,
  answer TEXT,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Set Row Level Security (RLS) optionally if needed for client side limits
-- But typically admin panel or Edge Functions skip RLS using service role.
