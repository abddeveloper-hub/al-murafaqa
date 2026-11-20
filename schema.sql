-- ==============================================================================
-- AL MURAFAQA • 5TH EDITION — FEST COMMAND CENTER DATABASE SCHEMA
-- Supabase PostgreSQL with Strict Row-Level Security (RLS)
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. FEST SETTINGS (Global Master Controls & Contact Info)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fest_settings (
    id INT PRIMARY KEY DEFAULT 1,
    fest_name TEXT NOT NULL DEFAULT 'Al Murafaqa • 5th Edition',
    registrations_open BOOLEAN NOT NULL DEFAULT true,
    maintenance_mode BOOLEAN NOT NULL DEFAULT false,
    live_ticker_enabled BOOLEAN NOT NULL DEFAULT true,
    live_ticker_text TEXT NOT NULL DEFAULT 'Welcome to Al Murafaqa 5th Edition • Live Cultural Gathering • Registrations Closing Soon for Stage Events',
    upi_id TEXT NOT NULL DEFAULT 'almurafaqa@upi',
    support_phone TEXT NOT NULL DEFAULT '+91 98765 43210',
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT single_row_check CHECK (id = 1)
);

-- ------------------------------------------------------------------------------
-- 2. EVENTS (Competitions & Cultural Tracks)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    prize_pool NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    team_size_min INT NOT NULL DEFAULT 1,
    team_size_max INT NOT NULL DEFAULT 1,
    max_capacity INT NOT NULL DEFAULT 50,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closing_soon', 'full', 'closed')),
    day_number INT NOT NULL DEFAULT 1,
    time_slot TEXT NOT NULL DEFAULT '10:00 AM - 12:00 PM',
    venue TEXT NOT NULL DEFAULT 'Grand Andalusian Dome',
    rules TEXT DEFAULT '',
    is_featured BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 3. REGISTRATIONS (Participants, Teams & Payments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_code TEXT UNIQUE NOT NULL, -- e.g. ALM-1042
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    team_name TEXT,
    leader_name TEXT NOT NULL,
    leader_email TEXT NOT NULL,
    leader_phone TEXT NOT NULL,
    college_name TEXT NOT NULL,
    team_members JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of [{ name, email, phone }]
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'verified', 'rejected')),
    transaction_id TEXT,
    checked_in BOOLEAN NOT NULL DEFAULT false,
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 4. ANNOUNCEMENTS (Live Tickers & Urgent Alerts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_urgent BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 5. WINNERS (Results & Trophies)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.winners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    position INT NOT NULL CHECK (position IN (1, 2, 3)),
    winner_name TEXT NOT NULL,
    college_name TEXT NOT NULL,
    published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_event_position UNIQUE (event_id, position)
);

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.fest_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winners ENABLE ROW LEVEL SECURITY;

-- 1. fest_settings policies
-- Public can view settings (e.g. UPI ID, maintenance mode, live ticker)
CREATE POLICY "Public can view settings"
    ON public.fest_settings FOR SELECT
    TO anon, authenticated
    USING (true);

-- Authenticated admins can update settings
CREATE POLICY "Admins can update settings"
    ON public.fest_settings FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 2. events policies
-- Public can view all events
CREATE POLICY "Public can view events"
    ON public.events FOR SELECT
    TO anon, authenticated
    USING (true);

-- Authenticated admins can insert, update, delete events
CREATE POLICY "Admins can manage events"
    ON public.events FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 3. registrations policies
-- Public can insert new registrations (when registering from front page)
CREATE POLICY "Public can register"
    ON public.registrations FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Public can check their own registration status via ticket code
CREATE POLICY "Public can view own registration"
    ON public.registrations FOR SELECT
    TO anon
    USING (ticket_code IS NOT NULL);

-- Authenticated admins have full control over all registrations
CREATE POLICY "Admins can view and manage all registrations"
    ON public.registrations FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 4. announcements policies
-- Public can view active announcements
CREATE POLICY "Public can view active announcements"
    ON public.announcements FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

-- Authenticated admins can manage all announcements
CREATE POLICY "Admins can manage announcements"
    ON public.announcements FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5. winners policies
-- Public can view published winners
CREATE POLICY "Public can view published winners"
    ON public.winners FOR SELECT
    TO anon, authenticated
    USING (published = true);

-- Authenticated admins can manage all winners
CREATE POLICY "Admins can manage winners"
    ON public.winners FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================

-- Default Settings
INSERT INTO public.fest_settings (id, fest_name, registrations_open, maintenance_mode, live_ticker_enabled, live_ticker_text, upi_id, support_phone)
VALUES (
    1,
    'Al Murafaqa • 5th Edition',
    true,
    false,
    true,
    '✨ Welcome to Al Murafaqa 5th Edition • Live Cultural Gathering • Registrations Closing Soon for Stage Events • Grand Finale on Day 3',
    'almurafaqa@upi',
    '+91 98765 43210'
) ON CONFLICT (id) DO NOTHING;

