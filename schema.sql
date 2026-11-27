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
    -- Main Page Video Section Controls:
    video_heading TEXT NOT NULL DEFAULT 'Main Stage Broadcast',
    video_title TEXT NOT NULL DEFAULT 'Mystic Poetry Recital & Qurtuba Ensemble',
    video_description TEXT NOT NULL DEFAULT 'Live Cultural Stage & Ensemble Performances',
    video_venue TEXT NOT NULL DEFAULT 'GRAND ANDALUSIAN DOME',
    video_url TEXT NOT NULL DEFAULT '',
    video_poster_url TEXT NOT NULL DEFAULT 'video-poster.jpg',
    video_is_live BOOLEAN NOT NULL DEFAULT true,
    video_viewer_count TEXT NOT NULL DEFAULT '4.8k live',
    video_duration_note TEXT NOT NULL DEFAULT '42 mins remaining',
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT single_row_check CHECK (id = 1)
);

-- Ensure video columns exist for running databases
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS video_heading TEXT DEFAULT 'Main Stage Broadcast';
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS video_title TEXT DEFAULT 'Mystic Poetry Recital & Qurtuba Ensemble';
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS video_description TEXT DEFAULT 'Live Cultural Stage & Ensemble Performances';
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS video_venue TEXT DEFAULT 'GRAND ANDALUSIAN DOME';
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT '';
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS video_poster_url TEXT DEFAULT 'video-poster.jpg';
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS video_is_live BOOLEAN DEFAULT true;
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS video_viewer_count TEXT DEFAULT '4.8k live';
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS video_duration_note TEXT DEFAULT '42 mins remaining';
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS custom_categories JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS stage_ops JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS site_restrictions JSONB DEFAULT '{}'::jsonb;

