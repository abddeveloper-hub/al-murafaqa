-- Apply this in the Supabase SQL Editor to ensure row id = 1 exists and has proper permissions.
-- Safe to rerun at any time.

-- 1. Ensure columns exist
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

-- 2. Ensure row id = 1 exists so updates and selects always find a record
INSERT INTO public.fest_settings (
  id,
  fest_name,
  registrations_open,
  maintenance_mode,
  live_ticker_enabled,
  live_ticker_text,
  upi_id,
  support_phone,
  video_heading,
  video_title,
  video_description,
  video_venue,
  video_url,
  video_poster_url,
  video_is_live,
  video_viewer_count,
  video_duration_note
)
VALUES (
  1,
  'Al Murafaqa • 5th Edition',
  true,
  false,
  true,
  'Welcome to Al Murafaqa 5th Edition • Live Cultural Gathering',
  'almurafaqa@upi',
  '+91 98765 43210',
  'Main Stage Broadcast',
  'Mystic Poetry Recital & Qurtuba Ensemble',
  'Live Cultural Stage & Ensemble Performances',
  'GRAND ANDALUSIAN DOME',
  '',
  'video-poster.jpg',
  true,
  '4.8k live',
  '42 mins remaining'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Ensure Row-Level Security allows reading and updating fest_settings
ALTER TABLE public.fest_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view settings" ON public.fest_settings;
CREATE POLICY "Public can view settings"
  ON public.fest_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow update settings" ON public.fest_settings;
DROP POLICY IF EXISTS "Admins have full access to settings" ON public.fest_settings;
CREATE POLICY "Allow update settings"
  ON public.fest_settings FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
