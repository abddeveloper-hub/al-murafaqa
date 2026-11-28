-- ==============================================================================
-- AL MURAFAQA • FEST JUDGMENT SYSTEM & TOKEN-BASED JUDGE PORTAL
-- Migration: 20261128_add_judge_judgment_system.sql
-- Execute in Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. JUDGE TOKENS (Token-based Fest Assignment)
CREATE TABLE IF NOT EXISTS public.judge_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    judge_name TEXT NOT NULL,
    judge_email TEXT NOT NULL DEFAULT '',
    fest_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ NULL,
    last_activity_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_judge_tokens_fest_id ON public.judge_tokens(fest_id);
CREATE INDEX IF NOT EXISTS idx_judge_tokens_active ON public.judge_tokens(is_active);

-- 2. JUDGMENT ENTRIES (Rules, Criteria, Remarks & Publication State)
CREATE TABLE IF NOT EXISTS public.judgment_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fest_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    judge_token_id UUID NOT NULL REFERENCES public.judge_tokens(id) ON DELETE CASCADE,
    rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    rules_summary TEXT NOT NULL DEFAULT '',
    scores_or_remarks JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'PUBLISHED')),
    is_published BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_fest_judge_token_entry'
          AND conrelid = 'public.judgment_entries'::regclass
    ) THEN
        ALTER TABLE public.judgment_entries
            ADD CONSTRAINT unique_fest_judge_token_entry UNIQUE (fest_id, judge_token_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_judgment_entries_fest_id ON public.judgment_entries(fest_id);
CREATE INDEX IF NOT EXISTS idx_judgment_entries_token_id ON public.judgment_entries(judge_token_id);
CREATE INDEX IF NOT EXISTS idx_judgment_entries_published_fest
    ON public.judgment_entries(fest_id, published_at DESC)
    WHERE is_published = true;

-- 3. ROW LEVEL SECURITY & EXPLICIT SCHEMA/TABLE GRANTS
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

ALTER TABLE public.judge_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judgment_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for judge_tokens" ON public.judge_tokens;
CREATE POLICY "Allow all for judge_tokens"
    ON public.judge_tokens FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for judgment_entries" ON public.judgment_entries;
CREATE POLICY "Allow all for judgment_entries"
    ON public.judgment_entries FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

GRANT ALL ON public.judge_tokens TO anon, authenticated, service_role;
GRANT ALL ON public.judgment_entries TO anon, authenticated, service_role;

-- 4. TOKEN VERIFICATION, STRICT FEST-SCOPE WRITE & PUBLIC-FILTERED READ RPCS
CREATE OR REPLACE FUNCTION public.verify_judge_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_clean_token TEXT;
    v_tok public.judge_tokens%ROWTYPE;
    v_fest public.events%ROWTYPE;
    v_entry public.judgment_entries%ROWTYPE;
    v_has_entry BOOLEAN := false;
BEGIN
    v_clean_token := upper(regexp_replace(trim(coalesce(p_token, '')), '\s+', '-', 'g'));
    IF v_clean_token = '' THEN
        RAISE EXCEPTION 'Access token is required.' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_tok
    FROM public.judge_tokens
    WHERE upper(trim(token)) = v_clean_token
    LIMIT 1;

    IF NOT FOUND OR v_tok.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'This token is invalid or has been revoked by the admin' USING ERRCODE = 'P0001';
    END IF;

    IF v_tok.expires_at IS NOT NULL AND v_tok.expires_at <= timezone('utc'::text, now()) THEN
        RAISE EXCEPTION 'This access token has expired. Please contact the festival administration.' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_fest
    FROM public.events
    WHERE id = v_tok.fest_id
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'The fest assigned to this token no longer exists.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.judge_tokens
    SET last_activity_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_tok.id;

    SELECT * INTO v_entry
    FROM public.judgment_entries
    WHERE fest_id = v_tok.fest_id
      AND judge_token_id = v_tok.id
    LIMIT 1;
    v_has_entry := FOUND;

    RETURN jsonb_build_object(
        'tokenRecord', to_jsonb(v_tok),
        'fest', to_jsonb(v_fest),
        'entry', CASE WHEN v_has_entry THEN to_jsonb(v_entry) ELSE NULL END
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_judge_judgment(
    p_token TEXT,
    p_fest_id UUID,
    p_rules JSONB,
    p_rules_summary TEXT DEFAULT '',
    p_scores_or_remarks JSONB DEFAULT '[]'::jsonb
)
RETURNS public.judgment_entries
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_clean_token TEXT;
    v_tok public.judge_tokens%ROWTYPE;
    v_rules JSONB := COALESCE(p_rules, '[]'::jsonb);
    v_remarks JSONB := COALESCE(p_scores_or_remarks, '[]'::jsonb);
    v_summary TEXT := trim(coalesce(p_rules_summary, ''));
    v_saved public.judgment_entries%ROWTYPE;
BEGIN
    v_clean_token := upper(regexp_replace(trim(coalesce(p_token, '')), '\s+', '-', 'g'));
    IF v_clean_token = '' THEN
        RAISE EXCEPTION 'This token is invalid or has been revoked by the admin' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_tok
    FROM public.judge_tokens
    WHERE upper(trim(token)) = v_clean_token
    LIMIT 1;

    IF NOT FOUND OR v_tok.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'This token is invalid or has been revoked by the admin' USING ERRCODE = 'P0001';
    END IF;

    IF v_tok.expires_at IS NOT NULL AND v_tok.expires_at <= timezone('utc'::text, now()) THEN
        RAISE EXCEPTION 'This access token has expired. Please contact the festival administration.' USING ERRCODE = 'P0001';
    END IF;

    IF v_tok.fest_id IS DISTINCT FROM p_fest_id THEN
        RAISE EXCEPTION 'Unauthorized scope: this judge token is locked to a different fest.' USING ERRCODE = '42501';
    END IF;

    IF jsonb_typeof(v_rules) <> 'array' THEN
        RAISE EXCEPTION 'Invalid rules payload format.' USING ERRCODE = '22023';
    END IF;

    IF jsonb_array_length(v_rules) = 0 AND v_summary = '' THEN
        RAISE EXCEPTION 'Please enter at least one judgment rule/criterion or summary before saving.' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.judgment_entries (
        fest_id,
        judge_token_id,
        rules,
        rules_summary,
        scores_or_remarks,
        status,
        is_published,
        published_at,
        created_at,
        updated_at
    ) VALUES (
        v_tok.fest_id,
        v_tok.id,
        v_rules,
        v_summary,
        CASE WHEN jsonb_typeof(v_remarks) = 'array' THEN v_remarks ELSE '[]'::jsonb END,
        'SUBMITTED',
        false,
        NULL,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (fest_id, judge_token_id) DO UPDATE SET
        rules = EXCLUDED.rules,
        rules_summary = EXCLUDED.rules_summary,
        scores_or_remarks = EXCLUDED.scores_or_remarks,
        status = 'SUBMITTED',
        is_published = false,
        published_at = NULL,
        updated_at = timezone('utc'::text, now())
    RETURNING * INTO v_saved;

    UPDATE public.judge_tokens
    SET last_activity_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_tok.id;

    RETURN v_saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_fest_judgments(p_fest_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT COALESCE(jsonb_agg(row_obj ORDER BY row_obj->>'published_at' DESC NULLS LAST), '[]'::jsonb)
    FROM (
        SELECT jsonb_build_object(
            'id', je.id,
            'fest_id', je.fest_id,
            'rules', je.rules,
            'rules_summary', je.rules_summary,
            'scores_or_remarks', je.scores_or_remarks,
            'status', je.status,
            'is_published', je.is_published,
            'published_at', je.published_at,
            'updated_at', je.updated_at,
            'judge_name', jt.judge_name,
            'fest', jsonb_build_object(
                'id', e.id,
                'code', e.code,
                'title', e.title,
                'category', e.category,
                'venue', e.venue,
                'day_number', e.day_number,
                'time_slot', e.time_slot,
                'event_date', e.event_date,
                'status', e.status,
                'rules', e.rules
            )
        ) AS row_obj
        FROM public.judgment_entries je
        JOIN public.events e ON e.id = je.fest_id
        JOIN public.judge_tokens jt ON jt.id = je.judge_token_id
        WHERE je.is_published = true
          AND (p_fest_id IS NULL OR je.fest_id = p_fest_id)
    ) sub;
$$;

GRANT EXECUTE ON FUNCTION public.verify_judge_token(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_judge_judgment(TEXT, UUID, JSONB, TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_fest_judgments(UUID) TO anon, authenticated, service_role;

-- 5. ENABLE SUPABASE REALTIME FOR JUDGMENT REVIEW
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.judge_tokens;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.judgment_entries;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
