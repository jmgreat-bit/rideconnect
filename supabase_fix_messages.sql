-- ============================================
-- FIX: Remove foreign key constraints on messages
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- 
-- WHY: The original schema had ON DELETE CASCADE foreign keys.
-- When users disconnect and reconnect, they get new UUIDs.
-- The FK constraints prevent messages from being inserted if the
-- recipient's old UUID was deleted, AND cascade-delete messages
-- when old user records are cleaned up.
-- ============================================

-- Drop existing foreign key constraints on messages table
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_from_user_fkey;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_to_user_fkey;

-- Verify: the messages table should now have no foreign keys
-- You can check by running: \d messages
