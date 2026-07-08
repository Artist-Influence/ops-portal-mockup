# Spotify Ops Portal — Redteam + Revised Spec (Dev Handoff)

**Author:** prepared for the Artist Influence dev team
**Date:** 2026-06-18
**Companion mockup:** `index.html` in this folder (`bun serve.js` → http://127.0.0.1:8124)
**Sister artifact:** the Vendor Portal mockup (`../vendor-portal-mockup/`, port 8123) — the ops portal is the internal mirror of that vendor-facing surface and must show the **same campaign the same way**.

This document does three things:
1. **Redteam** — what is broken or confusing in the current ops portal (from the 28 screenshots).
2. **Data dictionary** — the single source-of-truth definition for every top-line metric, so cards stop disagreeing.
3. **Revised spec** — the action-first IA, what to change and *where*, plus the vendor-portal augmentations and the Phase plan.

The guiding principle: **define each number once, read it everywhere.** Almost every bug below is the same root cause — multiple components each computing the same metric their own way.

---

## 1. Redteam findings

### 1A. Data-integrity contradictions (HIGH — fix first)
| # | What the screen shows | Why it's wrong | Fix |
|---|---|---|---|
| B1 | Dashboard "Total Campaigns **1,000**" (575+1+394=970) vs Operations "Total **534** (250 active)" | Two different totals on one page; neither internally consistent | One `campaigns_total` and `campaigns_active` from one query. See [D-1]. |
| B2 | Dashboard "Vendor Payouts Pending **$0**" + "Approved-Unpaid **$0**" vs Payouts tab "Total Unpaid **$4,275** / 71 campaigns" | The dashboard reads a different (empty) source than the payouts engine | Dashboard reads the **same** payouts aggregate. See [D-6]. |
| B3 | "Streams Delivered (**30d**) 29.3M" == "Streams Delivered (**12m**) 29,297,601" | A 12-month figure is mislabeled as 30-day | Two distinct windowed measures. See [D-4]. |
| B4 | "Gross Margin **17.5%**" vs "Profit Margin **39.0%**" | Different revenue bases (30d actuals vs 12m sum-of-budgets), unlabeled | Pick the canonical margin + window; label the basis. See [D-5]. |
| B5 | "Campaign Efficiency **50%** on pace" vs "On Pace **72%**" | Two different on-pace calcs | One `on_pace_pct`. See [D-3]. |
| B6 | Avg cost/1k = $8.19 / $8.63 / $0.00 (vendor cards) | Mixed windows + missing-rate rows shown as $0 | One blended-rate definition; never render `$0.00` for "unknown". See [D-7]. |
| B7 | "Whale Music" appears 3× (Top Vendors) and 2× (Reliability); "17 vendors folded from 21 raw rows" | Duplicate vendor identities; folding is lossy and leaks into every per-vendor metric | Canonical `vendor_id`; merge UI; never key metrics on display name. See §3D. |

### 1B. Alert fatigue (HIGH — the alerts are training operators to ignore alerts)
- "No Playlist Adds 72h = **453**" of 458 running (99%); "Critical Alerts **388**"; "Flagged **294** (55.1%)". When >50% of everything is critical, none of it is.
- Vendor Reliability: **10 of 11** vendors "trending down" → trend metric is miscalibrated (likely comparing recent 7d to a 28d that includes the 7d, biasing negative).
- **Fix:** dedupe + rank into a single triaged **Today** queue (the mockup shows 17 real items, not 453). Re-base "trending" against each vendor's own prior-period baseline. Make alert thresholds tunable and suppress duplicate alerts per campaign.

### 1C. Goal calibration (MEDIUM)
- Deliveries of **1858% / 1030% / 712%** with Pace capped at **999%**, yet Goal Hit Rate is 53%. Goals are set so low that "Hit" is meaningless and it poisons every pacing/efficiency rollup.
- **Fix:** flag campaigns delivering >150% of goal as "goal likely under-set" (a renewal/upsell signal, per Priority 8), and compute pace against the *contracted* goal while showing an "over-delivery" surplus separately.

### 1D. Workflow / IA (MEDIUM)
- **The operator's core question — "what needs a decision today, and what's the action?" — has no home.** "Behind" is shown but never the next step.
- **Double stacked nav** (global app bar + Spotify sub-bar) wastes vertical space and splits attention.
- **Payout flow scattered** across Dashboard, Campaigns→Payouts, and Vendor Profile — three places, three totals.
- **Stale campaigns never close** ("0% after 350 days, still Active").
- **Campaign Status Breakdown buckets overlap** (Flagged 55.1% + Completed 52.2% + Active 46.8% > 100%) but are presented as exclusive.

### 1E. What is GOOD and must be preserved
- Campaign Intelligence (algorithmic lift, playlist weight, vendor reliability) is genuinely strong — keep the math, fix the trend baseline and presentation.
- The campaign detail modal's tab model (Details / Playlists / Performance / Vendor Payments / Bounty Board / Notifications) is the right shape.
- The Performance Analytics pacing view (projected-at-end, required/day, 90-day timeline) is excellent and is the model for the whole portal's "show me the action."

---

## 2. Data dictionary (single source of truth)

Implement each as **one** server-side aggregate (or one selector) that every card, tab, and the vendor portal read from. No component recomputes these.

| ID | Metric | Canonical definition | Window | Notes / replaces |
|----|--------|----------------------|--------|------------------|
| D-1 | `campaigns_active` | count(status = `active`) | n/a | Replaces the 575 vs 250 split |
| D-1b| `campaigns_total` | count(all spotify campaigns) | n/a | 534, not 1,000 |
| D-2 | `needs_action` | count(distinct campaigns with ≥1 *open* action after dedupe) | now | Replaces 453 raw "no playlist adds" |
| D-3 | `on_pace_pct` | active campaigns where `projected_end ≥ goal` ÷ active | live | One number; replaces 50% vs 72% |
| D-4a| `streams_30d` | Σ vendor-attributed streams, trailing 30 days | 30d | True 30-day window |
| D-4b| `streams_12m` | Σ vendor-attributed streams, trailing 12 months | 12m | Label explicitly; never call it 30d |
| D-5 | `gross_margin` | (revenue − vendor_cost) ÷ revenue | 30d | Canonical margin = **17.5%**. Any other margin must carry its basis in the label. |
| D-6 | `vendor_unpaid_total` | Σ over completed, unpaid campaigns of (delivered_streams ÷ 1000 × vendor_rate) | n/a | **$4,275** — the dashboard reads THIS, not $0 |
| D-7 | `avg_cost_per_1k` | Σ vendor_cost ÷ (Σ delivered_streams ÷ 1000) | 30d | Blended; rows with unknown rate are excluded, shown as "—" not $0.00 |
| D-8 | `pace_status` | `critical` <25% / `behind` 25–80% / `onpace` 80%+ of straight-line expected; `awaiting_vendor` if accepted but 0 delivered; `done` if completed | live | One enum, used on every screen (table, modal, vendor portal) |
| D-9 | `expected_to_date` | goal × (days_elapsed ÷ duration_days) | live | Basis for D-8 and the "delivering X% of expected" copy |
| D-10| `vendor_trend` | sign(streams_per_day[last 7d] − streams_per_day[prior 28d baseline, **excluding** last 7d]) | live | Fixes "everyone trending down" |
| D-11| `campaign_tier` | `t1` or `std` per campaign | n/a | **Drives pitching.** A campaign is only offered to vendors eligible for its tier |
| D-12| `vendor_eligibility` | `{t1:bool, std:bool}` per vendor | n/a | Supply side of D-11. "Both" = both true. Marketplace eligible-vendor count = vendors where `eligibility[campaign_tier]` is true and `risk` is false |
| D-13| `vendor_offer_status` | `pending → approved → confirmed` (or `rejected`) per campaign-vendor | live | Confirm requires allocation > 0. Campaign can **start** with ≥1 confirmed vendor even if Σ confirmed allocation < goal; remaining is addable later |
| D-14| `engagement_series` | per-day series for streams, popularity (0-100), saves, listeners, streams/listener | live | One normalized graph (distinct daily shapes, each scaled to own peak); popularity from Spotify API, rest from S4A (Priority 8) |
| D-15| `allocation_mode` | `manual` / `marketplace` / `hybrid{manualStreams, marketStreams}` per campaign | n/a | Hybrid splits the goal: part allocated to chosen vendors, part posted to the bounty board for bids |
| D-16| `playlist_territory` | `[{country, sharePct}]` per playlist; aggregated to per-country `{share, streams, topPlaylists}` | live | Powers Intelligence→Territory and the top-countries column in Vendors. Vendor supply quality adds `blended_cost_per_1k` + `daily_streams` |

**Rule for the UI:** if a value is unknown, render `—` and a tooltip, never `0` / `$0.00`. A real zero and a missing value must look different.

---

## 3. Revised spec — action-first IA

### 3A. Navigation (one **top header**, not two stacked bars)
Per Jared: keep the **top-header** format (not a sidebar). Collapse the global app bar + Spotify sub-bar into a single top nav. Approvals and Payouts are **tabs inside Campaigns** (they were redundant as separate destinations):

```
[AI] Spotify Ops   Today · Campaigns · Vendors & Playlists · Marketplace · Clients · Intelligence      [search] [alerts] [+ New Campaign]
```
- **Campaigns** tabs: Campaign History · Submissions · Vendor Payouts
- **Marketplace** = NEW: ops-side preview of the vendor-facing marketplace (what's live / pitched), links to the live vendor portal.
- **Clients** = Spotify view (+ Credit, CLV, Avg Spend, Recent, Active).
- Mobile: top nav items collapse; a bottom tab bar carries the primary sections.

### 3B. Today (the new home) — built in the mockup
Replaces the old "Operations Dashboard" + "Live Ops Status" noise strip. Structure:
1. **4 trusted KPIs** — Needs action (D-2), Active campaigns (D-1), Owed to vendors (D-6), Gross margin (D-5).
2. **Triaged action queue** — deduped, ranked cards, each with the *specific next action* and working buttons:
   - Critical delivery (real ones, not the 453) → Open / Add vendor playlists
   - Approvals waiting → Review queue
   - Payouts ready → Open payouts
   - Stale campaigns → Investigate / Mark complete
   - **Renewal opportunity** (Priority 8 signal: strong post-campaign algo lift) → Flag for Sales
3. **Operations Health** — the reconciled KPIs (on pace, goal hit rate, avg cost/1k, streams 30d) with a footnote explaining why they differ from the old dashboard.

### 3C. Campaigns — built in the mockup
- **Tier 1 vs Standard segmentation (D-11):** every campaign carries a `tier` (`t1`/`std`), shown as a badge on the row, in the detail modal, in submissions and in the marketplace. **This drives pitching** — a Tier 1 campaign is only offered to Tier-1-eligible vendors, Standard only to Standard-eligible (see §3E).
- **History tab:** filter bar, KPI strip, table (24h/7d/28d, progress bar with D-8 color, pace pill, invoice state). Row → detail modal.
- **Underperforming-by-vendor view + CSV export:** a "Group: underperforming by vendor" toggle re-groups behind/critical campaigns under the responsible vendor, each group with its own **Export [Vendor] CSV** (and a master Export behind CSV). Use this to email a vendor their lagging campaigns directly when they aren't checking the vendor portal. Exports are real CSV downloads.
- **Submissions tab:** the "awaiting vendor response" queue with Nudge + Approve + Open.
- **Detail modal tabs:** Details (vendor status, **Mark Paid per vendor**, flag-for-sales), Playlists (vendor / unassigned / organic / algorithmic), Performance (**real charts**, see 3C-charts), Vendor Payments (**Mark Paid per vendor**, writes the same record as the Payouts tab). Bounty Board + Notifications tabs are later.
- **3C-charts — Performance graphs (built):** inline SVG (no libraries). (1) **Pacing timeline** — actual area + dashed required/projected/goal lines. (2) **Popularity score 0-100** over time (Priority 8). (3) **Engagement** — Saves, Listeners, Streams-per-listener with sparklines. The live portal was missing these for active campaigns; they now render whenever a campaign has delivery (and show a clear "no delivery yet" state at 0).

### 3D. Vendor Payouts (Campaigns tab) — built
One surface. Total unpaid (D-6), per-vendor owed/paid/streams. **Expandable rows** show per-campaign cost (streams x rate) so you can see exactly what's owed where. The **paid/unpaid count pills are clickable** → popup listing those campaigns. **Mark Paid** per campaign, per vendor, or via select-and-process for the Friday batch — and the same Mark-Paid exists in the campaign modal's Vendor Payments tab (one record, two entry points). The Today KPI and the dashboard both read D-6 — no more $0 vs $4,275.

### 3E. Vendors & Playlists — built (Phase 2)
Vendor cards + All Playlists table (segmented toggle). KPIs (vendors, active playlists, avg cost/1k, follower reach). Add Vendor / Add Playlist / Import / Export / Enrich Genres wired.
- **Tier eligibility (D-12):** each vendor is marked **Standard, Tier 1, or Both** (the Edit Vendor modal's eligibility toggles). This is the supply side of D-11 — it tells the platform which campaign types to pitch each vendor. Badged on every vendor card and in the Admin Vendor Profile.
- **Vendor merge (B7) — built:** a Merge tool resolves the duplicate-vendor folding. "21 raw rows → ~10 canonical vendors" is surfaced as an explicit reconcile action (Whale Music ×3, Brandan Torok/Torok ×2, Moon ×2), not a silent fold. Merging re-keys all campaigns, playlists, payouts and streams onto the canonical `vendor_id`.
- **Admin Vendor Profile** mirrors what the vendor sees + ops actions (edit, copy portal link, nudge) and links to the live vendor portal.

### 3F. Marketplace preview — built
Ops-side, read-only preview of the vendor-facing "Available Campaigns" marketplace: open campaigns with remaining-to-allocate, tier badge, count of eligible vendors (computed from D-12), and offers-in. Tabs for Open / Tier 1 / Standard. "Re-pitch" and "View as ops" actions; deep-links to the live vendor portal (8123). Lets ops see what vendors are actually being shown.

### 3G. Intelligence — later
Per Jared, deferred. Keep the lift math; apply D-10 to the trend. Optimization should generate *specific* actions, not the same generic "consider adding playlists" line on every card.

---

## 4. Vendor Portal augmentations (keep the two portals in sync)
The ops portal exposes data the vendor portal should mirror (and vice versa). Recommended additions to `../vendor-portal-mockup/`:
1. **Shared `pace_status` (D-8) + `expected_to_date` (D-9)** — the vendor's "My Active Campaigns" pacing and the ops pace pill must come from the *same* calc so a vendor and an operator never see different statuses for one campaign.
2. **Shared payout math (D-6)** — the vendor "Payments" Friday total and the ops "Vendor Payouts" owed amount are the same number from the same source.
3. **Bounty eligibility round-trip** — the ops "Edit Vendor → Bounty eligibility" fields (Tier 1/Standard caps, $/1k floor, trusted level, genre/territory strengths, risk flag) drive what the vendor sees on their Bounty Board. One schema, two views.
4. **Communication Bridge** — vendor "pending requests" (accept/counter-offer) is the same object as the ops "Awaiting Vendor Response" queue. Build it once.
5. **Priority 8 post-campaign tracking** — when a campaign completes, both portals show continued monthly refreshes for 6 months (overdelivery, algo momentum); ops gets the renewal-flag action, vendor sees the sustained performance.

---

## 5. Priority 8 (Spotify data / reporting / attribution) — where it lands
- **Performance tab** (built): Spotify Overview KPIs table = streams, listeners, **streams/listener ratio**, **save rate**, playlist adds, popularity-over-time. Separates **direct vendor delivery** from **algorithmic + organic** movement.
- **Refresh policy:** active campaigns refresh on schedule; completed campaigns keep refreshing **monthly for 6 months** then auto-stop unless Admin extends. Surface "last scraped" + an extend toggle.
- **Renewal flag:** strong post-campaign movement → Today "Opportunity" card → Flag for Sales (built as an action).
- **Storage:** persist historical snapshots so overdelivery rates and long-tail effects are analyzable.

---

## 6. Implementation notes — where to change things
> Adjust paths to the real repo. The pattern matters more than the exact file.

1. **Create one metrics module** (e.g. `lib/opsMetrics.ts`) exporting the D-1…D-10 selectors. Every dashboard card, the Today queue, the campaign table, and the vendor portal import from here. **No inline metric math in components.**
2. **Kill duplicate totals:** grep the codebase for each hardcoded/locally-computed total (`totalCampaigns`, `unpaid`, `onPace`, `streams30d`, margin) and replace with the selector. The 1,000-vs-534 and $0-vs-$4,275 bugs live in these duplicates.
3. **Vendor identity:** add `vendor_id` as the canonical key; migrate the 21 raw rows; build a merge tool; key all per-vendor aggregates on `vendor_id`, render display name only.
4. **Alerts → triage service:** one service that produces the deduped, ranked `needs_action` list (D-2) with tunable thresholds and per-campaign dedupe. The Today queue renders its output.
5. **Status enum (D-8):** single source; remove the overlapping "Campaign Status Breakdown" buckets or render them as non-exclusive tags.
6. **Auto-close stale campaigns:** a job that flags `active` campaigns past `duration` with <X% delivery for review/auto-complete, so they stop polluting pacing rollups.
7. **Never render `0`/`$0.00` for unknown** — use a `—` + tooltip helper everywhere a value can be missing.

---

### 3H. Approve → Confirm → Start workflow (D-13) — built, idiot-proof
A campaign's vendors move through `pending → approved → confirmed` (legacy `accepted` = confirmed) or `rejected`. In the campaign **Details** tab:
- Each pending vendor: set an **allocation** (streams) + **Approve / Reject**.
- Approved vendor: **Confirm** (locks the allocation; confirm is blocked with a toast if allocation is 0 — can't confirm nothing).
- A live **allocation bar** shows confirmed streams vs goal (%).
- **Start Campaign** is enabled as soon as **≥1 vendor is confirmed**, even if under-allocated. It opens a confirmation modal that states the %, the remaining streams, and that more vendors can be added later. Disabled (with reason) at 0 confirmed. This is the "start with approved vendors up to this point" requirement.
- The Bounty Board tab shows bids and routes approving back to Details, so there's one canonical approval path (no double source).

### 3I. Performance charts (D-14) — updated per request
One **combined, normalized graph** below the pacing chart plots **streams, popularity (0-100), saves, listeners, and streams-per-listener** together (each line scaled to its own peak so different magnitudes are comparable), with per-metric toggle chips showing the live value. Replaces the separate popularity chart + engagement sparklines.

### 3J. Editable payout rate (D-7 write-path) — built
In Vendor Payouts, the per-campaign `$/1k` rate is an inline editable input for unpaid rows; changing it recomputes `owed` (streams ÷ 1000 × rate) immediately.

### 3K. Vendor performance history mirrors the vendor portal — built
The playlist Performance History modal matches the vendor-facing view (overview + 24h/7d/28d/12m windows + 12-week chart). Follower counts are **clickable** (vendor cards, vendor profile, playlist history) → a **follower-growth** chart (12-month trend, gained, % growth).

### 3L. Allocation modes (D-15) — built
Create Campaign now asks **how to fill the goal**: (a) **Allocate manually** to chosen vendors, (b) **Post to marketplace** so eligible (genre + tier matched) vendors bid, or (c) **Mix of both** with a slider that splits the stream goal between manual allocation and the marketplace. Awaiting-vendor popups surface **open marketplace bids** and which **allocations went through** (Confirmed), and the Bounty Board's bids are fully actionable (Accept → confirms the vendor, Counter, Reject).

### 3M. Territory Intelligence (D-16) — built
A new Intelligence → **Territory** tab parses playlist geography + stream data into a per-country breakdown (share, streams, and the top playlists driving each market). The same dataset feeds a **top-2-3 countries** column on each playlist in the Vendors tab and in the vendor-playlists modal. **Supply quality** (Vendor Reliability) now shows each vendor's **blended $/1k across their live campaigns** and **total daily streams driven**.

### 3N. Other this-pass changes
- **Today:** removed the "triaged, not raw" banner; **Operations Health moved directly under the top-4 KPIs**, above the action queue; action queue has a **Cards/Table** toggle (marketplace-style).
- **Campaigns filters (working):** SFA state (✅/❌), Status (Ahead/On Track/Behind/Not Started/Completed), Invoice (Invoiced/Not Invoiced/Paid), Playlists (has / needs assignment / none), Salesperson, Overall (active/complete/pending/cancelled).
- **Unassigned playlists:** assign-to-vendor dropdown + **mark-organic** icon + **remove** icon per row.
- **Vendor card "Playlists"** opens a real modal (catalog, top countries, performance history). **"Add by URL"** tab built (auto-detect preview) everywhere add-playlist appears.
- **Combined performance graph fixed:** was plotting identical cumulative curves (streams/saves/listeners overlapped and vanished); now distinct per-day series over the elapsed window — all five lines visible and on-scale.
- **Icons** unique per context + subtle animation (header hover, brand glow, badge pulse, action-card icon motion).

### 3O. Refinements (Revision 5) — built
- **Bounty board clarity:** every campaign (pending or active) splits vendors into **Confirmed** (who we already have, with allocations) vs **Open Bids** (competing for the remaining streams), with a goal-coverage bar. **Counter-offer** is now a real modal (edit streams/rate, live total, message).
- **Add vendor + allocate** directly in campaign Details (same format as setup) — used from Optimization too.
- **Campaigns table:** Release date + timeframe column; **every header sortable**; the 4 context cards (Active / Behind / Awaiting / Flagged) are **clickable filters**. Filter labels renamed: the pace dropdown reads **"Pace"**, the overall dropdown reads **"Status"**.
- **Create campaign manual mode:** a vendor allocation **table** (pick vendor + allocate) with a **running total vs goal** and an over/under error. **Hybrid slider de-janked** (updates only the number labels on input, never re-renders the slider).
- **All Playlists table:** working **Filter by Genre / Vendor / Country** dropdowns, **sortable headers**, **clickable followers** → growth chart.
- **Client row → detail modal** (CLV, credit, avg spend, and their **campaigns table with statuses**).
- **Algorithmic Weight rows → popup** showing the playlist's **genres, top territories, and campaigns** (sortable All / Active / Completed).
- **Territory → Heatmap sub-tab** (playlist × country intensity grid).
- **Add-by-URL** tab built everywhere add-playlist appears.

### 3P. Vendor clawback & credits (D-17) — built
A confirmed vendor row has **Reduce / Clawback**. When a vendor can't hit the goal on time (they say so, or we see it and it's unfixed), ops reduces their allocation; the reclaimed streams become a **clawback credit** (tracked per vendor in streams + $), the vendor is **notified**, and the freed streams are sent **back to the marketplace** or **reallocated to another vendor** — so the client's goal still lands on time. A **Clawback Credits** ledger (Vendors tab) shows per-vendor balances + full history, with Apply-to-campaign / Settle.

### 3Q. Refinements (Revision 6) — built
- **Custom dropdown component** (glass UI) replaces every native `<select>` across the platform (filter bars + modal selects) — consistent hover/active/selected states.
- **Release column** shows just the release date + "Day X/Y" (was two dates with a cut-off title).
- **Modal stat cards** no longer overflow the popup (compact sizing + responsive grid).
- **Adjust credit** works (add/deduct with live new-balance preview).
- **Add-vendor + clawback + reallocate** are the same allocation format as setup; usable from Optimization's open-campaign too.
- **Hybrid mix** now has a manual allocation **table for the manual portion** (validated against the manual target; updates as the slider moves), and the slider is de-janked.
- **Icons** refreshed to a more distinctive set (custom home/zap/music/trend/chart/target/spark/users glyphs + new scissors/ledger/undo) and **animate on every interaction** (hover pop, active wiggle, close-spin) plus the existing hero/header always-on motion.

## 7. Phase plan
- **Phase 1+2 (done in mockup):** top-header IA, Today, Campaigns (History/Submissions/Payouts), real performance charts, underperforming-by-vendor + CSV, payouts expand/pills/mark-paid, tier segmentation (D-11/D-12), create-campaign client add, Vendors & Playlists, tier eligibility, vendor merge, Marketplace preview.
- **Phase 3 (done in mockup):** combined metrics graph (D-14), editable payout rate, vendor-matching performance history + follower-growth, **approve→confirm→start workflow (D-13)**, campaign Playlists sub-sections (unassigned/organic/algorithmic), Bounty Board tab, **Intelligence** (Overview: algorithmic lift + Playlist Algorithmic Weight + Vendor Reliability with the D-10 trend fix; Performance Intelligence: goal-vs-actual + pacing alerts; Optimization: campaign-specific actions naming the vendor). ← **you are here**
- **Phase 4 (wiring):** replace the `OPS`/`vendors`/`campaigns` sample objects with the live metrics module (D-1…D-14 selectors); vendor-portal augmentations 1–5; Priority 8 refresh policy (6-month post-campaign monthly refresh + auto-stop) + historical storage; Notifications modal tab; Communication Bridge accept/counter round-trip.

---

## 8. Mockup map (`index.html`)
- Reuses the **exact `<style>` block** from the vendor portal (top-nav layout is layered on via a small override block) so the design system can never drift between the two.
- `OPS` object (top of script) = the reconciled top-line numbers, defined once — the in-code embodiment of the data dictionary.
- `PACE` / `INV` enums = the D-8 status model; `tier`/`elig` fields = D-11/D-12.
- `lineChart()` / `sparkline()` = the no-dependency SVG chart engine used on the Performance tab.
- `downloadCSV()` = real client-side CSV download (used by the underperforming-by-vendor and payouts exports).
- `vendors[]` carry canonical `id` + `raw[]` rows + `dupes` count; `openMerge()`/`doMerge()` = the merge tool.
- `PAGES.*` = one function per route (Today, Campaigns[tabs], Vendors, Marketplace, Clients, Intel).
- Every button is wired (toast, modal, tab, real CSV download, select-and-process, merge, client add, mark-paid, nav). Intelligence renders a clearly labeled placeholder so navigation never dead-ends.

---

## 9. Phase 4 — wiring to live data (implementation spec)

The mockup is feature-complete on the UI side. Phase 4 replaces the in-memory sample objects with a live data layer. **No component changes its shape** — they keep reading the same selectors; only the source flips from constants to API/db.

### 9.1 One metrics module (the single source of truth)
Create `lib/opsMetrics.ts` exporting one function per dictionary entry (D-1 … D-17). Every card, tab, modal, and the vendor portal import from here — never inline metric math in a component.

```ts
// lib/opsMetrics.ts  (illustrative signatures)
export const campaignsActive   = () => count(db.campaigns, { status: 'active' });           // D-1
export const vendorUnpaidTotal = () => sum(unpaidCampaigns(), c => c.delivered/1000*c.rate); // D-6
export const paceStatus  = (c) => { const exp = c.goal*(c.daysElapsed/c.duration);           // D-8/D-9
  if (c.delivered < exp*0.25) return 'critical';
  if (c.delivered < exp*0.80) return 'behind';
  if (!c.delivered && c.vendors.some(v=>v.confirmed)) return 'sfa';
  return c.delivered>=exp*0.80 ? 'onpace' : 'behind'; };
export const vendorTrend = (v) => sign(perDay(v,'7d') - perDay(v,'prior28dExcl7d'));          // D-10
```
Migration checklist: grep for every hardcoded total (`totalCampaigns`, `unpaid`, `onPace`, `streams30d`, margin) and replace with the selector. The 1,000-vs-534 and $0-vs-$4,275 bugs live in those duplicates.

### 9.2 Schema additions this build introduced
- **`campaign.tier`** `enum('t1','std')` — drives pitching (D-11).
- **`vendor.eligibility`** `{ t1 boolean, std boolean }` (D-12).
- **`campaign_vendor.status`** `enum('pending','approved','confirmed','rejected')` (D-13); `allocated int`, `rate numeric`, `paid boolean`.
- **`campaign.allocation_mode`** `enum('manual','marketplace','hybrid')` + `marketplace_streams int` (D-15).
- **`playlist.territories`** `jsonb [{country, sharePct}]`; aggregate view `territory_rollup` (D-16).
- **`vendor_credit`** `{ vendor_id, streams int, amount numeric }` — clawback balance (D-17).
- **`clawback_log`** `{ vendor_id, campaign_id, streams, amount, reason, dest, created_at }` — negative streams = credit applied.
- **`bid`** `{ campaign_id, vendor_id, streams, rate, status, counter jsonb }` — marketplace bids.

### 9.3 Clawback / credit endpoints
- `POST /campaigns/:id/vendors/:vid/clawback { streams, reason, dest, notify }` → decrement allocation, upsert `vendor_credit` (+streams/+amount), insert `clawback_log`, if `dest=vendor:x` push/raise that vendor's allocation else free to marketplace, and if `notify` enqueue a vendor-portal notification.
- `POST /campaigns/:id/vendors { vendor_id, streams, status, applyCredit }` → on `applyCredit`, decrement `vendor_credit` by `min(credit, streams)` and log a negative entry.
- `POST /bids/:id/accept { applyCredit }` → confirm the vendor (same credit logic).
- Credit is a **ledger**, not a mutable field — balance = `sum(clawback_log.streams)`; never overwrite.

### 9.4 Vendor-portal sync (build once, two views)
The ops and vendor portals must read the same objects so a vendor and an operator never see different numbers:
1. **`pace_status` (D-8) + `expected_to_date` (D-9)** — shared selector; ops pace pill = vendor "My Active Campaigns" status.
2. **Payout math (D-6)** — vendor "Payments Friday total" = ops "Vendor Payouts owed".
3. **Bounty eligibility (D-12)** — ops Edit-Vendor toggles drive the vendor's Bounty Board.
4. **Communication Bridge** — ops "Awaiting Vendor Response" = vendor "pending requests" (accept/counter), one object.
5. **Clawback notification (D-17)** — `notify=true` surfaces in the vendor dashboard ("N streams reclaimed: <reason>"); the vendor can see their credit balance with us.
6. **Priority 8** — both portals show continued monthly refreshes for 6 months post-completion.

### 9.5 Priority 8 refresh policy (job)
- Active campaigns: refresh Spotify/S4A on the agreed cadence.
- Completed: a monthly job keeps refreshing for **6 months**, then auto-stops unless Admin extends (store `track_until` date + `extended_by`).
- Persist historical snapshots (`spotify_snapshot` table) so overdelivery and long-tail algo movement are analyzable; strong post-completion movement flags a renewal (the Today "Opportunity" card).

### 9.6 Serving / cache
The mockup server now sends `Cache-Control: no-store` (was caching `index.html`, so browsers showed stale builds between revisions). In production, version static assets (hashed filenames) and keep `no-store` only on the HTML entry.

---

## 10. Revision log (mockup)
- **R3** combined-metrics graph, editable payout rate, follower-growth, approve→confirm→start, Intelligence, Bounty tab.
- **R4** removed alert banner; Operations-Health above queue; action-queue Cards/Table; allocation modes; vendor-card playlists modal; add-by-URL; territory + supply-quality; campaign filters; unassigned assign/organic/delete; functional bids; combined-graph fix; animated icons.
- **R5** bounty Confirmed-vs-Open split; counter-offer modal; add-vendor+allocate; release column; sortable headers; clickable context cards; rename Pace/Status; playlist filters+sort; client detail modal; algorithmic-weight popup; territory heatmap; manual allocation table.
- **R6** custom glass dropdown replacing native selects; modal stat overflow fix; vendor clawback/credit system + ledger; adjust-credit modal; hybrid manual table; icon refresh + interaction animation.
- **R7** `no-store` server (root-caused the stale-view reports); compact uniform modal metric cards (`mstat`); ALL native selects → custom dropdown; clawback credit visible on vendor profile + bid cards; **apply clawback credit** when adding a vendor or accepting a bid; Phase 4 wiring spec.

### Where the clawback lives (quick reference)
- **Use it:** Campaign → open a campaign with a **confirmed** vendor → Details tab → vendor row → **Reduce / Clawback**.
- **See balances:** **Vendors** tab → **Clawback Credits** button (top right) or the **Clawback credits** KPI card → ledger with per-vendor balances + history.
- **On a vendor:** the vendor **Profile** modal shows their clawback credit; vendor **cards** show a credit badge.
- **Spend it:** Add-vendor modal and Accept-bid modal both offer **Apply clawback credit** when that vendor has a balance.

---

## 11. Revision 8 — clawback credit flows closed + vendor-portal bridge

### 11.1 Credit ledger buttons are now real flows (D-17)
- **Apply to campaign** (`openApplyCredit`): pick a live campaign the vendor is tier-eligible for, choose how many credit-streams to apply (capped at the balance, live "credit left after"), notify toggle. On confirm the vendor is added/raised to that campaign at no new cost, the balance drops, a negative `clawback_log` row is written, and a bridge notice fires. Empty-state if the vendor is eligible for nothing (offers Settle instead).
- **Settle** (`openSettleCredit`): close the credit with a method — **Pay cash** (vendor couldn't make good), **Roll to next invoice** (account credit), or **Write off** (forfeited). Logs the settlement, notifies the vendor, zeroes the balance; settled vendors drop off the balances list.

### 11.2 Vendor-portal connection — Communication Bridge
Every vendor-facing action now writes to a **bridge log** (`bridgeNotify`) = exactly what the vendor sees on their end: clawback notices, credit-applied, credit-settled, counter-offers, reallocation ("new allocation"), nudges. Surfaced in the **Vendor Profile → Communication Bridge** (per-vendor, sent/seen state) with a deep-link to the live vendor portal (8123). This is the same object the vendor portal renders as their notifications/requests inbox — build once, two views.

### 11.3 Holes filled / idiot-proofing in this pass
- Credit application is **capped** at the balance everywhere (apply, add-vendor, accept-bid); you can't over-apply.
- Settled/zero-balance vendors **drop off** the ledger's balances list (no ghost rows).
- **Empty states** for "no eligible campaign to apply to" and "no open credits."
- Confirm/notify is explicit on every vendor-facing action (no silent changes to a vendor's allocation).
- Reallocation target vendor is **also notified** (they receive a "new allocation" bridge message), so no vendor is surprised by streams appearing/disappearing.
- Credit is a **ledger** (sum of log entries), never a silently-overwritten field — full auditability.

### 11.4 Remaining stopgaps to wire in Phase 4 (so the dev team knows what's mocked)
- Bridge messages here are local; in production they post to the vendor-portal notification service and the vendor's ack flips `seen`.
- "Apply to campaign" assumes the vendor then actually delivers; production should hold the applied streams as a *commitment* until delivery is scraped, then release.
- Settle "Pay cash" should create a payable in the Vendor Payouts engine, not just log.
- Tier/eligibility and remaining-streams checks here are client-side; enforce server-side on every allocation/credit endpoint.

---

## 12. Revision 9 — Settle removed; credit lifecycle is GET → RE-ALLOCATE only

Per product decision, vendor clawback credit is **never settled/paid/written off** — it only ever moves **from an underperforming campaign to another/new campaign**. Removed the Settle flow entirely.

- Ledger action is now a single primary **Re-allocate to campaign** (`openApplyCredit` → `applyCreditToCampaign`).
- Empty-state (vendor eligible for no open campaign) tells you the **credit stays on the books** until there's a campaign, offers **New campaign**, and notes it auto-applies next time you add that vendor — no dead-end, no settle.
- The whole credit lifecycle: **clawback (get) → balance held → re-allocate (apply to existing/new campaign, or apply on add-vendor / accept-bid) → balance drops to 0 → vendor falls off the ledger.**

### Idiot-proofing audit (adversarially tested, R9)
| Attack | Result |
|---|---|
| Apply more than the balance | Capped (`Math.min`); balance can't go negative; input clamps to balance |
| Apply 0 streams | Blocked with a toast; no state change |
| Clawback a vendor's entire allocation | Vendor auto-set to `rejected` + 0 (no ghost "0-stream confirmed" row) |
| Vendor has credit but no eligible campaign | Empty-state explains credit persists + offers New campaign (no dead-end) |
| Settle anywhere | Fully removed (no functions, no buttons, no copy) |
| Zero-balance vendor in ledger | Dropped from the balances list automatically |

**Honest scope:** these guarantees hold for the operator flows in the mockup (capped, validated, notified, auditable, no dead-ends). True end-to-end idiot-proofing still needs the Phase-4 server enforcement (§9, §11.4): re-apply the same caps server-side, hold applied streams as a *commitment* until delivery is scraped, and keep credit as an append-only ledger so two operators can't double-spend a balance.

---

## 13. Revision 10 — covers, re-pitch, payout history, client email removed

### 13.1 Spotify cover artwork on campaign thumbnails (DEV: implement the scrape)
Every campaign thumbnail — in the **Campaigns table (Campaign / Client column)**, Today action cards, Submissions, Marketplace, Clients' campaign lists, modals, **anywhere a campaign card shows a thumbnail** — must display the **Spotify album cover art**, scraped from the track's **public Spotify URL via the Web API** (`GET /tracks/{id}` → `album.images[0].url`, keyed off the `track` URL already on each campaign).
- **Fallback (required):** if the track has no cover (or the image 404s), revert to the **current artist-initials gradient tile**. The mockup implements this exactly: `cover()` renders an `<img>` over the initials tile; `onerror` removes the image and the initials show through. There is one chokepoint — the `cover(seed, art, sz)` helper — so wiring real URLs is a one-function change (`COVERART[campaignId] = scrapedUrl`).
- Cache the scraped URL on the campaign row; refresh with the rest of the Spotify scrape cadence (Priority 8). Don't hot-link `i.scdn.co` on every render.

### 13.2 Re-pitch flow (Marketplace) — built
The Marketplace "Re-pitch" button now opens a modal that **states exactly what it does**: re-posts the *remaining* streams to the campaign's tier bounty board and pings eligible vendors whose **playlist genres match the song**, *without* touching confirmed allocations. It previews eligible / genre-matched counts and the exact vendor list (with "genre match" vs "eligible" tags), with a notify toggle. Confirming writes a "New bounty" message to each vendor's communication bridge.

### 13.3 Vendor payout history — built (outside the Payouts tab too)
A **Payout History** view (button + clickable "Paid to date" KPI in Vendor Payouts, and a **Payout history** button on every Vendor Profile) shows, per vendor or across all: paid-to-date, avg/Friday, last batch, a **per-Friday paid chart**, a **paid-by-vendor table** (clickable into each vendor), and the **Friday batch table**. All amounts are derived from the same `payouts[]` data used in the Payouts tab, so they reconcile exactly (e.g., Club Restricted $25,298.78 paid). Export to CSV included.

### 13.4 Client popup
Removed the **Email** button (Adjust credit + New campaign remain).

---

## 14. Revision 11 — world map + tab rename
- **Intelligence → Territory** "Heatmap" replaced with an interactive **vector world map** (`territoryWorldMap`): smoothed filled continent silhouettes (`CONTINENTS` outlines + Catmull-Rom `geoPath`) on a gradient ocean with a faint graticule, each tracked market a pulsing red marker **sized by stream share**, positioned by lat/long, clickable into a per-country detail modal (`openTerritory`) with the playlists driving that market. The playlist × country matrix is kept below as "detail". (Dev: the dot landmask is a stylized approximation; swap for a real GeoJSON/topojson choropleth if you want country-accurate borders.)
- Renamed the Campaigns sub-tab **"Campaign History" → "Campaigns"**.

---

## 15. Revision 12 — accurate world map (real country geometry)
The hand-drawn continent silhouettes looked wrong. Replaced with a **real world map**: loads the Natural Earth **world-atlas TopoJSON** (`countries-110m`, ~108KB) from jsdelivr via `topojson-client`, decodes to 176 country features, and renders them as SVG paths in an **equirectangular projection clipped to ±84° lat** (so Antarctica doesn't dominate). Country borders are visible (per-country stroke); markets are projected with the *same* projection so each marker lands on its real country. Loads async + caches (`WORLD_GEO`); shows a "Loading…" state, and if offline a graceful "showing markets only" fallback. 

**Dev note:** for production, **self-host** `topojson-client` + `countries-110m.json` (don't hot-link a CDN); or render server-side with `d3-geo`. The projection/marker code stays identical. Swap to `countries-50m` for higher detail if desired.

---

## 16. Revision 13 — territory map is now a choropleth
Per request: each country is **shaded in a red intensity scaled to its stream share** (dark red = low, bright red = high), via `shadeFor()` mapping share→`hsl(0 s% l%)`. Removed all on-map markers, flags, % text labels and the pulsing animation. A small **color-scale legend** (low% → high%) sits in the header; shaded countries are still clickable → `openTerritory`. Country→share is matched by ISO-3166 numeric id (`CODE_ID`, normalized) against the world-atlas feature ids. The "By country" list + playlist×country matrix remain for exact numbers.

## 17. Self-Learning (spec addition 2026-07-07) — ranking and alerts only, never pricing

Same doctrine as the YouTube (`youtube-ops-mockup/SPEC.md` §6) and SoundCloud
(`soundcloud-ops-mockup/SPEC.md` §6-9) portals: every completed campaign is a labeled
experiment the system learns from. Learned values **re-rank and warn only** — they never
change a sale price, a contracted goal, a vendor rate, or a payout. Billing math stays on
D-6/D-7 exactly as specified above.

### 17.1 Vendor Score (who gets pitched first)
Per vendor, 0-100, recomputed when a campaign completes or a placement is verified:

```
score = 0.35·Delivery + 0.25·Retention + 0.25·Efficiency + 0.15·Responsiveness
```
- **Delivery** — delivered streams vs accepted allocation, last 10 campaigns, recency-weighted
  (60-day half-life).
- **Retention** — % of placements that stayed on-playlist through the campaign window
  (early removals also raise the existing re-add/replace flow).
- **Efficiency** — blended $ per 1K delivered vs the genre median (50 = median; rows with
  unknown rate are excluded per D-7, never treated as $0).
- **Responsiveness** — time from pitch → accept/reject/counter, capped.
- Cold start: new vendors enter at 55 until 5 completed campaigns.
- **Use:** ordering within D-11/D-12 — when a campaign is pitched (manual, marketplace, or
  hybrid per D-15), eligible vendors are ranked by score. Eligibility itself (tier caps,
  risk flag) stays a human-edited field. Score changes and promote/demote suggestions appear
  in an ops-facing Learning panel and require sign-off, mirroring the other two portals.

### 17.2 Delivery pace bands (stall detection + projection)
Learn the daily-streams distribution (P10 / median / P90) per genre × goal-size bucket from
completed campaigns. **Stall** = below the P10 band for 3 consecutive days — replaces the
"no adds in 72h" blanket alert that produced 453 false criticals (§1B). Projected-at-end on
the Performance tab reads the same bands. One-click remedy: re-pitch remaining streams to the
next eligible vendors by score (existing re-pitch flow).

### 17.3 Vendor trend baseline (formalizes D-10)
`trend = sign( streams_per_day(last 7d) − streams_per_day(prior 28d, EXCLUDING the last 7d) )`
This is the fix for "10 of 11 vendors trending down" (§1B) — the old calc compared a week
against a window containing itself. D-10 is the only trend definition any surface may use.

### 17.4 Goal calibration (renewal radar)
Campaigns delivering >150% of contracted goal set `goal_underset = true` → Today
"Opportunity" card → Flag for Sales (§5 renewal flag, now with a learned threshold: the
150% default is configurable and the panel shows the distribution so ops can tune it).
Pace (D-8/D-9) always measures against the **contracted** goal; over-delivery renders as a
separate surplus, never folded into pace.

### 17.5 Playlist health watch
Per playlist (feeds D-16 and the Intelligence tab): streams-per-follower, save rate,
listener-territory mix, follower trajectory. Anomaly rule: stream spike with save rate
< 20% of genre median → `playlist_risk` flag on the placement and a Today action — catch a
botty playlist before the client's dashboard does. Risk-flagged playlists are excluded from
auto-suggested placements until cleared by ops.

### 17.6 Vendor Portal surfacing (extends §4 — one schema, two views)
The vendor portal (`../vendor-portal-mockup/`) must present the learned values honestly but
asymmetrically:
- Vendors **see their own** score, its four components, and its trend — transparency is the
  behavior lever ("your retention dipped: two early removals last month").
- Vendors see **why** they were or weren't pitched ("Tier 1 campaigns route by score; yours
  is 71, top quartile is 84+") — but **never** another vendor's score, rank, or volume.
- Pace warnings on a vendor's accepted campaigns come from the SAME §17.2 bands as the ops
  pill (extends §4.1) — a vendor and an operator can never see different stall states.
- `playlist_risk` flags show on the vendor's own playlists with the evidence and a dispute
  path (routes into the §4.4 communication bridge).
- Vendors see their own playlists' **learned territory profile** (§17.8) and **algorithmic
  weight** (§17.9) with the explanatory features — "your save rate is what makes this
  playlist valuable" is the incentive that keeps inventory clean. Other vendors' playlists
  stay invisible.
- Score **never** changes payout math on either portal — D-6 stays untouched.

### 17.7 Guardrails (all seven learners)
Ranking and alerts only · suggestions require ops sign-off · every applied suggestion writes
an audit row · unknown values render as "—" and are excluded from training, never imputed as
zero · learned values are recomputed from raw history (no self-reinforcing feedback on their
own outputs).

### 17.8 Playlist territory learning (the parsing pipeline behind D-16)
D-16 defines `playlist_territory = [{country, sharePct}]` per playlist; this is how it gets
LEARNED rather than hand-entered:

- **Signal:** during a placement window, diff the artist's S4A listener-country distribution
  against their pre-campaign baseline (captured at setup, same snapshot §5 storage). The
  incremental listeners per country are attributed to the currently-active placements in
  proportion to each placement's share of delivered streams that window.
- **Accumulation:** each playlist keeps a running territory profile = recency-weighted
  average of its attributed country splits across every campaign it has ever appeared in.
  Confidence score = f(observation count); profiles under 3 observations render with a
  "low confidence" chip, never presented as fact.
- **Cold start:** vendor-declared territory (Edit Vendor fields) until 3 observations exist;
  declared vs learned divergence >30 points on any country raises an ops review flag.
- **Uses:** the Intelligence → Territory choropleth and Vendors top-countries column (both
  already in the mockup) read ONLY this profile; campaign targeting ranks eligible
  placements by learned share of the client's requested territories; and a **territory
  mismatch alert** — client bought US-heavy, live delivery trending <50% requested geo by
  mid-campaign → Today action before the client's dashboard tells them first.

### 17.9 Algorithmic weight (which playlists wake up Spotify's algorithm)
The existing "algorithmic lift" math, formalized as a learner — this is Spotify's analog of
the SoundCloud potency score:

- **Campaign-level lift:** `algo_lift = streams from algorithmic sources (Radio, Discover
  Weekly, Release Radar, autoplay/mixes, per S4A source breakdown) during campaign + 6-month
  afterglow, minus the pre-campaign baseline rate.` Reported to clients as surplus — never
  counted toward the contracted goal (D-1 stays vendor-attributed only) and never in payout
  math.
- **Playlist weight:** attribute lift back to placements by timing + stream share, then learn
  per playlist: `weight = algorithmic streams triggered per 1K direct streams delivered`,
  recency-weighted, normalized within genre (50 = genre median). The drivers Spotify's
  algorithm actually watches — save rate and streams/listener from D-14 — are stored
  alongside as explanatory features, so the Intelligence tab can say WHY a playlist is
  heavy ("saves 2.1× genre median").
- **Uses:** placement ranking prefers high-weight playlists over raw follower count (a 40K
  playlist that reliably triggers Radio beats a sleepy 400K one); campaign projections quote
  expected lift by genre ("similar campaigns saw +18-26% algorithmic tail"), which feeds the
  §17.4 renewal radar; low-weight + low-save playlists corroborate the §17.5 risk flag
  (botty playlists never trigger the algorithm — the two signals confirm each other).
- **Guardrail:** weight re-ranks placements and sets expectations. Goals, billing and
  payouts remain on direct vendor-attributed delivery, and lift is always labeled as bonus.
