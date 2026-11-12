# Epson Expert Connect: Admin Panel & Expert Console

One login for two roles:
- **Admin**: dashboard, calls (with "call done? yes/no"), leads, team, and stores with QR codes, plus CSV exports.
- **Expert (agent)**: live queue of waiting customers, video/voice calls (mute, camera, switch camera), post-call notes, and call history.

**React + Vite**, hosted on **Vercel**. Talks to the **backend** (Render).

Related repositories: **backend** (API, Render + Neon) and **website** (customer app).

## Run locally

```bash
cp .env.example .env    # defaults are fine; the backend must be running on http://localhost:4000
npm install
npm run dev             # https://localhost:5174
```

Log in with the admin from the backend's `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. The dev server uses HTTPS (self-signed certificate) so experts can use camera and microphone. Accept the certificate warning once.

## Deploy on Vercel

1. Push this repository to GitHub.
2. Vercel → **Add New… → Project** → import the repository (Framework: **Vite**, detected automatically; `vercel.json` handles page routing and headers).
3. **Environment Variables**:
   - `VITE_API_URL` = your Render backend URL, e.g. `https://epson-connect-api.onrender.com`
   - `VITE_WEBSITE_URL` = the customer website's Vercel URL, e.g. `https://epson-connect.vercel.app` (store QR codes point here)
4. **Deploy**. Note the URL (e.g. `https://epson-connect-admin.vercel.app`). It goes into the backend's `CORS_ORIGINS`.

`VITE_*` values are built into the app. After changing one, click **Redeploy** in Vercel.

## Pages

| Role | Page | What it shows |
|---|---|---|
| Admin | Dashboard | Leads, call requests, completed vs not connected, talk time, ratings, callbacks, 14-day chart, experts online, live calls |
| Admin | Calls | Every call: status, **Call done?**, expert, wait/talk time, rating, outcome, customer requests. Filters, search by `EPS-` reference, CSV export |
| Admin | Leads | Every form submission with "talked to expert?" and full call history. CSV export |
| Admin | Team | Add experts/admins, languages, reset passwords, deactivate (logs them out immediately), live status |
| Admin | Stores & QR | Stores and downloadable QR codes (per store or per product) |
| Expert | Live console | Available/Away, waiting customers with ring sound, accept → call, outcome + notes after the call |
| Expert | My calls | Personal call history and notes |
