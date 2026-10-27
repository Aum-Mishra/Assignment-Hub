-- ==============================================================================
-- Assignment Hub — Complete Supabase Database & Storage Setup
-- ==============================================================================
-- Features:
-- 1. Dual resource sharing: ZIP archives and Multiple named C source code files.
-- 2. Multi-format Notes: text notes, image notes, PDF notes.
-- 3. Public Collaborative Editing: Any visitor can edit any assignment or its notes.
-- 4. 30-Day Backup & Recovery: Automated snapshotting before every EDIT and DELETE.
-- 5. Version Recovery: Restore any previous version of an assignment or notes.
-- 6. Scheduled 30-day cleanup of expired backups.
-- 7. Public Storage configuration for ZIP archives, note images, and PDFs.
-- ==============================================================================

-- 1. Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create or migrate the assignments table
CREATE TABLE IF NOT EXISTS public.assignments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    file_path TEXT UNIQUE,                      -- Nullable if only C code or notes provided
    file_name TEXT,                             -- Original ZIP filename (nullable)
    file_size BIGINT,                           -- ZIP file size in bytes (nullable)
    c_code TEXT,                                -- Legacy single C code text (nullable)
    c_files JSONB DEFAULT '[]'::jsonb,          -- Multiple C code files [{name, code}]
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Safely ensure columns exist for existing tables
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS c_files JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS c_code TEXT;

-- Remove NOT NULL restrictions from ZIP columns to support C-code and notes
ALTER TABLE public.assignments ALTER COLUMN file_path DROP NOT NULL;
ALTER TABLE public.assignments ALTER COLUMN file_name DROP NOT NULL;
ALTER TABLE public.assignments ALTER COLUMN file_size DROP NOT NULL;

-- Constraints
ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS title_length_check;
ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS file_size_positive;
ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS file_name_not_empty;
ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS file_path_not_empty;

ALTER TABLE public.assignments ADD CONSTRAINT title_length_check
    CHECK (char_length(trim(title)) >= 1 AND char_length(trim(title)) <= 150);

ALTER TABLE public.assignments ADD CONSTRAINT file_size_positive
    CHECK (file_size IS NULL OR file_size > 0);

-- 3. Create Assignment Notes table
CREATE TABLE IF NOT EXISTS public.assignment_notes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    assignment_id BIGINT NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    note_type TEXT NOT NULL CHECK (note_type IN ('text', 'image', 'pdf')),
    content TEXT,                               -- Text note content (for 'text' notes)
    file_path TEXT,                             -- Storage path in 'assignments' bucket (e.g. notes/<uuid>-<time>.pdf)
    file_name TEXT,                             -- Original file name (e.g. diagram.png or notes.pdf)
    file_size BIGINT,                           -- File size in bytes
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_assignment_notes_assignment_id ON public.assignment_notes(assignment_id);

