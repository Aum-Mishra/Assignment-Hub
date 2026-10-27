# Assignment Hub — Public Assignment Sharing Platform

**Assignment Hub** is an open-access platform where students can share assignment files, source code, and notes with classmates. No registration, login, or accounts are required.

Visitors can upload **ZIP archives**, manage **multiple C source code files (.c)**, attach **rich notes** (text, PDFs, images), and **publicly edit** any assignment. Every edit and deletion automatically preserves a **30-day backup history** with 1-click restore.

---

## Key Features

1. **ZIP Archives & Multiple C Files**:
   - **Upload Options**: Share a `.zip` archive and/or attach multiple named `.c` source files (e.g. `main.c`, `stack.c`).
   - **Download Options**:
     - **Download ZIP**: Downloads the original `.zip` file from Supabase Storage.
     - **Download C Files**: Automatically downloads each `.c` source code file separately as native files (preserving formatting and line breaks), never bundled as an unwanted archive.
     - **Copy Code**: 1-click copy for any individual C file's complete code directly to the clipboard.

2. **Notes Tab & Resource Attachments**:
   - Create multiple named notes per assignment.
   - **Text Notes**: Built-in markdown-friendly text editor.
   - **File Notes**: Upload PDF documents and images (PNG, JPG, WEBP, GIF) with inline preview and direct download.
   - Stored reliably in Supabase PostgreSQL and Supabase Storage (`notes/` folder).

3. **Public Collaborative Editing**:
   - Anyone can edit any assignment without needing an account or secret key.
   - Click **Edit** to update titles, replace or remove ZIP archives, add/edit/delete C code files, or manage notes.
   - Updates are immediately reflected for all visitors.

4. **30-Day Automated Backups & 1-Click Recovery**:
   - Whenever an assignment is modified, replaced, or deleted, a full snapshot is automatically created and retained for 30 days.
   - **1-Click Restore**: Visitors and instructors can open the **30-Day History** modal from any assignment and immediately roll back to any historical version.
   - Files are logically isolated and protected from premature storage deletion.
   - Expired backups (> 30 days) can be automatically purged without affecting active files.

5. **Compact Main Page & Fast Search**:
   - Clean, compact SaaS layout fitting 15–25 assignments per screen.
   - Resource indicators (`ZIP`, `.c` files, `Notes`), upload date, and download buttons.
   - Instant title search with debouncing.
   - Responsive layout collapsing smoothly on mobile devices.

6. **Secure Anonymous Deletion**:
   - Original uploaders receive a 32-character secret key saved automatically in browser `localStorage`.
   - The database stores only a SHA-256 hash in a private table with Row Level Security (RLS).
   - Deleting preserves a 30-day backup snapshot before removing active records.

---

## Local Development (Ubuntu)

```bash
cd "/home/aum/Desktop/ML/Computer Networks/Assignment Hub"

# Install dependencies
npm install

# Configure environment variables in .env.local:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key

# Run unit tests
npm test

# Build production bundle
npm run build

# Start dev server
npm run dev
```

---

## Supabase Database Setup

1. Open your [Supabase Dashboard](https://supabase.com/dashboard) &rarr; **SQL Editor**.
2. Open [`supabase/setup.sql`](./supabase/setup.sql), copy everything, and paste it into the SQL Editor.
3. Click **Run**.

This sets up:
- `public.assignments`: Main table storing metadata, ZIP paths, and `c_files` (JSONB array of `{name, code}`).
- `public.assignment_notes`: Supports text notes as well as PDF and image file notes.
- `public.assignment_backups`: 30-day version history log with automated trigger snapshots.
- `public.assignment_secrets`: Private table storing deletion token hashes.
- Storage bucket `assignments`: Public download and authenticated/anon uploads for ZIP, PDF, PNG, JPG, WEBP, and GIF files.
- Automated triggers: `trg_backup_assignment_before_update` and `trg_backup_assignment_before_delete`.
- RPC functions:
  - `create_assignment`: Atomic assignment creation with deletion key hashing.
  - `edit_assignment`: Public updates with snapshot backup creation.
  - `restore_assignment_version`: 1-click restoration of any 30-day historical snapshot.
  - `delete_assignment`: Authenticated deletion requiring token check.
  - `cleanup_expired_backups`: Purges backups older than 30 days.

---

## 30-Day Backup & Recovery Guide

### Automated 1-Click Restore (Frontend)
Visitors can click the **History (clock icon)** button on any assignment row or inside the Edit modal to inspect the last 30 days of snapshots and click **Restore This Version**.

### Administrative SQL Recovery (Supabase SQL Editor)
If an assignment was deleted completely and someone needs to restore it directly via SQL:

```sql
-- 1. View all backups in the last 30 days
SELECT id, assignment_id, title, action_type, created_at, expires_at
FROM public.assignment_backups
ORDER BY created_at DESC;

-- 2. Restore a specific snapshot by its backup ID (e.g. backup ID 42)
SELECT public.restore_assignment_version(42);
```

### Scheduled 30-Day Cleanup (Optional pg_cron)
To automatically delete snapshots that have passed their 30-day retention window:

```sql
-- Run daily at 03:00 UTC via Supabase Database -> Extensions -> pg_cron
SELECT cron.schedule('cleanup-expired-backups-daily', '0 3 * * *', $$
  SELECT public.cleanup_expired_backups();
$$);
```

---

## Git & Vercel Deployment

```bash
git add .
git commit -m "feat: notes section, public editing, and 30-day automated backup and recovery"
git push origin main
```

Vercel will automatically detect the commit and deploy your live site!
Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured in Vercel Project Settings &rarr; Environment Variables.
