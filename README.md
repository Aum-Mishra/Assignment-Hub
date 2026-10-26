# Assignment Hub — Public Assignment Sharing Platform

**Assignment Hub** is an open-access platform where students can share assignment files with classmates. No registration, login, or accounts are required.

Visitors can upload **ZIP archives**, paste complete **C source code (.c)**, or provide **both** in a single submission. All visitors can browse, search, and download resources with 1 click, while only the original uploader can securely delete their own submission.

---

## Key Features

1. **Dual Resource Support (ZIP & C Code)**:
   - **Upload Options**: Share a `.zip` archive, paste full `.c` source code, or provide both.
   - **Separate Downloads**:
     - **Download ZIP**: Downloads the original `.zip` file from Supabase Storage.
     - **Download C Code**: Automatically downloads a clean `.c` file named after the assignment title (e.g. `socket_programming.c`), preserving line breaks, tabs, and indentation.
     - Download buttons only appear if that resource exists for the assignment.
2. **Compact Main Page**:
   - Ultra-clean table layout fitting 15–25 assignments per screen.
   - Prominent bold titles, resource badges (`ZIP`, `C Code`), upload date, and download buttons.
   - Collapses into clean cards on mobile devices.
3. **Instant Search**:
   - Live, case-insensitive title search directly above the table.
4. **Secure Anonymous Deletion**:
   - Each upload generates a 32-character secret key saved automatically in the uploader's browser (`localStorage`).
   - The database stores only a SHA-256 hash in a private table with Row Level Security (RLS) blocking public reads.
   - Deleting verifies the key, deletes the database record, and removes the ZIP from Supabase Storage.
5. **Rename Support**:
   - Quick rename option for title and filename.

---

## Local Development (Ubuntu)

```bash
cd "/home/aum/Desktop/ML/Computer Networks/Assignment Hub"

# Install dependencies
npm install

# Configure environment variables in .env.local:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key

# Run tests
npm test

# Build production bundle
npm run build

# Start dev server
npm run dev
```

---

## Supabase Database Setup

1. Open your [Supabase Dashboard](https://supabase.com/dashboard) &rarr; **SQL Editor**.
2. Open [`supabase/setup.sql`](./supabase/setup.sql), copy everything, and paste it into the editor.
3. Click **Run**.

This sets up:
- `public.assignments` supporting both ZIP file paths and `c_code` text.
- `public.assignment_secrets` private table.
- RPC functions: `create_assignment`, `delete_assignment`, `rename_assignment`, `clean_orphaned_assignments`.
- Storage bucket `assignments` with public download, restricted upload, and delete policies.

---

## Git & Vercel Deployment

```bash
git add .
git commit -m "feat: dual ZIP and C source code support with individual downloads"
git push origin main
```

Vercel will automatically detect the commit and deploy your live site!
Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured in Vercel Project Settings &rarr; Environment Variables.
