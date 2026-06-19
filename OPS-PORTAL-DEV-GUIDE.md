# Artist Influence — Spotify Ops Portal
### Developer Guide & Specification

**What this document is:** a single, self-contained guide for the dev team. **Part 1 is plain English** — what the portal is, how an operator uses it, how it differs from the old portal, and how it connects to the Vendor Portal. **Part 2 is the technical spec** — data definitions, schema, endpoints, and the build plan. Read Part 1 first; Part 2 is the reference you'll keep open while building.

**The artifacts:**
- **This portal (mockup):** `index.html` — open it, or run `bun serve.js` → http://127.0.0.1:8124
- **Vendor Portal (sibling mockup):** `../vendor-portal-mockup/` → http://127.0.0.1:8123
- Screenshots of every screen are in `mockup-screens/`.

---
---

# PART 1 — PLAIN ENGLISH

## 1. What this is, in one paragraph

This is the **internal control room** for Artist Influence's Spotify playlisting business. Ops uses it to take a song a client paid to promote, get it onto playlists run by outside **vendors**, watch the streams come in against the goal, fix campaigns that are falling behind, and pay the vendors. It is the **team-facing mirror** of the Vendor Portal: vendors see "here's a campaign, here's what I'm owed" on their side; ops sees "here's every campaign, who's delivering, who isn't, and what to do about it" on this side. They read the **same underlying data**, just shown for two different audiences.

## 2. The one idea that drives the whole redesign

The old portal's core problem wasn't missing features — it was that **the same number meant different things on different screens**, so operators couldn't trust any of it. (Examples below.) The fix is a rule we applied everywhere:

> **Define each number once, read it everywhere.**

Every metric — "active campaigns," "owed to vendors," "on pace," "streams this month" — has exactly one definition (the *data dictionary* in Part 2). Every card, table, and popup reads that one definition. The Vendor Portal reads the same ones, so a vendor and an operator can never see two different statuses for the same campaign.

## 3. How an operator actually uses it (a walk through the screens)

The top navigation is a **single bar**: **Today · Campaigns · Vendors & Playlists · Marketplace · Clients · Intelligence.**

### Today — "what needs a decision right now"
The home screen is a **triaged action queue**, not a dashboard of charts. The old portal fired *453 "no playlist adds" alerts and 388 "critical" alerts at once* — so operators ignored all of them. Here, those are deduplicated and ranked into the handful of items that genuinely need a human decision today: a campaign that's critically behind, vendor submissions waiting for approval, payouts ready to run, a stale campaign that should be closed, a renewal opportunity to hand to Sales. Each item says the **specific next action** and has working buttons. Above the queue sit the four trustworthy top-line numbers, then a reconciled "Operations Health" strip. The queue toggles between **Cards** and **Table**.

### Campaigns — the delivery workhorse
Three tabs: **Campaigns** (history), **Submissions** (vendor responses waiting on you), **Vendor Payouts**.

- The table shows each campaign with its **Spotify cover art** (scraped from the track; falls back to artist initials), client, salesperson, release date, 24h/7d/28d streams, a progress bar, a **pace** status, and invoice state. Every column **sorts**; the four context cards at the top (Active / Behind / Awaiting / Flagged) are **clickable filters**; there are real dropdown filters for SFA state, pace, invoice, playlists, salesperson, and overall status. You can **group the under-performing campaigns by the vendor responsible and export that list to CSV** — so if a vendor isn't checking their portal, you email them exactly the campaigns they're lagging on.
- Click a campaign to open its detail, which has its own tabs:
  - **Details** — the heart of it. This is where the **approve → confirm → start** workflow lives (next section), plus the **clawback** action on confirmed vendors.
  - **Playlists** — vendor playlists, *plus* the playlists Spotify found that aren't assigned to a vendor yet (assign, mark organic, or remove), plus the algorithmic sources (Radio, Discover Weekly, Mixes…). This keeps **what the vendor delivered** separate from **what the algorithm/organic did** — which matters for honest attribution.
  - **Performance** — the pacing chart (actual vs required vs projected vs goal), and **one combined graph** tracking streams, popularity, saves, listeners, and streams-per-listener over time.
  - **Vendor Payments** — what each vendor is owed on this campaign; mark paid here or in the Payouts tab (same record).
  - **Bounty Board** — see *who's already confirmed* on the campaign vs *who's bidding* for the remaining streams.

