-- Apply this in the Supabase SQL Editor to publish video settings to the homepage.
-- The operations are safe to rerun if some columns already exist.
ALTER TABLE public.fest_settings
  ADD COLUMN IF NOT EXISTS video_heading TEXT NOT NULL DEFAULT 'Main Stage Broadcast',
  ADD COLUMN IF NOT EXISTS video_title TEXT NOT NULL DEFAULT 'Mystic Poetry Recital & Qurtuba Ensemble',
  ADD COLUMN IF NOT EXISTS video_description TEXT NOT NULL DEFAULT 'Live Cultural Stage & Ensemble Performances',
  ADD COLUMN IF NOT EXISTS video_venue TEXT NOT NULL DEFAULT 'GRAND ANDALUSIAN DOME',
  ADD COLUMN IF NOT EXISTS video_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS video_poster_url TEXT NOT NULL DEFAULT 'https://lh3.googleusercontent.com/aida-public/AB6AXuBI4u7wM1OZBhGT-FXa7reqYfBd_iL47KqTEKkVKg_Idm8vRlJmbdWzUsd9leeBo8C1iT-u8DngFM0FXGt4ts66akMHNMMhJLX5H6lI38Ip4TNgcxyWt6W6jrtfl8IL1YkL1-zJsck5U9-dkM5NH5LH6IELBONbt9z8WvfI5KOrGwxcxGylyHzbQlrAkuV1nBWBiuu2E9UOdxa5D3h9k-8p5XBeRoQS0gaQ6sVBMXJb',
  ADD COLUMN IF NOT EXISTS video_is_live BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS video_viewer_count TEXT NOT NULL DEFAULT '4.8k live',
  ADD COLUMN IF NOT EXISTS video_duration_note TEXT NOT NULL DEFAULT '42 mins remaining';
