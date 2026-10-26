-- ==============================================================================
-- Assignment Hub — Complete Supabase Database & Storage Setup
-- ==============================================================================
-- Description: Creates the public.assignments table, constraints, indexes,
-- Row Level Security (RLS) policies, and configures the 'assignments' public
-- storage bucket for anonymous upload and public download.
--
-- How to run:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your project.
-- 3. In the left navigation, click "SQL Editor".
-- 4. Click "New query", paste the entire contents of this file, and click "Run".
-- ==============================================================================

-- 1. Enable pg_trgm extension for fast case-insensitive title search (optional but recommended)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create the assignments table
CREATE TABLE IF NOT EXISTS public.assignments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Constraints enforcing valid metadata at the database layer
    CONSTRAINT title_length_check CHECK (char_length(trim(title)) >= 1 AND char_length(trim(title)) <= 150),
    CONSTRAINT file_size_positive CHECK (file_size > 0),
    CONSTRAINT file_name_not_empty CHECK (char_length(trim(file_name)) > 0),
    CONSTRAINT file_path_not_empty CHECK (char_length(trim(file_path)) > 0)
);

-- 3. Create indexes for high performance
-- Fast retrieval sorted newest first
CREATE INDEX IF NOT EXISTS idx_assignments_created_at_desc
    ON public.assignments (created_at DESC);

-- Fast case-insensitive prefix & equality title search
CREATE INDEX IF NOT EXISTS idx_assignments_title_lower
    ON public.assignments (lower(title));

-- Fast trigram index for partial / substring search ("contains" matches)
CREATE INDEX IF NOT EXISTS idx_assignments_title_trgm
    ON public.assignments USING gin (title gin_trgm_ops);

-- 4. Configure Row Level Security (RLS) on public.assignments
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running script to make it safely repeatable
DROP POLICY IF EXISTS "Public assignments are viewable by anyone" ON public.assignments;
DROP POLICY IF EXISTS "Anyone can insert assignment metadata" ON public.assignments;

-- Allow anonymous visitors (and authenticated users) to query assignments
CREATE POLICY "Public assignments are viewable by anyone"
    ON public.assignments
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Allow anonymous visitors (and authenticated users) to insert new assignments
-- Enforces title length, positive file size, and bucket path prefix
CREATE POLICY "Anyone can insert assignment metadata"
    ON public.assignments
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        char_length(trim(title)) >= 1 AND
        char_length(trim(title)) <= 150 AND
        file_size > 0 AND
        file_size <= 26214400 AND -- 25MB safety boundary in bytes
        char_length(trim(file_name)) > 0 AND
        file_path LIKE 'assignments/%'
    );

-- NOTE: No UPDATE or DELETE policies are created.
-- In PostgreSQL RLS, omitting UPDATE/DELETE policies completely blocks
-- anonymous and authenticated users from modifying or deleting existing records.

-- Grant table & sequence permissions to Supabase API roles
GRANT SELECT, INSERT ON public.assignments TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ==============================================================================
-- 5. Storage Bucket Configuration
-- ==============================================================================

-- Create or update the 'assignments' public bucket
-- Sets max size to 25MB (26214400 bytes) and restricts mime types to zip formats
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'assignments',
    'assignments',
    true,
    26214400,
    ARRAY['application/zip', 'application/x-zip-compressed', 'multipart/x-zip', 'application/x-zip', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY['application/zip', 'application/x-zip-compressed', 'multipart/x-zip', 'application/x-zip', 'application/octet-stream'];

-- Configure storage policies on storage.objects for the 'assignments' bucket
-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Assignment files are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload assignment files" ON storage.objects;

-- Allow anyone to read/download objects from the 'assignments' bucket
CREATE POLICY "Assignment files are publicly readable"
    ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'assignments');

-- Allow anyone to upload objects into the 'assignments' bucket
-- Requires file path to be in assignments/ and extension to be .zip
CREATE POLICY "Anyone can upload assignment files"
    ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        bucket_id = 'assignments' AND
        (storage.extension(name) = 'zip' OR name LIKE '%.zip')
    );

-- Storage files cannot be updated or deleted by public users.
-- Omitting UPDATE and DELETE policies ensures files are immutable once uploaded.
