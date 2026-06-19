# Artist Influence — Spotify Ops Portal (Mockup)

Internal **operations** portal for Spotify playlisting — the team-facing mirror of the
Vendor Portal (a separate sibling mockup). Single self-contained `index.html`, no build,
no dependencies. Reuses the **exact** Artist Influence design system from the vendor
portal so the two surfaces can never drift apart.

Built as a clickable UI/UX target for the dev team, not production code. Sample data only.

> **Purpose of this repo.** This is the **UI/UX layer only** — a clickable, dependency-free
> reference for implementing this flow on top of Artist Influence's **existing platform**,
> which already provides the routes and backend to actualize the functionality. Treat it as
> the design / interaction target: map each screen's data needs to the platform's real
> endpoints via the **data dictionary (§8)** and the **vendor-portal sync contract (§13)** in
> `OPS-PORTAL-DEV-GUIDE.md`. No backend is included or needed to run the mockup itself.

## Run it
```
bun serve.js        →  http://127.0.0.1:8124
```
(or just double-click `index.html`). The vendor portal owns port 8123; this owns 8124,
so you can run both side by side.

## What's here (Phase 1 + 2)
Action-first reskin of the current ops portal in a **top-header** layout, with the data
contradictions fixed. Single nav: Today · Campaigns · Vendors & Playlists · Marketplace ·
Clients · Intelligence.
- **Today** — triaged action queue (what needs an operator decision *now*), reconciled KPIs.
- **Campaigns** — tabs: History · Submissions · Vendor Payouts.
  - Tier 1 / Standard badge per campaign (drives pitching).
  - "Group: underperforming by vendor" + real **CSV export** per vendor.
  - Row → detail modal: Details (Mark Paid per vendor) · Playlists · **Performance with
    live charts** (pacing timeline, popularity 0-100, saves/listeners sparklines) · Vendor Payments.
  - **Vendor Payouts:** expandable per-campaign cost, clickable paid/unpaid pills, Mark Paid.
- **Vendors & Playlists** — vendor cards + All Playlists table, tier eligibility
  (Standard / Tier 1 / Both), **vendor merge tool** (21 raw → ~10), Admin Vendor Profile,
  Add/Import/Export/Enrich.
- **Marketplace** — ops preview of the vendor-facing marketplace (what's live, tier-segmented).
- **Clients** — Spotify view (Credit, CLV, Avg Spend, Recent, Active) + Add Client.
- **Intelligence** — deferred to Phase 3 (placeholder).

Every button is wired (modals, tabs, toasts, real CSV downloads, select-and-process, merge, nav).

## Read this first
**`OPS-PORTAL-DEV-GUIDE.md`** — the dev handoff. **Part 1 is plain English** (what the portal
is, how an operator uses it, how it differs from the old portal, how it connects to the Vendor
Portal); **Part 2 is the technical spec** (data dictionary, schema, endpoints, world map,
cover-art scrape, Priority 8, phase plan). One self-contained document, paste-ready for Google Docs.

`REDTEAM-AND-SPEC.md` — the original redteam findings + the chronological revision log (kept as
the deep change-history reference).

## Folders
- `mockup-screens/` — screenshots of every screen in this mockup.

## Design system
All tokens live in the `:root` block at the top of `index.html`, copied verbatim from the
vendor portal: `#0E0E10` canvas, `#ED1C24` red, glass panels, Helvetica Neue / Inter /
JetBrains Mono, tabular numerals. For production, self-host the fonts (don't CDN) and
replace the sample `OPS` data object with the live metrics module (see spec §6).
