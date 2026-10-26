# Assignment Hub — Public Assignment Sharing Platform

**Assignment Hub** is a modern, responsive, open-access platform where students can share assignment ZIP archives with classmates without requiring user accounts, logins, or registration. Anyone can upload a ZIP file, enter a descriptive title, search the shared repository in real time, and download assignments directly.

The platform is built as a serverless static frontend powered by **React**, **Vite**, **TypeScript**, and **Tailwind CSS**, backed directly by **Supabase PostgreSQL** and **Supabase Storage**, ready for instant zero-configuration deployment to **Vercel**.

---

## Architecture Overview

- **Frontend**: React 18 with TypeScript and Vite
- **Styling**: Tailwind CSS with custom branding and typography
- **Icons**: Lucide React
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Object Storage**: Supabase Storage (`assignments` public bucket)
- **Deployment**: Vercel (Static Web App with client rewrites)
- **Package Manager**: npm

---

## 1. Required Software (Ubuntu Setup)

To run Assignment Hub on an Ubuntu laptop (Ubuntu 20.04 LTS, 22.04 LTS, or 24.04 LTS), ensure you have:

- **Node.js**: v18.0.0 or later (v20 LTS recommended)
- **npm**: v9.0.0 or later
- **Git**: Installed and configured

You can check your versions by opening your Ubuntu terminal (`Ctrl + Alt + T`):

```bash
node -v
npm -v
git --version
```

If Node.js is not yet installed on your system:

```bash
# Update Ubuntu package index
sudo apt update

# Install curl
sudo apt install -y curl

# Install Node.js 20.x from NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 2. Installing Dependencies

Navigate to your project directory in terminal:

```bash
cd "/home/aum/Desktop/ML/Computer Networks/Assignment Hub"
```

Install all required dependencies:

```bash
npm install
```

---

## 3. Creating the Supabase Project

1. Visit [supabase.com](https://supabase.com) and click **Start your project** (or sign in).
2. Click **New Project** and select your organization.
3. Fill in the project details:
   - **Name**: `Assignment Hub`
   - **Database Password**: Choose a strong password (save it in a safe place).
   - **Region**: Choose the region closest to you (e.g., `East US`, `Central EU`, or `Mumbai / Singapore`).
   - **Pricing Plan**: Free tier is sufficient.
4. Click **Create new project** and wait 1–2 minutes while Supabase provisions your PostgreSQL database and storage system.

---

## 4 & 5. Running the Database & Storage SQL Setup

We have prepared a self-contained, idempotent SQL setup script located at:
```
supabase/setup.sql
```

This single script sets up:
1. The `public.assignments` table with constraints for title lengths (1–150 characters), positive file sizes, and non-empty paths.
2. Performance indexes (descending date sort, case-insensitive title search, and trigram index for fast partial matching).
3. Row Level Security (RLS) policies allowing anonymous public `SELECT` and `INSERT`, while strictly denying `UPDATE` and `DELETE`.
4. Creation of the `assignments` public storage bucket with a 25 MB object limit and ZIP mime restrictions.
5. Storage object policies allowing public anonymous file downloads and uploads only to the `assignments/` folder with `.zip` extensions.

### How to execute the SQL in Supabase:

1. In your **Supabase Dashboard**, click on the **SQL Editor** tab (the terminal/code icon in the left sidebar).
2. Click **New query**.
3. Open the file `supabase/setup.sql` on your machine, copy the entire contents, and paste them into the Supabase SQL Editor.
4. Click the green **Run** button (or press `Ctrl + Enter`).
5. You should see a message: `Success. No rows returned.`

> **Verification Tip**: Go to the **Table Editor** in the left sidebar; you will see the `assignments` table. Go to **Storage** in the left sidebar; you will see the `assignments` bucket marked as **Public**.

---

## 6. Retrieving Supabase API Credentials

1. In your Supabase project dashboard, navigate to **Project Settings** (gear icon at the bottom of the left sidebar).
2. Click on **API** in the settings menu.
3. Under the **Project URL** section, copy the `URL` (e.g., `https://xyzcompany.supabase.co`).
4. Under the **Project API keys** section, copy the **`anon` `public`** key (or new **Publishable key**).
   > **CRITICAL**: Never copy or use the `service_role` key in frontend applications. The `anon` key is safely restricted by Row Level Security policies.

