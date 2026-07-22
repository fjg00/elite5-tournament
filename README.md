# Elite 5 Tournament — Website

A mobile-first website for the **Elite 5 Tournament** (5v5 youth football, Lebanon) with a multi-step team registration form, a live "spots claimed" tracker, and an organizer dashboard.

**Design:** gritty, brutalist street-football — white base with **blue (primary) + red-pink (accent)**. Sharp edges, hard offset shadows, skewed tags, halftone textures. Headings: **Anton** (condensed, italic); labels: **Oswald**; body: **Inter**. All icons are inline SVG.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Landing page — hero, multi-step registration, match details, sponsors |
| `styles.css` | All styling (responsive, mobile-first) |
| `script.js` | Wizard, jersey color picker, one-at-a-time squad builder, tracker, submission |
| `admin.html` | **Organizer dashboard** — login, registrations, winners, open/close toggle, Excel export |
| `supabase-config.js` | Your Supabase URL + anon key (empty = demo mode) |
| `supabase-setup.sql` | One-time database setup script for Supabase |
| `elite5logo.jpg` | Tournament logo — header, footer, favicon, social-share image |
| `Sponsors/` | Sponsor & partner logos (`*_square` / `*_clean` are tidied copies) |

## Backend (Supabase) — GO-LIVE STEPS

Until connected, the site runs in **demo mode**: registrations save to each visitor's own browser only. To collect real registrations (including player photos) from every device:

1. **Create a project** — sign up free at [supabase.com](https://supabase.com), create a new project (any name/region; note the database password it asks you to set).
2. **Set up the database** — in the dashboard open **SQL Editor → New query**, paste the whole contents of `supabase-setup.sql`, press **Run**. This creates the tables, the 8-team cap, the jersey-color lock, the open/closed switch, and a private photo bucket — with security rules so visitors can register but only you can read the data.
3. **Create your admin login** — **Authentication → Users → Add user**: enter your email + a strong password. This is what you'll use to log in to `admin.html`.
4. **Connect the site** — **Project Settings → API**: copy the **Project URL** and the **anon public** key into `supabase-config.js`. (The anon key is designed to be public — never share the `service_role` key.)
5. Push / redeploy. Done — registrations, photos, the tracker, and the admin dashboard are now live and shared.

### What the backend enforces server-side
- Max **8 teams** (9th submission is rejected even if two people submit at once)
- **Jersey colors are first-come-first-served** (database-level unique lock)
- **Registration open/closed** — flip it from the admin dashboard
- Visitor pages can only *count* teams; captain contact details are readable **only after admin login**
- Player photos live in a **private** storage bucket; the admin page views them via short-lived signed links

## Admin dashboard (`admin.html`)

- **Login required.** Connected mode uses your Supabase email + password (real security). Demo mode uses the passcode in `admin.html` (`LOCAL_PASS`, default `elite5`) — cosmetic only, change it.
- See every team: jersey color, captain badge, photos, captain phone/email.
- **Registration: OPEN/CLOSED** toggle button.
- **Results & Winners** — set champion, runner-up, top scorer; champion/runner-up badges appear on team cards.
- **Download Excel (CSV)** — one row per player with team, jersey, placement, and captain contact. Opens directly in Excel.

## Running locally

```bash
cd Elite5
python -m http.server 8000
# then open http://localhost:8000
```

## Deploying (free hosting)

Push to GitHub and enable **GitHub Pages** (Settings → Pages → branch `main`), or drag the folder onto [Netlify Drop](https://app.netlify.com/drop). The site is fully static — no build step.

## Customizing

- **Colors**: CSS variables at the top of `styles.css` (`--blue`, `--pink`, `--ink`).
- **Player limits**: `MIN_PLAYERS` / `MAX_PLAYERS` at the top of `script.js` (also update the SQL cap if you change the number of teams).
- **Sponsors**: drop a squarish logo into `Sponsors/` and add a `.sponsor-card` in `index.html`.