### How a campaign gets filled (the approve → confirm → start flow)
This is the most important workflow, and it's built to be hard to get wrong:
1. Vendors submit/bid → ops **Approves** each, sets an **allocation** (how many streams that vendor covers), then **Confirms** it (you can't confirm a zero allocation).
2. A live bar shows how much of the goal is locked in.
3. **You can Start the campaign with the vendors confirmed so far — even if the goal isn't fully allocated.** It shows you the percentage covered and tells you the rest can be added later. (The old way effectively made you wait for full allocation, which stalled delivery.)

When creating a campaign, ops picks **how to fill it**: allocate manually to specific vendors (a table with a running total vs the goal and an over/under error), **post it to the marketplace** for eligible vendors to bid on, or a **mix of both** (a slider splits the goal; you allocate the manual portion in a table and the rest goes to the bounty board).

### Vendors & Playlists
The vendor roster as cards (cost/1k, caps, tier eligibility, follower reach, clawback-credit badge) or an **All Playlists** table (searchable, **filter by genre / vendor / country**, sortable, each playlist showing its **top 2-3 countries**). Key pieces:
- **Tier eligibility** — each vendor is marked **Standard, Tier 1, or Both**. This is the supply side of the tier system: a Tier 1 campaign is only pitched to Tier-1-eligible vendors, Standard to Standard. (Different campaign types use different vendor pools.)
- **Vendor merge** — the old data folded "21 raw rows into 17 vendors," with "Whale Music" appearing 3 times, which corrupted every per-vendor number. There's an explicit merge tool to fix duplicates onto one canonical vendor.
- **Clawback Credits** and **Payout History** — explained below.

### Marketplace
A read-only **preview of what vendors see** in their portal's "Available Campaigns" — open campaigns, tier-segmented, with the count of eligible vendors. **Re-pitch** re-posts a campaign's remaining streams to the bounty board and pings the genre-matched eligible vendors (it does *not* touch confirmed allocations).

### Clients
The Spotify client book — Credit balance, Spotify CLV, average spend, most recent and active campaigns. Click a client for a full profile (their campaigns with statuses, **Adjust credit**, start a new campaign).

### Intelligence
The analytics layer: **Algorithmic lift** and which playlists actually move the algorithm; **Vendor reliability** (with blended cost/1k and daily streams each vendor is driving); a **Territory** view with a **shaded world map** (each country colored by its share of streams) plus the playlists driving each market; **goal-vs-actual** delivery; and **optimization suggestions** that name the specific vendor/action, not a generic "add playlists."

## 4. The clawback / credit system (read this — it's the subtle one)

When a vendor **can't hit a goal on time** (they say so, or ops sees it and it's unfixed), ops **claws back** streams from that vendor on that campaign. Those reclaimed streams become a **credit** we hold against that vendor (tracked in streams and dollars), and the freed streams are immediately sent **back to the marketplace** or **re-allocated to another vendor** — so the client's goal still lands on time. The vendor is notified.

That credit is then **only ever re-allocated** — applied to another or new campaign that vendor runs for us (it covers streams there at no new cost, and the balance drops). There is **no "settle/pay-out"** path; credit goes in via clawback and out via re-allocation, full stop. You can see every vendor's balance and the full history in the **Clawback Credits** ledger (in Vendors), and apply a credit when adding that vendor to a campaign or accepting their bid.

Why it matters: without this, an under-delivering vendor silently sinks a campaign and ops has no lever. With it, "vendor can't deliver" becomes "pull their streams, redeploy them, still hit the goal."

## 5. How it's different from the OLD ops portal

