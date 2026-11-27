-- ==============================================================================
-- AL MURAFAQA • 5TH EDITION — TEAM LEADER PORTAL & DELEGATION ROSTER ENGINE
-- Migration: 20261126_add_team_leader_portal.sql
-- Enables Admin Token Allocation, Team Leader Self-Service Roster & Programme Desk
-- ==============================================================================

-- Ensure custom_categories column exists in fest_settings
ALTER TABLE public.fest_settings ADD COLUMN IF NOT EXISTS custom_categories JSONB DEFAULT '[]'::jsonb;

-- 1. TEAM LEADERS (Institutional Delegations & Token Provisioning)
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

-- Index token for high-performance direct lookups
CREATE INDEX IF NOT EXISTS idx_team_leaders_token ON public.team_leaders(token);

-- 2. TEAM STUDENTS (Delegation Student Roster)
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
    assigned_events JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of [{ event_id, event_title, ticket_code }]
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_team_students_leader ON public.team_students(team_leader_id);

-- 3. TEAM ASSIGNMENTS (Programme / Event Allocations for Delegations)
CREATE TABLE IF NOT EXISTS public.team_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_leader_id UUID NOT NULL REFERENCES public.team_leaders(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    student_ids JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of student UUIDs
    registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_team_assignments_leader ON public.team_assignments(team_leader_id);
CREATE INDEX IF NOT EXISTS idx_team_assignments_event ON public.team_assignments(event_id);

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) & ACCESS CONTROL
-- ------------------------------------------------------------------------------
ALTER TABLE public.team_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to allow safe re-running
DROP POLICY IF EXISTS "Public can lookup active leader token" ON public.team_leaders;
DROP POLICY IF EXISTS "Admins have full access to team_leaders" ON public.team_leaders;
DROP POLICY IF EXISTS "Allow all for team_leaders" ON public.team_leaders;

DROP POLICY IF EXISTS "Public can access students via delegation" ON public.team_students;
DROP POLICY IF EXISTS "Admins have full access to team_students" ON public.team_students;
DROP POLICY IF EXISTS "Allow all for team_students" ON public.team_students;

DROP POLICY IF EXISTS "Public can view and update team assignments" ON public.team_assignments;
DROP POLICY IF EXISTS "Admins have full access to team_assignments" ON public.team_assignments;
DROP POLICY IF EXISTS "Allow all for team_assignments" ON public.team_assignments;

-- Team Leaders: full access for web portals and admin
CREATE POLICY "Allow all for team_leaders"
    ON public.team_leaders FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Students Roster: readable & insertable/updatable by public/team leader/admin
CREATE POLICY "Allow all for team_students"
    ON public.team_students FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Team Assignments: full access for delegation portal & admin
CREATE POLICY "Allow all for team_assignments"
    ON public.team_assignments FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Permissions
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