---

## 7. Configuring Local Environment Variables (`.env.local`)

In the project root folder, create a file named `.env.local`:

```bash
cp .env.example .env.local
```

Open `.env.local` in your editor and paste your credentials:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-actual-anon-or-publishable-key

# Optional Custom Settings (Defaults are used if omitted)
VITE_SUPABASE_STORAGE_BUCKET=assignments
VITE_MAX_FILE_SIZE_MB=25
```

> **Security Note**: In Vite, environment variables prefixed with `VITE_` are bundled into the public client application. Anyone inspecting the network tab can see them. Because we configured Row Level Security (RLS) on PostgreSQL and Supabase Storage, anonymous visitors have only strictly controlled access.

---

## 8. Starting the Local Development Server

Run the local Vite development server:

```bash
npm run dev
```

The terminal will display:
```
  VITE v6.1.0  ready in 180 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

Open `http://localhost:5173` in Google Chrome or Mozilla Firefox on your Ubuntu machine.

---

## 9. Testing Core Functionality

1. **Upload an Assignment**:
   - In the **Upload Assignment** card, enter a title (e.g. `Data Structures & Algorithms - Lab 4 Graph Traversal`).
   - Drag and drop or browse to select any valid `.zip` file under 25 MB.
   - Click **Upload Assignment**.
   - Watch the upload progress indicator.
   - Once complete, you will see a green success alert, the form will reset, and the new assignment card will appear at the top of **All Assignments**.
2. **Persistence Test**:
   - Refresh the page (`F5` or `Ctrl + R`).
   - The assignment remains visible because it is permanently saved in Supabase PostgreSQL.
3. **Live Search Test**:
   - In the search bar ("Search assignments by title..."), type `Data Structures` or `Graph`.
   - Results update instantaneously in a case-insensitive manner.
   - Click the "X" or "Clear filter" button to reset the list.
4. **Download Test**:
   - Click the **Download ZIP** button on the assignment card.
   - The browser downloads the original file with its original filename preserved.
5. **Validation & Abuse Safeguards**:
   - Try submitting with an empty title &rarr; blocked with a clear warning.
   - Try selecting a non-ZIP file (e.g. a `.pdf` or `.png`) &rarr; blocked.
   - Try selecting a fake `.zip` (e.g. a renamed `.txt` file) &rarr; blocked by header magic byte inspection.
   - Try uploading a file > 25 MB &rarr; blocked before upload starts.

---

## 10 & 11. Creating and Pushing to a GitHub Repository

1. Initialize git (if not already initialized) and verify the branch:
   ```bash
   git init
   git branch -M main
   ```

2. Check `.gitignore` to ensure `.env.local` is ignored:
   ```bash
   git status
   ```
   *(Notice that `.env.local` is omitted and `.env.example` is tracked).*

3. Commit the project files:
   ```bash
   git add .
   git commit -m "Initial commit: Production-ready Assignment Hub"
   ```

