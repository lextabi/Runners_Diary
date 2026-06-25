# Runner's Diary

Runner's Diary is a running journal web app where users can sign up, log in, and track runs on a calendar. A runner can click a date, add run details, and see saved entries directly on the calendar.

## Current Features

- Email and password authentication with Supabase Auth
- Login and registration screen
- Protected training calendar after sign in
- Clickable monthly calendar
- Add runs to a selected date
- Edit and delete existing run entries
- Distance and duration tracking
- Automatic pace calculation in minutes per kilometer
- Monthly summary cards for total distance, run count, and selected-day entries
- Row Level Security so users can only access their own profile and run data

## Tech Stack

- Next.js
- React
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security

## Project Structure

```text
app/
  globals.css       Global styles for login and diary views
  layout.tsx        Root app layout
  page.tsx          Login, registration, and training calendar UI
lib/
  supabaseClient.ts Supabase browser client
supabase/
  migrations/
    001_profiles.sql Creates user profiles and profile policies
    002_runs.sql     Creates run entries and run policies
```

## Requirements

- Node.js LTS
- npm
- A Supabase project

Download Node.js from:

```text
https://nodejs.org/
```

## Local Setup

Clone the repo, then install dependencies:

```bash
npm install
```

On Windows PowerShell, if `npm` is blocked by execution policy, use:

```powershell
npm.cmd install
```

Create a local environment file:

```bash
cp .env.local.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.local.example .env.local
```

Update `.env.local` with your Supabase values:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

The anon key is safe to use in the frontend when Row Level Security is enabled. Do not place your database password or Supabase service role key in this file.

## Supabase Setup

In your Supabase project, go to **SQL Editor** and run the migration files in this order:

1. `supabase/migrations/001_profiles.sql`
2. `supabase/migrations/002_runs.sql`

These migrations create:

- `public.profiles`, linked to Supabase Auth users
- `public.runs`, used for calendar run entries
- RLS policies for reading, inserting, updating, and deleting only the signed-in user's own data
- Triggers for automatically creating profiles and updating timestamps

If users registered before `001_profiles.sql` was run, backfill missing profile rows with:

```sql
insert into public.profiles (id, display_name)
select
  id,
  raw_user_meta_data ->> 'display_name'
from auth.users
where id not in (
  select id from public.profiles
);
```

## Supabase Auth URL Configuration

For local development, configure Supabase Auth:

1. Open Supabase Dashboard.
2. Go to **Authentication**.
3. Open **URL Configuration**.
4. Set **Site URL** to:

```text
http://localhost:3000
```

5. Add this Redirect URL:

```text
http://localhost:3000/**
```

## Running the App

Start the development server:

```bash
npm run dev
```

On Windows PowerShell:

```powershell
npm.cmd run dev
```

Open:

```text
http://localhost:3000
```

## Validating the App

After setup:

1. Register a new account.
2. Sign in.
3. Click a calendar date.
4. Add a run with time, distance, duration, and notes.
5. Confirm the pace is calculated automatically.
6. Save the run.
7. Confirm the calendar day shows the saved distance.
8. Edit and delete the run to confirm updates work.

You can also check Supabase **Table Editor**:

- `profiles` should contain a row for registered users.
- `runs` should contain saved run entries.

## Security Notes

- `.env.local` is ignored by Git and should not be committed.
- Never commit your Supabase database password.
- Never commit your Supabase `service_role` key.
- The Supabase anon key is expected to be public in frontend apps, but database access must be protected with Row Level Security.

## Roadmap Ideas

- Weekly and monthly progress charts
- Running goals and weekly distance targets
- Run types such as easy, tempo, long run, race, and recovery
- Route or location tracking
- Shoe and gear mileage tracking
- Mood or effort ratings
- Streaks and calendar filters
