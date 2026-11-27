-- ==============================================================================
-- AL MURAFAQA • COMPLETE SUPABASE CLOUD DATABASE SYNC & PERMISSIONS
-- Run this in Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/zyfzqkrkvxtjwhvslpgm/sql
-- Ensures ALL modules, tables, columns, and permissions are 100% active in Supabase.
-- ==============================================================================

-- 1. FEST_SETTINGS (Full settings, categories, stage operations, restrictions)
CREATE TABLE IF NOT EXISTS public.fest_settings (
    id INT PRIMARY KEY DEFAULT 1,
    fest_name TEXT NOT NULL DEFAULT 'Al Murafaqa • 5th Edition',
    registrations_open BOOLEAN NOT NULL DEFAULT true,
    maintenance_mode BOOLEAN NOT NULL DEFAULT false,
    live_ticker_enabled BOOLEAN NOT NULL DEFAULT true,
    live_ticker_text TEXT NOT NULL DEFAULT 'Welcome to Al Murafaqa 5th Edition',
    upi_id TEXT NOT NULL DEFAULT 'almurafaqa@upi',
    support_phone TEXT NOT NULL DEFAULT '+91 98765 43210',
    video_heading TEXT NOT NULL DEFAULT 'Main Stage Broadcast',
    video_title TEXT NOT NULL DEFAULT 'MUHYISSUNNA DARS UKKUDA',
    video_description TEXT NOT NULL DEFAULT 'Live Cultural Stage & Ensemble Performances',
    video_venue TEXT NOT NULL DEFAULT 'GRAND HALL',
    video_url TEXT NOT NULL DEFAULT '',
    video_poster_url TEXT NOT NULL DEFAULT 'video-poster.jpg',
    video_is_live BOOLEAN NOT NULL DEFAULT true,
    video_viewer_count TEXT NOT NULL DEFAULT '',
    video_duration_note TEXT NOT NULL DEFAULT '',
    custom_categories JSONB DEFAULT '[]'::jsonb,
    stage_ops JSONB DEFAULT '{}'::jsonb,
    site_restrictions JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT single_row_check CHECK (id = 1)
);

ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS video_heading TEXT NOT NULL DEFAULT 'Main Stage Broadcast';
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS video_title TEXT NOT NULL DEFAULT 'MUHYISSUNNA DARS UKKUDA';
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS video_description TEXT NOT NULL DEFAULT 'Live Cultural Stage & Ensemble Performances';
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS video_venue TEXT NOT NULL DEFAULT 'GRAND HALL';
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS video_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS video_poster_url TEXT NOT NULL DEFAULT 'video-poster.jpg';
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS video_is_live BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS video_viewer_count TEXT NOT NULL DEFAULT '';
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS video_duration_note TEXT NOT NULL DEFAULT '';
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS custom_categories JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS stage_ops JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS site_restrictions JSONB DEFAULT '{}'::jsonb;

INSERT INTO public.fest_settings (id, fest_name)
VALUES (1, 'Al Murafaqa • 5th Edition')
ON CONFLICT (id) DO NOTHING;

-- 2. EVENTS (Competitions & Programme Schedules)
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    code TEXT,
    category TEXT NOT NULL,
    fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    prize_pool NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    team_size_min INT NOT NULL DEFAULT 1,
    team_size_max INT NOT NULL DEFAULT 1,
    max_teams_per_institution INT NOT NULL DEFAULT 1,
    max_capacity INT NOT NULL DEFAULT 40,
    status TEXT NOT NULL DEFAULT 'open',
    day_number INT NOT NULL DEFAULT 1,
    time_slot TEXT NOT NULL DEFAULT '10:00 AM - 12:00 PM',
    venue TEXT NOT NULL DEFAULT 'Grand Hall',
    rules TEXT DEFAULT '',
    is_featured BOOLEAN NOT NULL DEFAULT false,
    participation_type TEXT DEFAULT 'individual',
    event_date DATE,
    start_time TEXT DEFAULT '10:00',
    end_time TEXT DEFAULT '12:00',
    reporting_time TEXT DEFAULT '',
    points_first INT DEFAULT 10,
    points_second INT DEFAULT 5,
    points_third INT DEFAULT 3,
    coordinator_name TEXT DEFAULT '',
    coordinator_phone TEXT DEFAULT '',
    is_restricted BOOLEAN DEFAULT false,
    restriction_type TEXT DEFAULT '',
    restriction_reason TEXT DEFAULT '',
    registration_frozen BOOLEAN DEFAULT false,
    scoring_locked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

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
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS restriction_type TEXT DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS restriction_reason TEXT DEFAULT '';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS registration_frozen BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS scoring_locked BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_events_code ON public.events(code);

