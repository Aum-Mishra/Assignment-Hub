-- ==============================================================================
-- Assignment Hub — Complete Supabase Database & Storage Setup
-- ==============================================================================
-- Features:
-- 1. Public assignments catalogue with high-performance indexes.
-- 2. Secure anonymous ownership: Private secrets table with SHA-256 hash.
-- 3. Secure deletion RPC: Validates uploader secret before removing DB record
--    and returning file_path for cleanup via the Supabase Storage API.
-- 4. Orphaned file cleanup: Automatically removes database records if a ZIP
--    file was deleted from Supabase Storage.
-- 5. Configures public download, upload, and delete policies for Supabase Storage.
-- ==============================================================================

-- 1. Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create the assignments table
CREATE TABLE IF NOT EXISTS public.assignments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Constraints enforcing valid metadata
    CONSTRAINT title_length_check CHECK (char_length(trim(title)) >= 1 AND char_length(trim(title)) <= 150),
    CONSTRAINT file_size_positive CHECK (file_size > 0),
    CONSTRAINT file_name_not_empty CHECK (char_length(trim(file_name)) > 0),
    CONSTRAINT file_path_not_empty CHECK (char_length(trim(file_path)) > 0)
);

-- 3. Create private secrets table for secure anonymous ownership verification
-- IMPORTANT: This table is NEVER exposed to public read queries.
CREATE TABLE IF NOT EXISTS public.assignment_secrets (
    assignment_id BIGINT PRIMARY KEY REFERENCES public.assignments(id) ON DELETE CASCADE,
    secret_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_assignments_created_at_desc
    ON public.assignments (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assignments_title_lower
    ON public.assignments (lower(title));

CREATE INDEX IF NOT EXISTS idx_assignments_title_trgm
    ON public.assignments USING gin (title gin_trgm_ops);

-- 5. Row Level Security (RLS) on public.assignments
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public assignments are viewable by anyone" ON public.assignments;
DROP POLICY IF EXISTS "Anyone can insert assignment metadata" ON public.assignments;
DROP POLICY IF EXISTS "Deny direct public delete" ON public.assignments;
DROP POLICY IF EXISTS "Deny direct public update" ON public.assignments;

-- Allow anyone to read assignments
CREATE POLICY "Public assignments are viewable by anyone"
    ON public.assignments
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Allow public insert via create_assignment RPC or direct insert
CREATE POLICY "Anyone can insert assignment metadata"
    ON public.assignments
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        char_length(trim(title)) >= 1 AND
        char_length(trim(title)) <= 150 AND
        file_size > 0 AND
        file_size <= 26214400 AND
        char_length(trim(file_name)) > 0 AND
        file_path LIKE 'assignments/%'
    );

-- 6. Row Level Security on private assignment_secrets table
ALTER TABLE public.assignment_secrets ENABLE ROW LEVEL SECURITY;

-- 7. Secure Stored Procedure: create_assignment
-- Stores assignment metadata and registers the SHA-256 hash of the deletion secret.
CREATE OR REPLACE FUNCTION public.create_assignment(
    p_title TEXT,
    p_file_path TEXT,
    p_file_name TEXT,
    p_file_size BIGINT,
    p_secret_token TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_assignment public.assignments%ROWTYPE;
    v_hash TEXT;
BEGIN
    -- Validate title
    IF char_length(trim(p_title)) < 1 OR char_length(trim(p_title)) > 150 THEN
        RAISE EXCEPTION 'Title must be between 1 and 150 characters';
    END IF;

    -- Validate file size (max 25MB)
    IF p_file_size <= 0 OR p_file_size > 26214400 THEN
        RAISE EXCEPTION 'File size must be between 1 byte and 25 MB';
    END IF;

    -- Validate path
    IF p_file_path NOT LIKE 'assignments/%' THEN
        RAISE EXCEPTION 'Invalid file storage path';
    END IF;

    -- Validate deletion token
    IF p_secret_token IS NULL OR char_length(trim(p_secret_token)) < 16 THEN
        RAISE EXCEPTION 'A secure deletion secret of at least 16 characters is required';
    END IF;

    -- Compute SHA-256 hash of the uploader secret token
    v_hash := encode(digest(trim(p_secret_token), 'sha256'), 'hex');

    -- Insert public assignment record
    INSERT INTO public.assignments (title, file_path, file_name, file_size)
    VALUES (trim(p_title), p_file_path, p_file_name, p_file_size)
    RETURNING * INTO v_assignment;

    -- Insert into private secrets table
    INSERT INTO public.assignment_secrets (assignment_id, secret_hash)
    VALUES (v_assignment.id, v_hash);

    RETURN to_jsonb(v_assignment);
END;
$$;

-- 8. Secure Stored Procedure: delete_assignment
-- Verifies uploader secret token, deletes DB record, and returns file_path
-- so the frontend can delete the file via the official Supabase Storage API.
CREATE OR REPLACE FUNCTION public.delete_assignment(
    p_id BIGINT,
    p_secret_token TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_hash TEXT;
    v_stored_hash TEXT;
    v_file_path TEXT;
BEGIN
    IF p_secret_token IS NULL OR char_length(trim(p_secret_token)) = 0 THEN
        RAISE EXCEPTION 'Deletion token is required';
    END IF;

    -- Compute SHA-256 hash of provided token
    v_hash := encode(digest(trim(p_secret_token), 'sha256'), 'hex');

    -- Retrieve stored secret hash
    SELECT secret_hash INTO v_stored_hash
    FROM public.assignment_secrets
    WHERE assignment_id = p_id;

    IF v_stored_hash IS NULL OR v_stored_hash <> v_hash THEN
        RAISE EXCEPTION 'Unauthorized: Invalid deletion token for this assignment';
    END IF;

    -- Get file path before deleting record
    SELECT file_path INTO v_file_path
    FROM public.assignments
    WHERE id = p_id;

    -- Delete assignment record (cascades to assignment_secrets)
    DELETE FROM public.assignments
    WHERE id = p_id;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_id', p_id,
        'file_path', v_file_path
    );
END;
$$;

-- 9. Automatic Cleanup of Orphaned Assignments
-- If a ZIP file was removed from Supabase Storage directly, this function
-- cleans up any corresponding database records so they don't linger on the website.
CREATE OR REPLACE FUNCTION public.clean_orphaned_assignments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
    DELETE FROM public.assignments
    WHERE file_path NOT IN (
        SELECT name FROM storage.objects WHERE bucket_id = 'assignments'
        UNION
        SELECT 'assignments/' || name FROM storage.objects WHERE bucket_id = 'assignments'
    );
END;
$$;

-- Grant permissions on tables and RPC functions
GRANT SELECT ON public.assignments TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_assignment(TEXT, TEXT, TEXT, BIGINT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_assignment(BIGINT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clean_orphaned_assignments() TO anon, authenticated;

-- ==============================================================================
-- 10. Storage Bucket Configuration & Storage Policies
-- ==============================================================================

-- Create or update the 'assignments' public bucket
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

-- Storage object policies
DROP POLICY IF EXISTS "Assignment files are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload assignment files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete assignment files" ON storage.objects;

-- Allow anyone to download/read assignment files
CREATE POLICY "Assignment files are publicly readable"
    ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'assignments');

-- Allow anyone to upload objects into the assignments bucket
CREATE POLICY "Anyone can upload assignment files"
    ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        bucket_id = 'assignments' AND
        (storage.extension(name) = 'zip' OR name LIKE '%.zip')
    );

-- Allow deletion of objects in the assignments bucket via the Supabase Storage API
CREATE POLICY "Anyone can delete assignment files"
    ON storage.objects
    FOR DELETE
    TO anon, authenticated
    USING (bucket_id = 'assignments');

-- Run immediate cleanup of any existing orphaned rows right now
SELECT public.clean_orphaned_assignments();

-- Run immediate cleanup of any existing orphaned rows right now
SELECT public.clean_orphaned_assignments();