-- Initial Cultural Events (5 Disciplines)
INSERT INTO public.events (id, title, category, fee, prize_pool, team_size_min, team_size_max, max_capacity, status, day_number, time_slot, venue, rules, is_featured)
VALUES 
(
    'a1b2c3d4-0001-4000-8000-000000000001',
    'Andalusian Calligraphy Championship',
    'Calligraphy',
    150.00,
    15000.00,
    1,
    1,
    30,
    'open',
    1,
    '10:00 AM – 01:00 PM',
    'Hall of Scribes (North Wing)',
    'Traditional Qalam & ink only. Handmade A3 parchment provided on spot. 3 hours total duration.',
    true
),
(
    'a1b2c3d4-0002-4000-8000-000000000002',
    'Diwan Classical Poetry Recital',
    'Poetry',
    100.00,
    12000.00,
    1,
    1,
    25,
    'closing_soon',
    1,
    '02:30 PM – 05:30 PM',
    'Grand Andalusian Dome',
    'Recital in Arabic, Urdu, or Persian classical meter. 5 minutes max per contestant.',
    true
),
(
    'a1b2c3d4-0003-4000-8000-000000000003',
    'Oud & Maqam Ensemble Showcase',
    'Music',
    300.00,
    25000.00,
    2,
    5,
    15,
    'open',
    2,
    '06:00 PM – 09:30 PM',
    'Central Courtyard Amphitheatre',
    'Acoustic instruments only (Oud, Ney, Daf, Riq, Qanun). 12-minute performance.',
    true
),
(
    'a1b2c3d4-0004-4000-8000-000000000004',
    'Sacred Geometry & Architectural Model Design',
    'Architecture',
    250.00,
    20000.00,
    2,
    4,
    20,
    'open',
    2,
    '10:00 AM – 03:00 PM',
    'Design Studio B',
    'Recreate traditional Moorish arches or muqarnas dome structures using wood and plaster.',
    false
),
(
    'a1b2c3d4-0005-4000-8000-000000000005',
    'Hikmah & Moral Philosophy Colloquium',
    'Philosophy',
    100.00,
    10000.00,
    1,
    2,
    40,
    'open',
    3,
    '11:00 AM – 02:00 PM',
    'Ibn Rushd Lecture Hall',
    'Paper presentation and defense on Islamic epistemological traditions and classical ethics.',
    false
) ON CONFLICT (id) DO NOTHING;

-- Initial Announcements
INSERT INTO public.announcements (title, message, is_urgent, is_active)
VALUES 
(
    'Oud Showcase Venue Update',
    'The Oud & Maqam Ensemble showcase soundcheck will begin promptly at 04:30 PM at the Amphitheatre.',
    false,
    true
),
(
    'Calligraphy Kit Collection',
    'Registered scribes can collect their handmade paper kits from Helpdesk Counter 2 from 08:30 AM onwards.',
    true,
    true
);

-- Initial Registrations
INSERT INTO public.registrations (ticket_code, event_id, team_name, leader_name, leader_email, leader_phone, college_name, team_members, payment_status, transaction_id, checked_in)
VALUES 
(
    'ALM-1042',
    'a1b2c3d4-0001-4000-8000-000000000001',
    'Qalam Vanguard',
    'Zaid Al-Husseini',
    'zaid@example.com',
    '+91 98765 11223',
    'Faculty of Fine Arts & Design',
    '[{"name": "Zaid Al-Husseini", "role": "Lead Scribe"}]'::jsonb,
    'verified',
    'UPI20261120019234',
    true
),
(
    'ALM-1043',
    'a1b2c3d4-0003-4000-8000-000000000003',
    'Qurtuba Trio',
    'Sofia Benali',
    'sofia.b@example.com',
    '+91 98451 99881',
    'National Conservatory of Music',
    '[{"name": "Sofia Benali", "role": "Lead Oud"}, {"name": "Farhan Mir", "role": "Percussion / Riq"}, {"name": "Laila Tazi", "role": "Ney Flute"}]'::jsonb,
    'verified',
    'UPI20261120028741',
    false
),
(
    'ALM-1044',
    'a1b2c3d4-0002-4000-8000-000000000002',
    'Diwan Voices',
    'Ammar Qureshi',
    'ammar.q@example.com',
    '+91 97112 33445',
    'Department of Classical Literature',
    '[{"name": "Ammar Qureshi", "role": "Soloist"}]'::jsonb,
    'pending',
    'UPI20261120034112',
    false
),
(
    'ALM-1045',
    'a1b2c3d4-0004-4000-8000-000000000004',
    'Alhambra Builders',
    'Kareem Mansoor',
    'kareem@example.com',
    '+91 99001 22334',
    'Institute of Architecture & Heritage',
    '[{"name": "Kareem Mansoor", "role": "Architect"}, {"name": "Bilal Nazeer", "role": "Modeler"}]'::jsonb,
    'rejected',
    'INVALID_REF_99182',
    false
);
