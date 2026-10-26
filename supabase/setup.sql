-- ==============================================================================
-- Assignment Hub — Complete Supabase Database & Storage Setup
-- ==============================================================================
-- Features:
-- 1. Dual resource sharing: ZIP archives, C source code (.c), or both.
-- 2. Public assignments catalogue with high-performance indexes.
-- 3. Secure anonymous ownership: Private secrets table with SHA-256 hash.
-- 4. Secure deletion RPC: Validates uploader secret before removing DB record
--    and returning file_path for cleanup via the Supabase Storage API.
-- 5. Safe orphaned file cleanup: Cleans orphaned storage records while
--    protecting pure C-code submissions.
-- 6. Configures public download, upload, and delete policies for Supabase Storage.
-- ==============================================================================

-- 1. Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create the assignments table supporting ZIP files, C source code, or both
CREATE TABLE IF NOT EXISTS public.assignments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    file_path TEXT UNIQUE,       -- Nullable if only C code is uploaded
    file_name TEXT,              -- Original ZIP filename (nullable)
    file_size BIGINT,            -- ZIP file size in bytes (nullable)
    c_code TEXT,                 -- Full C source code text (nullable)
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Constraints
    CONSTRAINT title_length_check CHECK (char_length(trim(title)) >= 1 AND char_length(trim(title)) <= 150),
    CONSTRAINT file_size_positive CHECK (file_size IS NULL OR file_size > 0),
    CONSTRAINT at_least_one_content CHECK (
        file_path IS NOT NULL OR (c_code IS NOT NULL AND char_length(trim(c_code)) > 0)
    )
);

-- If table already exists without c_code or with NOT NULL file constraints, alter them safely:
DO $$
BEGIN
    -- Add c_code column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'c_code'
    ) THEN
        ALTER TABLE public.assignments ADD COLUMN c_code TEXT;
    END IF;

    -- Make file_path, file_name, file_size nullable if they were previously NOT NULL
    ALTER TABLE public.assignments ALTER COLUMN file_path DROP NOT NULL;
    ALTER TABLE public.assignments ALTER COLUMN file_name DROP NOT NULL;
    ALTER TABLE public.assignments ALTER COLUMN file_size DROP NOT NULL;

    -- Drop older constraints if they existed
    ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS file_name_not_empty;
    ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS file_path_not_empty;
    ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS at_least_one_content;
    
    -- Re-add at_least_one_content constraint
    ALTER TABLE public.assignments ADD CONSTRAINT at_least_one_content CHECK (
        file_path IS NOT NULL OR (c_code IS NOT NULL AND char_length(trim(c_code)) > 0)
    );
EXCEPTION WHEN OTHERS THEN
    -- Ignore alteration conflicts on fresh databases
    NULL;
END $$;

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
DROP POLICY IF EXISTS "Anyone can update assignment metadata" ON public.assignments;
DROP POLICY IF EXISTS "Deny direct public delete" ON public.assignments;

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
        (file_path IS NOT NULL OR (c_code IS NOT NULL AND char_length(trim(c_code)) > 0))
    );

-- Allow renaming titles and filenames
CREATE POLICY "Anyone can update assignment metadata"
    ON public.assignments
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (
        char_length(trim(title)) >= 1 AND
        char_length(trim(title)) <= 150
    );

-- 6. Row Level Security on private assignment_secrets table
ALTER TABLE public.assignment_secrets ENABLE ROW LEVEL SECURITY;