4. Create a new repository on [GitHub](https://github.com/new):
   - Name: `assignment-hub`
   - Set to **Public** or **Private**.
   - Do **not** initialize with a README, .gitignore, or license (they are already in this repository).

5. Link your local repository to GitHub and push:
   ```bash
   git remote add origin https://github.com/<your-username>/assignment-hub.git
   git push -u origin main
   ```

---

## 12 & 13. Deploying to Vercel

1. Go to [vercel.com](https://vercel.com) and log in (e.g., using your GitHub account).
2. Click **Add New...** &rarr; **Project**.
3. Under **Import Git Repository**, find your `assignment-hub` repository and click **Import**.
4. Configure Project settings:
   - **Framework Preset**: `Vite` (automatically detected).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Expand the **Environment Variables** section:
   - Add `VITE_SUPABASE_URL` with your project URL value.
   - Add `VITE_SUPABASE_PUBLISHABLE_KEY` with your project anon/publishable key value.
   - *(Optional)* `VITE_MAX_FILE_SIZE_MB`: `25`
   - *(Optional)* `VITE_SUPABASE_STORAGE_BUCKET`: `assignments`
6. Click **Deploy**.

---

## 14. Testing the Live Deployment

1. Once the deployment finishes, Vercel will provide your production URL (e.g., `https://assignment-hub.vercel.app`).
2. Open the URL in an incognito window or on your mobile device.
3. Test uploading a ZIP file from your mobile phone or another computer.
4. Verify that you can search for and download files uploaded from any device.

---

## 15. Troubleshooting Common Issues

### Issue 1: "Supabase Configuration Required" Screen
- **Cause**: Missing or misspelled environment variables.
- **Solution**: Check that `.env.local` (local) or Vercel Environment Variables (production) have exact keys:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`)
  Restart the local server (`npm run dev`) after changing `.env.local`.

### Issue 2: Storage bucket "assignments" does not exist
- **Cause**: The bucket creation was omitted in Supabase.
- **Solution**: Run `supabase/setup.sql` in the Supabase SQL Editor. It automatically creates the bucket with `public = true`.

### Issue 3: Upload fails with "row-level security policy violation"
- **Cause**: Table RLS policies have not been applied.
- **Solution**: Execute the `CREATE POLICY "Anyone can insert assignment metadata"` section in `supabase/setup.sql`.

### Issue 4: Downloaded ZIP file has a UUID filename
- **Resolution**: Assignment Hub automatically downloads files via blob stream and assigns the original human-readable filename (`assignment.file_name`). If direct browser opening is preferred, files are also accessible via public storage URLs.

---

## 16. Monitoring Storage & Bandwidth

In the **Supabase Dashboard**:
- **Storage Metrics**: Go to **Storage** &rarr; **Usage** to see total stored volume, object counts, and download bandwidth.
- **Database Metrics**: Go to **Reports** &rarr; **Database** to view query throughput and connection pool status.
- **Free Tier Allowances**: Supabase free tier includes 500 MB database storage, 1 GB file storage, and 5 GB egress bandwidth per month.

---

## 17. Security & Abuse Prevention Guidelines

Because Assignment Hub is an open, anonymous-first sharing platform:

1. **Current Enforced Safeguards**:
   - **No Secret Key Exposure**: Only `anon` public key is bundled; no administrative service role credentials.
   - **Database Constraints**: Enforces title length (1–150 characters), file size limit, non-empty filename, and path prefixing.
   - **Zero Public Modification/Deletion**: Anonymous visitors have `SELECT` and `INSERT` permissions only. `UPDATE` and `DELETE` requests are universally rejected by PostgreSQL RLS.
   - **Client ZIP Header Verification**: Inspects file magic bytes (`PK\x03\x04`, `PK\x05\x06`, `PK\x07\x08`) to prevent executable file renaming.
   - **Storage Collision Immunity**: Unique UUID and timestamp paths prevent accidental or malicious file overwriting.
   - **XSS Prevention**: Titles are rendered safely via React standard string bindings without raw HTML injection.

2. **Recommended Future Hardening**:
   - **Cloudflare Turnstile or reCAPTCHA v3**: Add CAPTCHA verification before initiating storage upload to prevent automated bots.
   - **Upstash Redis Rate Limiting**: Limit IP addresses to a reasonable threshold (e.g., maximum 5 uploads per hour per IP).
   - **Serverless Malware Scanning**: Integrate an asynchronous Supabase Database Webhook to scan uploaded ZIP files with ClamAV or VirusTotal.
