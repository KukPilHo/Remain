-- Supabase Migration: Phase 3.5 additions
-- Run this in SQL Editor after the initial schema

-- 1. Add 'recipient_name' to questions table for personalized greetings
ALTER TABLE questions ADD COLUMN IF NOT EXISTS recipient_name TEXT DEFAULT '어르신';

-- 2. Add 'is_deleted' for soft-delete (실수 방지를 위한 소프트 삭제)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- 3. Create Supabase Storage bucket for photos (run via Dashboard > Storage > New bucket)
-- Bucket name: "photos"
-- Public: true (so session page can load images without auth)
-- NOTE: This SQL cannot create buckets. You must create the "photos" bucket manually in the Supabase Dashboard.