-- 7. Secure Stored Procedure: create_assignment
-- Stores assignment metadata (ZIP details, C source code, or both) and registers SHA-256 secret.
CREATE OR REPLACE FUNCTION public.create_assignment(
    p_title TEXT,
    p_file_path TEXT DEFAULT NULL,
    p_file_name TEXT DEFAULT NULL,
    p_file_size BIGINT DEFAULT NULL,
    p_c_code TEXT DEFAULT NULL,
    p_secret_token TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_assignment public.assignments%ROWTYPE;
    v_hash TEXT;
    v_clean_c_code TEXT;
    v_clean_title TEXT;
BEGIN
    v_clean_title := trim(p_title);
    IF char_length(v_clean_title) < 1 OR char_length(v_clean_title) > 150 THEN
        RAISE EXCEPTION 'Title must be between 1 and 150 characters';
    END IF;

    -- Clean C code
    v_clean_c_code := NULLIF(trim(p_c_code), '');

    -- Verify that at least one form of content is provided
    IF (p_file_path IS NULL OR char_length(trim(p_file_path)) = 0) AND v_clean_c_code IS NULL THEN
        RAISE EXCEPTION 'Please provide either a ZIP file, C source code, or both';
    END IF;

    -- Validate ZIP file parameters if provided
    IF p_file_path IS NOT NULL AND char_length(trim(p_file_path)) > 0 THEN
        IF p_file_path NOT LIKE 'assignments/%' THEN
            RAISE EXCEPTION 'Invalid file storage path';
        END IF;
        IF p_file_size IS NOT NULL AND (p_file_size <= 0 OR p_file_size > 26214400) THEN
            RAISE EXCEPTION 'ZIP file size must be between 1 byte and 25 MB';
        END IF;
    END IF;

    -- Validate deletion token
    IF p_secret_token IS NULL OR char_length(trim(p_secret_token)) < 16 THEN
        RAISE EXCEPTION 'A secure deletion secret of at least 16 characters is required';
    END IF;

    -- Compute SHA-256 hash of the uploader secret token
    v_hash := encode(digest(trim(p_secret_token), 'sha256'), 'hex');

    -- Insert assignment record
    INSERT INTO public.assignments (
        title,
        file_path,
        file_name,
        file_size,
        c_code
    )
    VALUES (
        v_clean_title,
        NULLIF(trim(p_file_path), ''),
        NULLIF(trim(p_file_name), ''),
        p_file_size,
        v_clean_c_code
    )
    RETURNING * INTO v_assignment;

    -- Insert into private secrets table
    INSERT INTO public.assignment_secrets (assignment_id, secret_hash)
    VALUES (v_assignment.id, v_hash);

    RETURN to_jsonb(v_assignment);
END;
$$;

-- 8. Secure Stored Procedure: delete_assignment
-- Verifies uploader secret token, deletes DB record, and returns file_path
-- so the frontend can delete the ZIP from storage if it existed.
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

-- 9. Stored Procedure: rename_assignment
CREATE OR REPLACE FUNCTION public.rename_assignment(
    p_id BIGINT,
    p_new_title TEXT,
    p_new_file_name TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_title TEXT;
    v_clean_filename TEXT;
    v_updated assignments%ROWTYPE;
BEGIN
    v_clean_title := trim(p_new_title);
    IF char_length(v_clean_title) < 1 OR char_length(v_clean_title) > 150 THEN
        RAISE EXCEPTION 'Title must be between 1 and 150 characters';
    END IF;

    IF p_new_file_name IS NOT NULL AND char_length(trim(p_new_file_name)) > 0 THEN
        v_clean_filename := trim(p_new_file_name);
        IF NOT v_clean_filename ILIKE '%.zip' THEN
            v_clean_filename := v_clean_filename || '.zip';
        END IF;
    END IF;

    UPDATE public.assignments
    SET title = v_clean_title,
        file_name = COALESCE(v_clean_filename, file_name)
    WHERE id = p_id
    RETURNING * INTO v_updated;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment not found';
    END IF;

    RETURN to_jsonb(v_updated);
END;
$$;

-- 10. Automatic Cleanup of Orphaned ZIP Assignments
-- Only cleans assignments that had a ZIP file (file_path IS NOT NULL) which is missing from storage.
-- Pure C-code assignments (file_path IS NULL) are safely protected!
CREATE OR REPLACE FUNCTION public.clean_orphaned_assignments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
    DELETE FROM public.assignments
    WHERE file_path IS NOT NULL
      AND file_path NOT IN (
        SELECT name FROM storage.objects WHERE bucket_id = 'assignments'
        UNION
        SELECT 'assignments/' || name FROM storage.objects WHERE bucket_id = 'assignments'
    );
END;
$$;

-- Grant permissions on tables and RPC functions
GRANT SELECT, INSERT, UPDATE ON public.assignments TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_assignment(TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_assignment(BIGINT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rename_assignment(BIGINT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clean_orphaned_assignments() TO anon, authenticated;

-- ==============================================================================
-- 11. Storage Bucket Configuration & Storage Policies
-- ==============================================================================

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

DROP POLICY IF EXISTS "Assignment files are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload assignment files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete assignment files" ON storage.objects;

CREATE POLICY "Assignment files are publicly readable"
    ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'assignments');

CREATE POLICY "Anyone can upload assignment files"
    ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        bucket_id = 'assignments' AND
        (storage.extension(name) = 'zip' OR name LIKE '%.zip')
    );

CREATE POLICY "Anyone can delete assignment files"
    ON storage.objects
    FOR DELETE
    TO anon, authenticated
    USING (bucket_id = 'assignments');

-- Run safe immediate cleanup
SELECT public.clean_orphaned_assignments();
