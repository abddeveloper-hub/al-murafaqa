-- ==============================================================================
-- AL MURAFAQA • FESTIVAL DATES & LIVE SCHEDULE WINDOW SETTINGS
-- Migration: 20261127_add_fest_dates_settings.sql
-- Adds fest_dates JSONB column on fest_settings to drive site-wide LIVE status.
-- ==============================================================================

ALTER TABLE public.fest_settings
  ADD COLUMN IF NOT EXISTS fest_dates JSONB DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
