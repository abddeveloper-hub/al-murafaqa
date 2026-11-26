-- ==============================================================================
-- AL MURAFAQA • 5TH EDITION — PROGRAMME ATTRIBUTES & TEAM QUOTA CONFIGURATION
-- Migration: 20261126_add_programme_attributes.sql
-- Enables Programme Codes, Team Sizes, Scheduling Details & Championship Points
-- ==============================================================================

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS participation_type TEXT DEFAULT 'individual';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS max_teams_per_institution INT DEFAULT 1;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_date DATE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS start_time TEXT DEFAULT '10:00';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_time TEXT DEFAULT '12:00';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reporting_time TEXT DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS points_first INT DEFAULT 10;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS points_second INT DEFAULT 5;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS points_third INT DEFAULT 3;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS coordinator_name TEXT DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS coordinator_phone TEXT DEFAULT '';

-- Create index on event code for fast searches
CREATE INDEX IF NOT EXISTS idx_events_code ON public.events(code);

-- Update any existing records without a code
UPDATE public.events 
SET code = 'PRG-' || LPAD(ROUND(RANDOM() * 899 + 100)::TEXT, 3, '0')
WHERE code IS NULL OR code = '';
