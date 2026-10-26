# Assignment Hub — Public Assignment Sharing Platform

**Assignment Hub** is a fast, minimal, open-access platform where students can share assignment ZIP archives. No registration, login, or accounts are required.

The design is focused on high information density, clean typography, compact spacing, and instant search, backed by Supabase PostgreSQL and Supabase Storage without requiring a custom backend server.

---

## Key Features

- **Header with Quick Action**: Displays the platform name and a prominent **"Upload Assignment"** button on the top right.
- **Compact Main Table**: Shows as many assignments as possible on one screen in a clean, space-efficient table with prominent titles, monospace filenames, readable dates, file sizes, and quick actions.
- **Fast Instant Search**: Real-time case-insensitive title search located directly above the assignments list.
- **Zero-Friction Modal Upload**: Clicking "Upload Assignment" opens a clean modal to enter a title and drop a ZIP archive.
- **Direct ZIP Downloads**: Downloads the original file with its human-readable filename preserved.
- **Secure Anonymous Deletion**:
  - Only the original uploader can delete an assignment.
  - When an assignment is uploaded, a secure 32-character secret token is generated.
  - The token is automatically saved in the uploader's browser (`localStorage`) for 1-click deletion, and the user is shown the key so they can save it.
  - The database stores only a cryptographic SHA-256 hash in a private table (`public.assignment_secrets`) with Row Level Security locking out all public read access.
  - Deletion is handled by a secure PostgreSQL RPC function (`delete_assignment`) that verifies the secret token before deleting the storage object and database record.
  - Other visitors cannot delete someone else's assignment.
- **Mobile Responsive**: Transitions into compact stacked cards on smartphones.

---

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS)
- **Object Storage**: Supabase Storage (`assignments` public bucket)
- **Deployment**: Vercel (zero custom backend, pure static SPA)

---

## 1. Local Setup on Ubuntu

```bash
# 1. Navigate to the project directory
cd "/home/aum/Desktop/ML/Computer Networks/Assignment Hub"

# 2. Install dependencies
npm install

# 3. Create your local environment configuration file
cp .env.example .env.local

# 4. Add your Supabase credentials to .env.local:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Run tests and start the dev server:

```bash
# Run validation unit tests
npm test

# Build production bundle
npm run build

# Start local server
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 2. Supabase Database & Storage Setup

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor** tab.
3. Open `supabase/setup.sql` in this repo and copy all contents.
4. Paste into the Supabase SQL Editor and click **Run**.

The script creates:
- `public.assignments` table with validation constraints and performance indexes.
- `public.assignment_secrets` private table (RLS locked, no public read access).
- `create_assignment` RPC function: securely records metadata and SHA-256 hashed secret.
- `delete_assignment` RPC function: validates uploader secret, purges storage file, and removes record.
- `assignments` public storage bucket with upload restrictions and public download policies.

---

## 3. Environment Variables

In `.env.local` (local) and Vercel Project Settings (production):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-or-anon-key

# Optional settings:
VITE_SUPABASE_STORAGE_BUCKET=assignments
VITE_MAX_FILE_SIZE_MB=25
```

---

## 4. Git & Vercel Deployment

Commit changes to Git:

```bash
git add .
git commit -m "Redesign: minimal compact table layout with secure anonymous deletion"
git push -u origin main
```

To deploy to Vercel:
1. Import your GitHub repository in Vercel.
2. Set Environment Variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Deploy. The included `vercel.json` automatically configures static client-side routing rewrites.
