-- Apply this in the Supabase SQL Editor to publish video settings to the homepage.
-- The operations are safe to rerun if some columns already exist.
ALTER TABLE public.fest_settings
  ADD COLUMN IF NOT EXISTS video_heading TEXT NOT NULL DEFAULT 'Main Stage Broadcast',
  ADD COLUMN IF NOT EXISTS video_title TEXT NOT NULL DEFAULT 'Mystic Poetry Recital & Qurtuba Ensemble',
  ADD COLUMN IF NOT EXISTS video_description TEXT NOT NULL DEFAULT 'Live Cultural Stage & Ensemble Performances',
  ADD COLUMN IF NOT EXISTS video_venue TEXT NOT NULL DEFAULT 'GRAND ANDALUSIAN DOME',
  ADD COLUMN IF NOT EXISTS video_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS video_poster_url TEXT NOT NULL DEFAULT 'video-poster.jpg',
  ADD COLUMN IF NOT EXISTS video_is_live BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS video_viewer_count TEXT NOT NULL DEFAULT '4.8k live',
  ADD COLUMN IF NOT EXISTS video_duration_note TEXT NOT NULL DEFAULT '42 mins remaining';