-- 4. Create 30-Day Backup & Version History Table
CREATE TABLE IF NOT EXISTS public.assignment_backups (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    assignment_id BIGINT NOT NULL,
    action_type TEXT NOT NULL,                  -- 'EDIT' or 'DELETE'
    title TEXT NOT NULL,
    file_path TEXT,                             -- Previous ZIP storage path
    file_name TEXT,
    file_size BIGINT,
    c_files JSONB DEFAULT '[]'::jsonb,
    notes JSONB DEFAULT '[]'::jsonb,            -- Complete snapshot of notes at that point in time
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_assignment_backups_assignment_id ON public.assignment_backups (assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_backups_created_at ON public.assignment_backups (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_backups_expires_at ON public.assignment_backups (expires_at);

-- 5. Create private secrets table for secure anonymous ownership verification for deletion
CREATE TABLE IF NOT EXISTS public.assignment_secrets (
    assignment_id BIGINT PRIMARY KEY REFERENCES public.assignments(id) ON DELETE CASCADE,
    secret_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_assignments_created_at_desc ON public.assignments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_title_lower ON public.assignments (lower(title));
CREATE INDEX IF NOT EXISTS idx_assignments_title_trgm ON public.assignments USING gin (title gin_trgm_ops);

-- 7. Row Level Security (RLS) on public.assignments
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public assignments are viewable by anyone" ON public.assignments;
DROP POLICY IF EXISTS "Anyone can insert assignment metadata" ON public.assignments;
DROP POLICY IF EXISTS "Anyone can update assignment metadata" ON public.assignments;
DROP POLICY IF EXISTS "Deny direct public delete" ON public.assignments;

CREATE POLICY "Public assignments are viewable by anyone"
    ON public.assignments FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can insert assignment metadata"
    ON public.assignments FOR INSERT TO anon, authenticated
    WITH CHECK (char_length(trim(title)) >= 1 AND char_length(trim(title)) <= 150);

-- Public collaborative editing: Any visitor can update assignments
CREATE POLICY "Anyone can update assignment metadata"
    ON public.assignments FOR UPDATE TO anon, authenticated
    USING (true)
    WITH CHECK (char_length(trim(title)) >= 1 AND char_length(trim(title)) <= 150);

-- 8. Row Level Security on public.assignment_notes
ALTER TABLE public.assignment_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public assignment notes viewable by anyone" ON public.assignment_notes;
DROP POLICY IF EXISTS "Anyone can insert assignment notes" ON public.assignment_notes;
DROP POLICY IF EXISTS "Anyone can update assignment notes" ON public.assignment_notes;
DROP POLICY IF EXISTS "Anyone can delete assignment notes" ON public.assignment_notes;

CREATE POLICY "Public assignment notes viewable by anyone"
    ON public.assignment_notes FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can insert assignment notes"
    ON public.assignment_notes FOR INSERT TO anon, authenticated
    WITH CHECK (char_length(trim(title)) >= 1);

CREATE POLICY "Anyone can update assignment notes"
    ON public.assignment_notes FOR UPDATE TO anon, authenticated
    USING (true)
    WITH CHECK (char_length(trim(title)) >= 1);

CREATE POLICY "Anyone can delete assignment notes"
    ON public.assignment_notes FOR DELETE TO anon, authenticated USING (true);

-- 9. Row Level Security on public.assignment_backups
ALTER TABLE public.assignment_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view assignment backups" ON public.assignment_backups;
DROP POLICY IF EXISTS "Anyone can insert assignment backups" ON public.assignment_backups;

CREATE POLICY "Public can view assignment backups"
    ON public.assignment_backups FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can insert assignment backups"
    ON public.assignment_backups FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 10. Row Level Security on private assignment_secrets table
ALTER TABLE public.assignment_secrets ENABLE ROW LEVEL SECURITY;

-- 11. Automated Backup Trigger: Snapshot BEFORE UPDATE on public.assignments
CREATE OR REPLACE FUNCTION public.trg_backup_assignment_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_notes JSONB;
BEGIN
    -- Snapshot current notes for this assignment
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', id,
                'title', title,
                'note_type', note_type,
                'content', content,
                'file_path', file_path,
                'file_name', file_name,
                'file_size', file_size,
                'created_at', created_at,
                'updated_at', updated_at
            )
        ),
        '[]'::jsonb
    ) INTO v_notes
    FROM public.assignment_notes
    WHERE assignment_id = OLD.id;

    -- Insert backup snapshot (retained for 30 days)
    INSERT INTO public.assignment_backups (
        assignment_id,
        action_type,
        title,
        file_path,
        file_name,
        file_size,
        c_files,
        notes,
        created_at,
        expires_at
    ) VALUES (
        OLD.id,
        'EDIT',
        OLD.title,
        OLD.file_path,
        OLD.file_name,
        OLD.file_size,
        COALESCE(OLD.c_files, '[]'::jsonb),
        v_notes,
        timezone('utc'::text, now()),
        timezone('utc'::text, now()) + interval '30 days'
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_backup_assignment_update ON public.assignments;
CREATE TRIGGER trg_backup_assignment_update
    BEFORE UPDATE ON public.assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_backup_assignment_before_update();

-- 12. Automated Backup Trigger: Snapshot BEFORE DELETE on public.assignments
CREATE OR REPLACE FUNCTION public.trg_backup_assignment_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_notes JSONB;
BEGIN
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', id,
                'title', title,
                'note_type', note_type,
                'content', content,
                'file_path', file_path,
                'file_name', file_name,
                'file_size', file_size,
                'created_at', created_at,
                'updated_at', updated_at
            )
        ),
        '[]'::jsonb
    ) INTO v_notes
    FROM public.assignment_notes
    WHERE assignment_id = OLD.id;

    INSERT INTO public.assignment_backups (
        assignment_id,
        action_type,
        title,
        file_path,
        file_name,
        file_size,
        c_files,
        notes,
        created_at,
        expires_at
    ) VALUES (
        OLD.id,
        'DELETE',
        OLD.title,
        OLD.file_path,
        OLD.file_name,
        OLD.file_size,
        COALESCE(OLD.c_files, '[]'::jsonb),
        v_notes,
        timezone('utc'::text, now()),
        timezone('utc'::text, now()) + interval '30 days'
    );

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_backup_assignment_delete ON public.assignments;
CREATE TRIGGER trg_backup_assignment_delete
    BEFORE DELETE ON public.assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_backup_assignment_before_delete();