-- ------------------------------------------------------------------------------
-- 2. EVENTS (Competitions & Cultural Tracks)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    participation_type TEXT DEFAULT 'individual',
    max_teams_per_institution INT DEFAULT 1,
    fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    prize_pool NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    team_size_min INT NOT NULL DEFAULT 1,
    team_size_max INT NOT NULL DEFAULT 1,
    max_capacity INT NOT NULL DEFAULT 50,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closing_soon', 'full', 'closed')),
    day_number INT NOT NULL DEFAULT 1,
    event_date DATE,
    start_time TEXT DEFAULT '10:00',
    end_time TEXT DEFAULT '12:00',
    time_slot TEXT NOT NULL DEFAULT '10:00 AM - 12:00 PM',
    reporting_time TEXT DEFAULT '',
    venue TEXT NOT NULL DEFAULT 'Grand Andalusian Dome',
    rules TEXT DEFAULT '',
    points_first INT DEFAULT 10,
    points_second INT DEFAULT 5,
    points_third INT DEFAULT 3,
    coordinator_name TEXT DEFAULT '',
    coordinator_phone TEXT DEFAULT '',
    is_featured BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 3. REGISTRATIONS (Participants, Teams & Payments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_code TEXT UNIQUE NOT NULL, -- e.g. ALM-XXXX
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
-- ROW-LEVEL SECURITY (RLS) POLICIES & MASTER ADMIN PRIVILEGES
-- ==============================================================================

-- Administrative Access Evaluator (Unrestricted Master Admin Access)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- 1. Supabase service role / internal backend bypass
    IF (auth.jwt() ->> 'role') = 'service_role' THEN
        RETURN TRUE;
    END IF;

    -- 2. Authenticated user with administrative role in app_metadata
    IF (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin', 'director', 'organizer', 'master', 'superuser') THEN
        RETURN TRUE;
    END IF;

    -- 3. Authenticated user with administrative role in user_metadata
    IF (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'superadmin', 'director', 'organizer', 'master', 'superuser') THEN
        RETURN TRUE;
    END IF;

    -- 4. Check for wildcard permission claims
    IF (auth.jwt() -> 'app_metadata' -> 'permissions') ? '*'
       OR (auth.jwt() -> 'user_metadata' -> 'permissions') ? '*' THEN
        RETURN TRUE;
    END IF;

    -- 5. Email matching festival administrative patterns
    IF (auth.jwt() ->> 'email') ILIKE '%admin%' 
       OR (auth.jwt() ->> 'email') ILIKE '%director%'
       OR (auth.jwt() ->> 'email') = 'admin@almurafaqa.com' THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Provision tables for Row-Level Security
ALTER TABLE public.fest_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winners ENABLE ROW LEVEL SECURITY;

-- Make this policy section safe to rerun
DROP POLICY IF EXISTS "Public can view settings" ON public.fest_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.fest_settings;
DROP POLICY IF EXISTS "Admins have full access to settings" ON public.fest_settings;

DROP POLICY IF EXISTS "Public can view events" ON public.events;
DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
DROP POLICY IF EXISTS "Admins have full access to events" ON public.events;

DROP POLICY IF EXISTS "Public can register" ON public.registrations;
DROP POLICY IF EXISTS "Public can view own registration" ON public.registrations;
DROP POLICY IF EXISTS "Admins can view and manage all registrations" ON public.registrations;
DROP POLICY IF EXISTS "Admins have full access to registrations" ON public.registrations;

DROP POLICY IF EXISTS "Public can view active announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins have full access to announcements" ON public.announcements;

DROP POLICY IF EXISTS "Public can view published winners" ON public.winners;
DROP POLICY IF EXISTS "Admins can manage winners" ON public.winners;
DROP POLICY IF EXISTS "Admins have full access to winners" ON public.winners;

-- 1. fest_settings policies
-- Public can view settings (e.g. UPI ID, maintenance mode, live ticker)
CREATE POLICY "Public can view settings"
    ON public.fest_settings FOR SELECT
    TO anon, authenticated
    USING (true);

-- Authenticated admins have full unrestricted access to settings
CREATE POLICY "Admins have full access to settings"
    ON public.fest_settings FOR ALL
    TO authenticated, service_role
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 2. events policies
-- Public can view all events
CREATE POLICY "Public can view events"
    ON public.events FOR SELECT
    TO anon, authenticated
    USING (true);

-- Authenticated admins have full unrestricted access to events
CREATE POLICY "Admins have full access to events"
    ON public.events FOR ALL
    TO authenticated, service_role
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 3. registrations policies
-- Public can insert new registrations (when registering from front page)
CREATE POLICY "Public can register"
    ON public.registrations FOR INSERT
    TO anon, authenticated
    WITH CHECK (payment_status = 'pending' AND checked_in = false AND checked_in_at IS NULL);

-- Public can view registrations for pass verification and ticket confirmation
CREATE POLICY "Public can view own registration"
    ON public.registrations FOR SELECT
    TO anon, authenticated
    USING (true);

-- Authenticated admins have full unrestricted access to all registrations
CREATE POLICY "Admins have full access to registrations"
    ON public.registrations FOR ALL
    TO authenticated, service_role
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4. announcements policies
-- Public can view active announcements
CREATE POLICY "Public can view active announcements"
    ON public.announcements FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

-- Authenticated admins have full unrestricted access to all announcements
CREATE POLICY "Admins have full access to announcements"
    ON public.announcements FOR ALL
    TO authenticated, service_role
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 5. winners policies
-- Public can view published winners
CREATE POLICY "Public can view published winners"
    ON public.winners FOR SELECT
    TO anon, authenticated
    USING (published = true);

-- Authenticated admins have full unrestricted access to all winners
CREATE POLICY "Admins have full access to winners"
    ON public.winners FOR ALL
    TO authenticated, service_role
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Grant schema table permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

-- ==============================================================================
-- INITIAL FESTIVAL SETTINGS (Single Master Record)
-- ==============================================================================

INSERT INTO public.fest_settings (id, fest_name, registrations_open, maintenance_mode, live_ticker_enabled, live_ticker_text, upi_id, support_phone)
VALUES (
    1,
    'Al Murafaqa • 5th Edition',
    true,
    false,
    false,
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- DATABASE CLEANUP: PURGE LEGACY DEMO / MOCK DATA
-- Run these statements in Supabase SQL Editor to wipe seed mock entries:
-- ==============================================================================
DELETE FROM public.registrations 
WHERE ticket_code IN ('ALM-1042', 'ALM-1043', 'ALM-1044', 'ALM-1045', 'TEST-9999')
   OR leader_name IN ('Zaid Al-Husseini', 'Sofia Benali', 'Ammar Qureshi', 'Kareem Mansoor', 'Test Attempter');

DELETE FROM public.winners 
WHERE winner_name IN ('Zaid Al-Husseini', 'Mariam Al-Khatib', 'Hassan Bilal');

DELETE FROM public.announcements 
WHERE title IN ('Oud Showcase Venue Update', 'Calligraphy Kit Collection');

-- ==============================================================================
-- MODULE EXTENSIONS (1, 2, 3, 7, 8)
-- ==============================================================================

-- 6. JURY SCORES (Module 1: Rubrics & Competitor Scoring)
CREATE TABLE IF NOT EXISTS public.scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    college_name TEXT NOT NULL,
    judge_name TEXT NOT NULL DEFAULT 'Judge 1',
    criterion_technical INT NOT NULL DEFAULT 0,
    criterion_andalusian INT NOT NULL DEFAULT 0,
    criterion_creative INT NOT NULL DEFAULT 0,
    criterion_decorum INT NOT NULL DEFAULT 0,
    penalty_points INT NOT NULL DEFAULT 0,
    penalty_reason TEXT DEFAULT '',
    total_score INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. AUDIT LOGS (Module 8: Security & Operations Audit Trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL DEFAULT 'Super Admin',
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to scores" ON public.scores;
DROP POLICY IF EXISTS "Allow all for scores" ON public.scores;
CREATE POLICY "Allow all for scores"
    ON public.scores FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins have full access to audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow all for audit_logs" ON public.audit_logs;
CREATE POLICY "Allow all for audit_logs"
    ON public.audit_logs FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

GRANT ALL ON public.scores TO anon, authenticated, service_role;
GRANT ALL ON public.audit_logs TO anon, authenticated, service_role;

-- ==============================================================================
-- MODULE 9: TEAM LEADER PORTAL & DELEGATION ROSTER ENGINE
-- ==============================================================================

-- 8. TEAM LEADERS (Institutional Delegations & Token Provisioning)
CREATE TABLE IF NOT EXISTS public.team_leaders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL, -- e.g. TL-7A9B-4F12
    leader_name TEXT NOT NULL,
    leader_email TEXT NOT NULL,
    leader_phone TEXT NOT NULL,
    institution_name TEXT NOT NULL,
    team_name TEXT,
    max_students INT NOT NULL DEFAULT 50,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_team_leaders_token ON public.team_leaders(token);

-- 9. TEAM STUDENTS (Delegation Student Roster)
CREATE TABLE IF NOT EXISTS public.team_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_leader_id UUID NOT NULL REFERENCES public.team_leaders(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_code TEXT NOT NULL, -- Chest No / Roll No e.g. STU-101
    category TEXT NOT NULL DEFAULT 'Senior', -- Sub-Junior, Junior, Senior, General
    gender TEXT DEFAULT 'Male',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    assigned_events JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_team_students_leader ON public.team_students(team_leader_id);

-- 10. TEAM ASSIGNMENTS (Programme / Event Allocations for Delegations)
CREATE TABLE IF NOT EXISTS public.team_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_leader_id UUID NOT NULL REFERENCES public.team_leaders(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    student_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_team_assignments_leader ON public.team_assignments(team_leader_id);
CREATE INDEX IF NOT EXISTS idx_team_assignments_event ON public.team_assignments(event_id);

ALTER TABLE public.team_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can lookup active leader token" ON public.team_leaders;
DROP POLICY IF EXISTS "Admins have full access to team_leaders" ON public.team_leaders;
DROP POLICY IF EXISTS "Allow all for team_leaders" ON public.team_leaders;

DROP POLICY IF EXISTS "Public can access students via delegation" ON public.team_students;
DROP POLICY IF EXISTS "Admins have full access to team_students" ON public.team_students;
DROP POLICY IF EXISTS "Allow all for team_students" ON public.team_students;

DROP POLICY IF EXISTS "Public can view and update team assignments" ON public.team_assignments;
DROP POLICY IF EXISTS "Admins have full access to team_assignments" ON public.team_assignments;
DROP POLICY IF EXISTS "Allow all for team_assignments" ON public.team_assignments;

CREATE POLICY "Allow all for team_leaders"
    ON public.team_leaders FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all for team_students"
    ON public.team_students FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all for team_assignments"
    ON public.team_assignments FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

GRANT ALL ON public.team_leaders TO anon, authenticated, service_role;
GRANT ALL ON public.team_students TO anon, authenticated, service_role;
GRANT ALL ON public.team_assignments TO anon, authenticated, service_role;

-- 4. TEAM GROUPS / SQUADS (Sub-teams within Delegations)
CREATE TABLE IF NOT EXISTS public.team_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_leader_id UUID NOT NULL REFERENCES public.team_leaders(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Senior',
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    student_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_team_groups_leader ON public.team_groups(team_leader_id);
ALTER TABLE public.team_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view and manage team groups" ON public.team_groups;
DROP POLICY IF EXISTS "Admins have full access to team_groups" ON public.team_groups;
DROP POLICY IF EXISTS "Allow all for team_groups" ON public.team_groups;

CREATE POLICY "Allow all for team_groups"
    ON public.team_groups FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

GRANT ALL ON public.team_groups TO anon, authenticated, service_role;