| Old portal | This portal |
|---|---|
| **Numbers contradicted each other** — "Total Campaigns 1,000" vs "534"; "Vendor Payouts Pending **$0**" while the payouts tab owed **$4,275**; a 12-month stream figure **labeled "30 days."** | One definition per metric, read everywhere. The reconciliations are called out on-screen. |
| **Alert fatigue** — 453 + 388 alerts firing at once; "everyone trending down." | A triaged **Today** queue of the ~17 items that need a decision; vendor trend re-based so it actually varies. |
| **Two stacked nav bars** eating the screen. | One clean top header. |
| **No "what do I do now"** — it showed "Behind" but never the next step. | Every action card states the specific next action with working buttons. |
| **Couldn't start a campaign** cleanly until fully allocated. | Approve → confirm → **start with whatever's confirmed**, add the rest later. |
| **No way to recover** an under-delivering campaign. | The clawback/credit system reclaims and redeploys streams. |
| **Payouts scattered** across three screens with three different totals; **$0 vs $4,275**. | One payout surface + a **payout history** view, all from the same data. |
| **Duplicate vendor identities** ("Whale Music" ×3) corrupting per-vendor metrics. | A canonical vendor id + a merge tool. |
| **Stale campaigns never closed** ("0% after 350 days, still Active"). | Surfaced on Today as "should be closed." |
| Flat playlist tables. | Real performance charts, a **shaded world map**, and per-playlist top countries. |

## 6. How it connects to the new Vendor Portal

The two portals are **two windows onto the same data**. Build each shared object once; render it twice.

1. **The same campaign, the same status.** A campaign's **pace** and **payout owed** come from one shared calculation. What a vendor sees as their campaign's status in "My Active Campaigns," and what an operator sees as the pace pill here, are the *same value*. They can never disagree.
2. **Tier eligibility drives the vendor's bounty board.** When ops marks a vendor Standard / Tier 1 / Both (and sets caps), that's exactly what the vendor's Bounty Board uses to decide which campaigns they're shown and can bid on.
3. **Bids and offers are one round-trip.** A vendor's bid on the marketplace, ops accepting/countering it, and the vendor seeing the counter — one object, two views.
4. **The Communication Bridge is the connective tissue.** Every vendor-facing action ops takes — a clawback notice, a credit applied, a counter-offer, a reallocation, a nudge — is written to a bridge log that **is** the vendor's notifications/requests inbox on the other side. In the ops mockup you see this in each Vendor Profile ("Communication Bridge"); in production it posts to the vendor portal's notification service and the vendor's acknowledgement flips it to "seen."
5. **Priority 8 (post-campaign tracking) shows in both.** After a campaign completes, Spotify data keeps refreshing monthly for 6 months; both portals reflect the continued movement (ops gets the renewal-flag action; the vendor sees sustained performance).

**Net:** the Vendor Portal spec's data objects (campaign, vendor, allocation/offer, payout, bounty eligibility, notification) are the *same* objects this portal writes to. Neither side owns a private copy.

---
---

# PART 2 — TECHNICAL SPECIFICATION

## 7. How the mockup is built (so you can read it)

- **One self-contained `index.html`** — no build step, no dependencies, pure HTML/CSS/vanilla JS. It **reuses the Vendor Portal's entire `<style>` block verbatim**, so the design system can't drift between the two portals.
- **Architecture:** an `I` icon dictionary + `svg()` helper; a `NAV`-driven top bar; a `PAGES` object where **each route is a function returning an HTML string**; one `render()` that swaps `#view`. Modals, toasts, the custom dropdown (`xdd`), tilt/reveal motion, and the chart engine (`lineChart`) are shared helpers.
- **The `OPS` object** near the top of the script holds the reconciled top-line numbers, defined once — the in-code embodiment of the data dictionary. Enums `PACE` / `INV` are the single status models.
- **Cover art** flows through one chokepoint, `cover()`: it renders an `<img>` over an initials tile and falls back to initials on error (see §10).
- **The world map** loads real country geometry at runtime (see §11).
- **Sample data only.** Replace the in-memory objects (`OPS`, `campaigns`, `vendors`, `payouts`, `clients`, `vendorCredits`, `clawbackLog`, `bridgeLog`) with live data via the metrics module in §8.

## 8. Data dictionary — the single source of truth

Implement each as **one** server-side selector/aggregate. Every card, tab, modal, and the Vendor Portal import from here. No component recomputes a metric.

