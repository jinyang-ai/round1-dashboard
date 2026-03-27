# Round1 Dashboard

Live operational dashboard for Round1 interview coordination by Grapevine.

## Features

- **Google OAuth Login**: Secure authentication restricted to @grapevine.in emails only
- **Real-time Calendar Sync**: Syncs with Google Calendar via webhooks
- **Advanced Filtering**: Filter interviews by client, role, date range, and interviewer
- **Interactive Dashboard**: Stats cards, client leaderboard, recent interviews
- **Client Drill-down**: Detailed views for each client
- **Auto-parsing**: Automatically extracts client, role, candidate name, and interviewers from calendar events

## Tech Stack

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: NextAuth.js v5 with Google OAuth
- **Hosting**: Vercel
- **Calendar**: Google Calendar API with webhook notifications
- **Styling**: Tailwind CSS
- **Charts**: Recharts

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ installed
- Supabase account
- Google Cloud Project with OAuth 2.0 credentials
- Access to `round1@grapevine.in` Google Calendar

### 2. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **OAuth consent screen**
3. Configure the consent screen:
   - User Type: Internal (for Workspace) or External
   - Add authorized domain: `grapevine.in`
   - Scopes: `openid`, `email`, `profile`
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: Web application
6. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://your-domain.vercel.app/api/auth/callback/google` (production)
7. Also enable **Google Calendar API** in **APIs & Services**
8. Save the Client ID and Client Secret

### 3. Clone & Install

```bash
cd /Users/aj/round1-dashboard
npm install
```

### 4. Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `GOOGLE_CLIENT_ID`: Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth Client Secret
- `GOOGLE_CALENDAR_ID`: `round1@grapevine.in`
- `AUTH_SECRET`: Generate with `openssl rand -base64 32`
- `NEXTAUTH_URL`: Your site URL
- `JWT_SECRET`: Secret for API endpoint authentication

### 5. Database Setup

The database migration has already been applied. The `interviews` table schema:

```sql
CREATE TABLE interviews (
  id UUID PRIMARY KEY,
  calendar_event_id TEXT UNIQUE,
  title TEXT,
  client TEXT,
  role_type TEXT,
  candidate_name TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_mins INTEGER,
  interviewers TEXT[],
  interviewer_names TEXT[],
  status TEXT,
  month TEXT,
  day_of_week TEXT,
  hour INTEGER,
  raw_json JSONB,
  synced_at TIMESTAMPTZ
);
```

### 6. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000 and sign in with a @grapevine.in Google account.

### 7. Initial Data Sync

After logging in, trigger the initial calendar sync:

```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer YOUR_JWT_SECRET"
```

This will fetch the last 7 months of calendar events and populate the database.

### 8. Setup Calendar Webhooks (Optional)

To enable real-time updates when calendar events change:

```bash
curl -X POST http://localhost:3000/api/renew-watch \
  -H "Authorization: Bearer YOUR_JWT_SECRET"
```

The webhook channel expires after 3 days, so set up a cron job to renew it:
- Vercel Cron: Add to `vercel.json`
- Or use an external cron service to call `/api/renew-watch` every 3 days

### 9. Deploy to Vercel

```bash
npm run build
vercel deploy
```

Set all environment variables in Vercel dashboard, then:
- Run the initial sync via the deployed URL
- Set up the webhook watch
- Configure Vercel Cron (optional) for webhook renewal

## API Endpoints

### Protected Endpoints (Require JWT Secret)

- `POST /api/sync` - Full calendar sync (last 7 months)
- `POST /api/renew-watch` - Renew Google Calendar webhook

### Public Endpoints (Session Required)

- `GET /api/interviews` - Query interviews with filters
- `GET /api/stats` - Get dashboard statistics
- `POST /api/webhook` - Google Calendar webhook (called by Google)

### Auth Endpoints

- `GET /api/auth/signin` - NextAuth sign in
- `POST /api/auth/signout` - NextAuth sign out

## Parser Logic

The dashboard automatically extracts:

**Clients**: Identified by:
- Company name in event title
- Attendee email domains
- Known interviewer names (Vedant/Nitesh → Sarvam AI, Jaskirat → Superliving, etc.)

**Roles**: Pattern matching on title/description:
- Frontend Engineer, Backend Engineer, Full Stack Engineer
- AI Engineer, Data Engineer, Data Scientist
- Tech Lead, VP Engineering, CTO, Product Manager
- DevOps, QA, Designer, Analytics

**Candidate Names**: Extracted from:
- Parentheses in title: "Company Role (Candidate Name)"
- "with Name" pattern

**Interviewers**: All attendees except:
- Organizer (round1@grapevine.in)
- Candidate (personal email domains)

## Access Control

- Only users with **@grapevine.in** email addresses can log in
- Google OAuth enforces this via the `hd` parameter
- Additional check in NextAuth callback

## Architecture

```
Google Calendar → Webhook → Next.js API → Supabase → Dashboard UI
                              ↓
                         Parser Logic
                              ↓
                    (Client/Role/Candidate)
```

## License

Proprietary - Grapevine Internal Use Only