-- 13. Stored Procedure: create_assignment
CREATE OR REPLACE FUNCTION public.create_assignment(
    p_title TEXT,
    p_file_path TEXT DEFAULT NULL,
    p_file_name TEXT DEFAULT NULL,
    p_file_size BIGINT DEFAULT NULL,
    p_c_code TEXT DEFAULT NULL,
    p_secret_token TEXT DEFAULT NULL,
    p_c_files JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_assignment public.assignments%ROWTYPE;
    v_hash TEXT;
    v_clean_title TEXT;
    v_c_files JSONB;
    v_c_files_count INT;
BEGIN
    v_clean_title := trim(p_title);
    IF char_length(v_clean_title) < 1 OR char_length(v_clean_title) > 150 THEN
        RAISE EXCEPTION 'Title must be between 1 and 150 characters';
    END IF;

    v_c_files := COALESCE(p_c_files, '[]'::jsonb);
    IF jsonb_typeof(v_c_files) <> 'array' THEN
        v_c_files := '[]'::jsonb;
    END IF;
    v_c_files_count := jsonb_array_length(v_c_files);

    IF p_file_path IS NOT NULL AND char_length(trim(p_file_path)) > 0 THEN
        IF p_file_path NOT LIKE 'assignments/%' THEN
            RAISE EXCEPTION 'Invalid file storage path';
        END IF;
        IF p_file_size IS NOT NULL AND (p_file_size <= 0 OR p_file_size > 26214400) THEN
            RAISE EXCEPTION 'ZIP file size must be between 1 byte and 25 MB';
        END IF;
    END IF;

    IF p_secret_token IS NULL OR char_length(trim(p_secret_token)) < 16 THEN
        RAISE EXCEPTION 'A secure deletion secret of at least 16 characters is required';
    END IF;

    v_hash := encode(digest(trim(p_secret_token), 'sha256'), 'hex');

    INSERT INTO public.assignments (
        title,
        file_path,
        file_name,
        file_size,
        c_code,
        c_files
    )
    VALUES (
        v_clean_title,
        NULLIF(trim(p_file_path), ''),
        NULLIF(trim(p_file_name), ''),
        p_file_size,
        NULLIF(trim(p_c_code), ''),
        v_c_files
    )
    RETURNING * INTO v_assignment;

    INSERT INTO public.assignment_secrets (assignment_id, secret_hash)
    VALUES (v_assignment.id, v_hash);

    RETURN to_jsonb(v_assignment);
END;
$$;

-- 14. Stored Procedure: edit_assignment (Public Collaborative Editing)
CREATE OR REPLACE FUNCTION public.edit_assignment(
    p_id BIGINT,
    p_title TEXT,
    p_file_path TEXT DEFAULT NULL,
    p_file_name TEXT DEFAULT NULL,
    p_file_size BIGINT DEFAULT NULL,
    p_c_files JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_title TEXT;
    v_updated public.assignments%ROWTYPE;
BEGIN
    v_clean_title := trim(p_title);
    IF char_length(v_clean_title) < 1 OR char_length(v_clean_title) > 150 THEN
        RAISE EXCEPTION 'Title must be between 1 and 150 characters';
    END IF;

    -- The BEFORE UPDATE trigger will automatically save a backup before this executes!
    UPDATE public.assignments
    SET title = v_clean_title,
        file_path = NULLIF(trim(p_file_path), ''),
        file_name = NULLIF(trim(p_file_name), ''),
        file_size = p_file_size,
        c_files = COALESCE(p_c_files, '[]'::jsonb)
    WHERE id = p_id
    RETURNING * INTO v_updated;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment not found with ID %', p_id;
    END IF;

    RETURN to_jsonb(v_updated);
END;
$$;

-- 15. Stored Procedure: delete_assignment
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

    v_hash := encode(digest(trim(p_secret_token), 'sha256'), 'hex');

    SELECT secret_hash INTO v_stored_hash
    FROM public.assignment_secrets
    WHERE assignment_id = p_id;

    IF v_stored_hash IS NULL OR v_stored_hash <> v_hash THEN
        RAISE EXCEPTION 'Unauthorized: Invalid deletion token for this assignment';
    END IF;

    SELECT file_path INTO v_file_path
    FROM public.assignments
    WHERE id = p_id;

    -- The BEFORE DELETE trigger will automatically save a backup into public.assignment_backups!
    -- Note: We preserve the actual storage file in storage for 30 days so backups remain recoverable!
    DELETE FROM public.assignments
    WHERE id = p_id;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_id', p_id,
        'file_path', v_file_path
    );
END;
$$;

-- 16. Stored Procedure: restore_assignment_version (Recovery Mechanism)
CREATE OR REPLACE FUNCTION public.restore_assignment_version(p_backup_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_backup public.assignment_backups%ROWTYPE;
    v_assignment public.assignments%ROWTYPE;
    v_exists BOOLEAN;
    v_note JSONB;
BEGIN
    SELECT * INTO v_backup
    FROM public.assignment_backups
    WHERE id = p_backup_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Backup version not found with ID %', p_backup_id;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.assignments WHERE id = v_backup.assignment_id
    ) INTO v_exists;

    IF v_exists THEN
        -- Assignment still exists: restore properties
        UPDATE public.assignments
        SET title = v_backup.title,
            file_path = v_backup.file_path,
            file_name = v_backup.file_name,
            file_size = v_backup.file_size,
            c_files = v_backup.c_files
        WHERE id = v_backup.assignment_id
        RETURNING * INTO v_assignment;

        -- Remove current notes and re-inject restored snapshot
        DELETE FROM public.assignment_notes WHERE assignment_id = v_backup.assignment_id;
    ELSE
        -- Assignment was deleted: re-insert assignment record
        INSERT INTO public.assignments (
            id,
            title,
            file_path,
            file_name,
            file_size,
            c_files,
            created_at
        ) OVERRIDING SYSTEM VALUE
        VALUES (
            v_backup.assignment_id,
            v_backup.title,
            v_backup.file_path,
            v_backup.file_name,
            v_backup.file_size,
            v_backup.c_files,
            v_backup.created_at
        )
        RETURNING * INTO v_assignment;
    END IF;

    -- Re-insert notes from the snapshot
    IF jsonb_typeof(v_backup.notes) = 'array' AND jsonb_array_length(v_backup.notes) > 0 THEN
        FOR v_note IN SELECT * FROM jsonb_array_elements(v_backup.notes)
        LOOP
            INSERT INTO public.assignment_notes (
                assignment_id,
                title,
                note_type,
                content,
                file_path,
                file_name,
                file_size,
                created_at,
                updated_at
            ) VALUES (
                v_backup.assignment_id,
                COALESCE(v_note->>'title', 'Untitled Note'),
                COALESCE(v_note->>'note_type', 'text'),
                v_note->>'content',
                v_note->>'file_path',
                v_note->>'file_name',
                (v_note->>'file_size')::BIGINT,
                COALESCE((v_note->>'created_at')::TIMESTAMPTZ, timezone('utc'::text, now())),
                timezone('utc'::text, now())
            );
        END LOOP;
    END IF;

    RETURN to_jsonb(v_assignment);
END;
$$;

-- 17. Stored Procedure: cleanup_expired_backups (30-day Retention Cleanup)
CREATE OR REPLACE FUNCTION public.cleanup_expired_backups()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    v_expired_count INT;
    v_file_rec RECORD;
BEGIN
    -- Remove storage files that belong exclusively to expired backups and are not referenced in active assignments or unexpired backups
    FOR v_file_rec IN
        SELECT DISTINCT b.file_path
        FROM public.assignment_backups b
        WHERE b.expires_at < timezone('utc'::text, now())
          AND b.file_path IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.assignments a WHERE a.file_path = b.file_path
          )
          AND NOT EXISTS (
              SELECT 1 FROM public.assignment_backups unexp 
              WHERE unexp.expires_at >= timezone('utc'::text, now()) 
                AND unexp.file_path = b.file_path
          )
    LOOP
        DELETE FROM storage.objects
        WHERE bucket_id = 'assignments'
          AND (name = v_file_rec.file_path OR name = regexp_replace(v_file_rec.file_path, '^assignments/', ''));
    END LOOP;

    -- Delete expired backup rows
    WITH deleted AS (
        DELETE FROM public.assignment_backups
        WHERE expires_at < timezone('utc'::text, now())
        RETURNING id
    )
    SELECT count(*) INTO v_expired_count FROM deleted;

    RETURN jsonb_build_object('cleaned_backups_count', v_expired_count);