| ID | Metric | Definition | Window | Replaces / notes |
|----|--------|------------|--------|------------------|
| D-1 | `campaigns_active` | count(status = `active`) | — | 575-vs-250 split |
| D-1b| `campaigns_total` | count(all Spotify campaigns) | — | 534, not 1,000 |
| D-2 | `needs_action` | distinct campaigns with ≥1 open, deduped action | now | replaces 453 raw "no playlist adds" |
| D-3 | `on_pace_pct` | active where `projected_end ≥ goal` ÷ active | live | one number (was 50% vs 72%) |
| D-4a| `streams_30d` | Σ vendor-attributed streams, trailing 30 days | 30d | a true 30-day window |
| D-4b| `streams_12m` | Σ vendor-attributed streams, trailing 12 months | 12m | label it; never call it 30d |
| D-5 | `gross_margin` | (revenue − vendor_cost) ÷ revenue | 30d | canonical margin (17.5%); any other margin must carry its basis |
| D-6 | `vendor_unpaid_total` | Σ over completed unpaid campaigns of (delivered ÷ 1000 × rate) | — | **$4,275** — the dashboard reads THIS, not $0 |
| D-7 | `avg_cost_per_1k` | Σ vendor_cost ÷ (Σ delivered ÷ 1000) | 30d | blended; unknown-rate rows = `—`, never `$0.00` |
| D-8 | `pace_status` | `critical` <25% / `behind` 25–80% / `onpace` 80%+ of straight-line expected; `awaiting_vendor` if accepted but 0 delivered; `done` if completed | live | one enum, every screen + vendor portal |
| D-9 | `expected_to_date` | goal × (days_elapsed ÷ duration) | live | basis for D-8 and "delivering X% of expected" |
| D-10| `vendor_trend` | sign(per-day[last 7d] − per-day[prior 28d baseline, **excluding** last 7d]) | live | fixes "everyone trending down" |
| D-11| `campaign_tier` | `t1` or `std` per campaign | — | **drives pitching** |
| D-12| `vendor_eligibility` | `{t1:bool, std:bool}` per vendor | — | supply side of D-11; marketplace eligible-count = eligible & not risk |
| D-13| `vendor_offer_status` | `pending → approved → confirmed` (or `rejected`) per campaign-vendor | live | confirm requires allocation > 0; start needs ≥1 confirmed |
| D-14| `engagement_series` | per-day series: streams, popularity (0-100), saves, listeners, streams/listener | live | one combined normalized graph (Priority 8 data) |
| D-15| `allocation_mode` | `manual` / `marketplace` / `hybrid{manualStreams, marketStreams}` | — | hybrid splits the goal |
| D-16| `playlist_territory` | `[{country, sharePct}]` per playlist → per-country `{share, streams, topPlaylists}` | live | powers Territory + per-playlist top countries; supply quality adds `blended_cost_per_1k` + `daily_streams` |
| D-17| `vendor_credit` | clawback balance = **sum of an append-only ledger** (streams + $) per vendor | — | get via clawback, out via re-allocate; never settled |

**UI rule:** a missing value renders `—` with a tooltip, never `0` / `$0.00`. A real zero and "unknown" must look different.

## 9. Schema additions & endpoints

**New columns/tables:**
- `campaign.tier` `enum('t1','std')`; `campaign.allocation_mode` `enum('manual','marketplace','hybrid')` + `marketplace_streams int`.
- `vendor.eligibility` `{t1 bool, std bool}`.
- `campaign_vendor` `{status enum('pending','approved','confirmed','rejected'), allocated int, rate numeric, paid bool}`.
- `playlist.territories` `jsonb [{country, sharePct}]`; view `territory_rollup`.
- `bid` `{campaign_id, vendor_id, streams, rate, status, counter jsonb}`.
- `vendor_credit_ledger` `{vendor_id, streams, amount, reason, dest, campaign_id, created_at}` — **append-only; balance = sum(streams)**. Negative streams = credit applied/redeployed.
- `bridge_message` `{vendor_id, type, body, created_at, seen_at}` — the vendor-facing notification/inbox object (shared with the Vendor Portal).

**Endpoints (illustrative):**
- `POST /campaigns/:id/vendors/:vid/clawback { streams, reason, dest, notify }` → decrement allocation (and **reject the vendor if it hits 0**), append a credit-ledger row (+streams), send freed streams to marketplace or another vendor, and if `notify` enqueue a bridge message.
- `POST /campaigns/:id/vendors { vendor_id, streams, status, applyCredit }` → on `applyCredit`, append a negative ledger row capped at `min(balance, streams)`.
- `POST /bids/:id/accept { applyCredit }` → confirm the vendor (same credit logic, capped).
- `POST /credits/:vendor/apply { campaign_id, streams, notify }` → cap at balance, add vendor coverage to the campaign, append negative ledger row, bridge-notify.
- `POST /campaigns/:id/start` → allowed with ≥1 confirmed vendor regardless of total allocation.