-- 3. REGISTRATIONS
CREATE TABLE IF NOT EXISTS public.registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    ticket_code TEXT NOT NULL UNIQUE,
    team_name TEXT DEFAULT '',
    college_name TEXT NOT NULL,
    leader_name TEXT NOT NULL,
    leader_email TEXT,
    leader_phone TEXT,
    team_members JSONB DEFAULT '[]'::jsonb,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    transaction_id TEXT,
    checked_in BOOLEAN NOT NULL DEFAULT false,
    checked_in_at TIMESTAMPTZ,
    is_restricted BOOLEAN DEFAULT false,
    restriction_reason TEXT DEFAULT '',
    restriction_severity TEXT DEFAULT '',
    restriction_category TEXT DEFAULT '',
    restricted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.registrations ALTER COLUMN leader_email DROP NOT NULL;
ALTER TABLE public.registrations ALTER COLUMN leader_phone DROP NOT NULL;
ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_payment_status_check;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN DEFAULT false;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS restriction_reason TEXT DEFAULT '';
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS restriction_severity TEXT DEFAULT '';
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS restriction_category TEXT DEFAULT '';
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS restricted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_registrations_event ON public.registrations(event_id);

-- 4. ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_urgent BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. WINNERS
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

-- 6. SCORES (Jury Scoring)
CREATE TABLE IF NOT EXISTS public.scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    registration_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL DEFAULT '',
    college_name TEXT NOT NULL DEFAULT '',
    judge_name TEXT NOT NULL DEFAULT 'Judge 1',
    criterion_technical INT NOT NULL DEFAULT 0,
    criterion_andalusian INT NOT NULL DEFAULT 0,
    criterion_creative INT NOT NULL DEFAULT 0,
    criterion_decorum INT NOT NULL DEFAULT 0,
    penalty_points INT NOT NULL DEFAULT 0,
    penalty_reason TEXT DEFAULT '',
    total_score INT NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.scores ALTER COLUMN registration_id DROP NOT NULL;
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scores_event ON public.scores(event_id);
CREATE INDEX IF NOT EXISTS idx_scores_reg ON public.scores(registration_id);

-- 7. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL DEFAULT 'Super Admin',
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. TEAM LEADERS
CREATE TABLE IF NOT EXISTS public.team_leaders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    leader_name TEXT NOT NULL,
    leader_email TEXT,
    leader_phone TEXT,
    institution_name TEXT NOT NULL,
    team_name TEXT DEFAULT '',
    max_students INT NOT NULL DEFAULT 50,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.team_leaders ALTER COLUMN leader_email DROP NOT NULL;
ALTER TABLE public.team_leaders ALTER COLUMN leader_phone DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_team_leaders_token ON public.team_leaders(token);

-- 9. TEAM STUDENTS (Delegation Roster)
CREATE TABLE IF NOT EXISTS public.team_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_leader_id UUID NOT NULL REFERENCES public.team_leaders(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_code TEXT NOT NULL,
    chest_number TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Senior',
    gender TEXT NOT NULL DEFAULT 'Male',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    assigned_events JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_leader_student_code UNIQUE (team_leader_id, student_code)
);
ALTER TABLE public.team_students ADD COLUMN IF NOT EXISTS chest_number TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_team_students_leader ON public.team_students(team_leader_id);

-- 10. TEAM ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.team_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_leader_id UUID NOT NULL REFERENCES public.team_leaders(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    student_ids JSONB DEFAULT '[]'::jsonb,
    registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_leader_event_assignment UNIQUE (team_leader_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_team_assignments_leader ON public.team_assignments(team_leader_id);
CREATE INDEX IF NOT EXISTS idx_team_assignments_event ON public.team_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_team_assignments_reg ON public.team_assignments(registration_id);

-- 11. TEAM GROUPS (Squads)
CREATE TABLE IF NOT EXISTS public.team_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_leader_id UUID NOT NULL REFERENCES public.team_leaders(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Senior',
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    student_ids JSONB DEFAULT '[]'::jsonb,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_team_groups_leader ON public.team_groups(team_leader_id);
CREATE INDEX IF NOT EXISTS idx_team_groups_event ON public.team_groups(event_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR ALL TABLES
-- Enables full client read/write/update/delete operations for anon, authenticated, and service_role
-- ==============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

DO $$
DECLARE
    tbl text;
    pol record;
    tables text[] := ARRAY[
        'fest_settings', 'events', 'registrations', 'announcements', 
        'winners', 'scores', 'audit_logs', 'team_leaders', 
        'team_students', 'team_assignments', 'team_groups'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        FOR pol IN
            SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = tbl
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, tbl);
        END LOOP;
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);', 'Allow all for ' || tbl, tbl);
        EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated, service_role;', tbl);
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