END;
$$;

-- Grant permissions on tables and RPC functions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_notes TO anon, authenticated;
GRANT SELECT, INSERT ON public.assignment_backups TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_assignment(TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.edit_assignment(BIGINT, TEXT, TEXT, TEXT, BIGINT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_assignment(BIGINT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_assignment_version(BIGINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_backups() TO anon, authenticated;

-- ==============================================================================
-- 18. Storage Bucket Configuration & Storage Policies
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'assignments',
    'assignments',
    true,
    26214400,
    ARRAY[
        'application/zip', 'application/x-zip-compressed', 'multipart/x-zip', 'application/x-zip', 'application/octet-stream',
        'application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'text/plain'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY[
        'application/zip', 'application/x-zip-compressed', 'multipart/x-zip', 'application/x-zip', 'application/octet-stream',
        'application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'text/plain'
    ];

DROP POLICY IF EXISTS "Assignment files are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload assignment files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload assignment and note files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete assignment files" ON storage.objects;

-- Allow public read of all files in assignments bucket
CREATE POLICY "Assignment files are publicly readable"
    ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'assignments');

-- Allow uploads for ZIP archives, PDFs, and images (notes)
CREATE POLICY "Anyone can upload assignment and note files"
    ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        bucket_id = 'assignments' AND
        (
            storage.extension(name) IN ('zip', 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'txt') OR
            name ~* '\.(zip|pdf|png|jpg|jpeg|webp|gif|txt)$'
        )
    );

CREATE POLICY "Anyone can delete assignment files"
    ON storage.objects
    FOR DELETE
    TO anon, authenticated
    USING (bucket_id = 'assignments');