**Enforce server-side** (the mockup can't): every cap, every eligibility check, and treat the credit ledger as append-only so two operators can't double-spend a balance.

## 10. Cover artwork (campaign thumbnails)

Every campaign thumbnail must show the **Spotify album cover**, scraped from the track's public URL via the Web API (`GET /tracks/{id}` → `album.images[0].url`, keyed off the `track` URL on each campaign). **Fallback:** if no cover (or the image 404s), revert to the artist-initials gradient tile. The mockup does this in one place — `cover()` renders an `<img>` over the initials and `onerror` reveals the initials — so wiring real URLs is a one-line change (`COVERART[campaignId] = scrapedUrl`). Cache the URL on the campaign row; refresh on the Priority 8 cadence; don't hot-link `i.scdn.co` per render.

## 11. World map (Territory)

The Territory map is a **choropleth over real country geometry**: it loads the Natural Earth `world-atlas` TopoJSON (`countries-110m`, ~108KB) via `topojson-client`, decodes ~176 countries, and renders them in an equirectangular projection (clipped to ±84° lat so Antarctica doesn't dominate). Each tracked country is filled with a **red intensity scaled to its stream share** (`shadeFor()`); shaded countries are clickable. Country↔share is joined by **ISO-3166 numeric id** (`CODE_ID`, normalized) against the atlas feature ids.

**Production:** self-host `topojson-client` + the atlas JSON (don't hot-link a CDN), or render server-side with `d3-geo`. The projection/shading code is unchanged. Swap `countries-50m` for higher detail.

## 12. Priority 8 — Spotify data, reporting & post-campaign attribution

- **Active campaigns** refresh Spotify/S4A on the agreed cadence. **Performance tab** surfaces streams, listeners, **streams/listener ratio**, **save rate**, playlist adds, and **popularity over time** — separating direct vendor delivery from algorithmic/organic movement.
- **After completion**, a monthly job keeps refreshing for **6 months**, then auto-stops unless Admin extends (store `track_until` + `extended_by`). Persist snapshots (`spotify_snapshot`) so overdelivery and long-tail algo movement are analyzable.
- Strong post-completion movement flags a **renewal** (the Today "Opportunity" card → flag for Sales).

## 13. Vendor-portal sync contract (build once, two views)

| Shared object | Ops side | Vendor side |
|---|---|---|
| `pace_status` (D-8) + `expected_to_date` (D-9) | pace pill on campaigns | "My Active Campaigns" status |
| Payout math (D-6) | Vendor Payouts owed | "Payments" Friday total |
| `vendor_eligibility` (D-12) + caps | Edit-Vendor toggles | which campaigns appear on their Bounty Board |
| `bid` accept/counter | Bounty Board | their bid + your counter |
| `bridge_message` | Communication Bridge (per vendor) | their notifications/requests inbox |
| `vendor_credit_ledger` (D-17) | Clawback Credits | their credit balance + clawback notices |
| Priority 8 refreshes | renewal flag | sustained post-campaign performance |

## 14. Serving / cache

The mockup server sends `Cache-Control: no-store` so the browser never serves a stale build between revisions. In production, version static assets (hashed filenames) and keep `no-store` only on the HTML entry.

## 15. Phase plan

- **Phase 1–3 (built in the mockup):** the full UI — Today, Campaigns (+ approve→confirm→start, clawback, charts, filters, CSV), Vendors & Playlists (+ tier eligibility, merge, credits, payout history), Marketplace, Clients, Intelligence (+ choropleth world map). Data dictionary + bug log.
- **Phase 4 (wiring — your work):** replace the sample objects with the live **metrics module** (D-1…D-17 selectors); apply the schema/endpoints in §9; wire the **vendor-portal sync** (§13); implement the **Priority 8** refresh job (§12); self-host the map atlas (§11) and the cover-art scrape (§10). Enforce all caps and the append-only credit ledger server-side.

---

*Companion file: `REDTEAM-AND-SPEC.md` holds the original redteam findings and a chronological revision log. This document is the readable handoff; that one is the change history.*
