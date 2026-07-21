-- =====================================================
-- Fix: documents table type CHECK constraint
-- The original CHECK only allowed ('markdown', 'richtext', 'code')
-- Frontend uses additional types: note, PRD, API, 报告, 周报
-- This migration expands the allowed values.
-- =====================================================

-- Drop the old constraint
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_type_check;

-- Add the new constraint with expanded type list
ALTER TABLE public.documents ADD CONSTRAINT documents_type_check
  CHECK (type IN ('markdown', 'richtext', 'code', 'note', 'PRD', 'API', '报告', '周报'));

-- Update any existing rows with invalid type values to 'markdown'
UPDATE public.documents SET type = 'markdown' WHERE type IS NULL;
