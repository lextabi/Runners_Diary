# Runner's Diary

A running journal app built with Next.js and Supabase.

## Local Setup

1. Install Node.js.
2. Install dependencies:

```bash
npm install
```

3. Copy `.env.local.example` to `.env.local` and add your Supabase anon key.
4. Run the app:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Supabase Setup

Run the SQL files in `supabase/migrations/` in order in the Supabase SQL editor:

1. `001_profiles.sql`
2. `002_runs.sql`

The app uses Supabase Auth for users, `public.profiles` for app-specific user profile data, and `public.runs` for calendar run entries.
