# Elite 5 Tournament — Website

A mobile-first website for the **Elite 5 Tournament** (5v5 youth football, Lebanon) with a multi-step team registration form and a live urgency tracker.

**Design:** gritty, brutalist street-football (Nike / Red Bull / EA FC energy) — absolute **black + stark white + punchy crimson** (`--red`). Sharp edges (no rounded corners), hard offset shadows, skewed tags, halftone-dot & diagonal-hazard textures, a scrolling marquee, and a massive invert-on-hover CTA. Headings: **Anton** (condensed, italic); labels: **Oswald**; body: **Inter**. All icons are inline SVG (no emojis) from a sprite at the top of `index.html`.

To retheme, edit the CSS variables at the top of `styles.css` (`--red`, `--black`, `--white`, `--blue`) and the `--hard` / `--hard-red` offset-shadow tokens.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Landing page — hero, about, gallery, details, roadmap, multi-step registration, sponsors |
| `styles.css` | All styling (dark theme, responsive, mobile-first) |
| `script.js` | Multi-step wizard, urgency tracker, dynamic players, photo previews, validation, submission |
| `admin.html` | **Organizer view** — review submitted teams, players, photos, Instagram, captain contacts; export to JSON |
| `elite5logo.jpg` | Tournament logo — header, hero badge, footer, favicon, social-share image |
| `Sponsors/` | Sponsor & partner logos. `*_clean.jpeg` files are cropped copies (Golden Ball, JBull, Farfour) with screenshot chrome / borders removed |

To add or change a sponsor: drop the logo into `Sponsors/` and edit the `sponsors-grid` in `index.html`.

## Things you'll want to set

- **Urgency tracker** — in `script.js`, set `TEAMS_ALREADY_REGISTERED` to the real number of confirmed teams. The tracker shows `that + local submissions`, capped at 8, and turns red when ≤3 spots remain.
- **Accent colors / player limits** — CSS variables at the top of `styles.css` (`--neon`, `--blue`, `--crimson`); `MIN_PLAYERS` / `MAX_PLAYERS` at the top of `script.js`.
- **Action photos** — the Gallery section uses styled placeholders; swap in real match shots when available.

## What the registration form collects

- **Team**: name, city/area
- **Captain contact**: name, phone number, email address
- **Players** (5–10): full name, date of birth (must be **2009–2011**, enforced), **photo** (upload + preview), **Instagram** profile, and a **Captain** selector (one per team)
- Eligibility confirmation checkbox

Validation blocks submission until every required field is filled, at least 5 players are added with photos, all birth years are 2009–2011, and a captain is chosen.

## Running it

Just open `index.html` in a browser. Photo uploads and previews need the page served over `http://` (not `file://`) in some browsers — to run a quick local server:

```bash
cd Elite5
python -m http.server 8000
# then open http://localhost:8000
```

## Where registrations go (IMPORTANT)

Right now, submissions are stored in the visitor's **own browser** (localStorage) and shown on `admin.html` **on that same device**. This is perfect for testing and demos, but for a real tournament where teams register from their own phones across Lebanon, you need a backend so entries reach *you*. Two easy options:

### Option A — Formspree (no code, ~5 min)
1. Create a free account at [formspree.io](https://formspree.io) and make a new form. You'll get an endpoint like `https://formspree.io/f/abcd123`.
2. In `script.js`, inside the `form.addEventListener('submit', ...)` handler, after building the `registration` object, POST it:
   ```js
   fetch('https://formspree.io/f/abcd123', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(registration)
   });
   ```
   (Note: photos are base64 data — Formspree's free tier limits payload size, so you may want players to submit Instagram/photo links instead of file uploads, or use Option B.)

### Option B — Google Sheets / Apps Script (free, handles more data)
Create a Google Apps Script web app that appends each POST to a Google Sheet, and POST the `registration` object to its URL the same way as above. Good for storing many entries and viewing them in a spreadsheet.

### Option C — Netlify Forms
If you deploy to [Netlify](https://netlify.com), add `netlify` to the `<form>` tag and Netlify captures submissions automatically in its dashboard.

## Deploying (free hosting)

Drag the `Elite5` folder onto [Netlify Drop](https://app.netlify.com/drop) or push to GitHub and enable **GitHub Pages** / **Vercel**. The site is fully static — no build step required.

## Customizing

- **Contact / social links**: add your Instagram/WhatsApp in the footer of `index.html`.
- **Date/venue**: edit the hero chips and Details cards in `index.html`.
- **Colors**: change the CSS variables at the top of `styles.css` (`--red`, `--blue`, etc.).
- **Player count**: change `MIN_PLAYERS` / `MAX_PLAYERS` at the top of `script.js`.
