# Pawlour — Business & Product Decisions Log

A running record of decisions made during the build, so they don't get lost as
the project grows. Add to this whenever a real business/pricing/product call
is made — not implementation details, just the decisions and why.

---

## Company structure
- **WorkInFlow** is the parent business (a division of CapeX Transport) that builds
  and sells software products.
- **Pawlour** is a product of WorkInFlow — booking/CRM software for dog grooming
  parlours, white-labelled per parlour.
- Supabase organization: `WorkInFlow`. Project: `Pawlour`.

## Naming
- Product name: **Pawlour** (domain secured: pawlour.app, via Netlify).

## Multi-tenancy model
- One client account per parlour (not shared across parlours a client might visit).
- Billing/tier/status lives on the `parlour` record, not the user — a user (e.g.
  the business owner) can own multiple parlours without their billing merging.

## Pricing tiers (staff logins)
- **Starter**: 1 staff login
- **Growth**: 3 staff logins
- **Pro**: 10 staff logins
- **Group tier (planned, not yet built)**: triggered once a single owner/user
  has 3+ parlours. Not a simple discount — a distinct plan aimed at franchise/
  multi-branch groups, likely offered via direct conversation rather than
  self-serve. Being considered for this tier:
  - Cross-parlour reporting (aggregate view across all their locations)
  - One login, switch between parlours (ties into the "parlour switcher" UI
    already flagged as a to-do from multi-parlour dashboard testing)
  - Centralized billing across their parlours
  - Shared client base across locations — bigger schema decision, only revisit
    once a real group customer asks for it

## Billing model
- 14-day free trial, no card required to unlock go-live.
- On trial expiry without payment: booking page **auto-pauses**, not deleted —
  no data loss, no punitive hard cutoff.
- Growth/Pro tiers include in-app client payments via Paystack (SA-friendly,
  ZAR native). Starter tier stays pay-in-person only.
- Parlour's subscription to WorkInFlow (what they pay us) is a separate billing
  flow from client-to-parlour payments (what their clients pay them) — both can
  use Paystack, but must not be conflated in the schema.

## Notifications
- v1 uses in-app notifications only (offers, reward milestones, booking
  confirmations) inside the client PWA — no WhatsApp/SMS/push infrastructure
  yet. Revisit WhatsApp integration once real parlours ask for it; likely a
  Pro-tier upsell later.

## Rewards
- Fully configurable per parlour (trigger type: visit count or spend total;
  threshold; reward type). No hardcoded "10th cut free" — that's just the
  sensible default shown during onboarding.
- Rewards do not expire by default (v1). Revisit only if a parlour requests it.
- **Done**: `reward_ledger` auto-updates via a database trigger on every
  confirmed booking, regardless of which app created it (admin or client).
  Resets the counter once a reward is earned. No admin UI to configure a
  parlour's reward rule yet — created directly in the database for testing;
  still a to-build screen.
- Client account dashboard (`/book/[slug]/account`) shows upcoming bookings,
  dogs, and live rewards progress — the client's home base after their first
  booking.

## Onboarding
- Self-serve, 7-step guided wizard (business basics → tier → groomers →
  availability → pricing → rewards → go live).
- No manual approval step for parlours going live — a parlour can complete
  the wizard and start taking bookings immediately, trial clock included.

## Open / not yet decided
- Offer redemption tracking (which client used which offer) — deferred, v2.
- Exact discount/feature list for Group tier — deferred until a real
  multi-parlour customer is being onboarded.

## Technical gotchas worth remembering
- Next.js's default globals.css includes a `prefers-color-scheme: dark` block
  that flips text color to light gray on a macOS dark-mode browser. Since
  Pawlour doesn't have a designed dark mode, this was removed — all forms
  force explicit text color instead of inheriting. Watch for this if any new
  page is scaffolded and reuses default Next.js styles.

## Availability model
- Weekly template (on `groomer.weekly_hours`) covers the common case: regular,
  recurring hours. Not every groomer works fixed hours though — real parlours
  have casual/rotating staff, sick days, and one-off extra shifts.
- `groomer_schedule_override` table adds date-specific exceptions on top of
  the template: `is_available = true` adds an extra shift on a day they
  wouldn't normally work, `is_available = false` blocks a day they normally
  would. A groomer can have an empty weekly template and rely entirely on
  overrides for fully casual scheduling.
- Final availability for booking = weekly template for that weekday, with any
  matching date override applied on top. Not yet built: the actual booking
  engine that combines these two into real bookable slots — that's next.
- **Done**: `get_available_slots(groomer_id, date, duration_minutes)` Postgres
  function computes real bookable slots server-side, combining weekly
  template + overrides + subtracting existing confirmed bookings. Both the
  admin calendar and the client booking app should call this same function
  (via Supabase RPC) rather than each re-implementing the logic — this is the
  single source of truth for "what's actually available."
- SECURITY DEFINER note: `get_available_slots` had to be marked SECURITY
  DEFINER — anonymous/public users can't read the `booking` table directly
  under RLS, so without this the conflict check would silently see zero
  bookings and allow double-booking. The function only ever returns time
  slots, never row data, so this is safe.

## Two booking models (added after feedback: not every parlour has clients
## pick a specific stylist — many run more like a production line)
- **Per-groomer** (`service.requires_groomer_selection = true`, default):
  client picks a specific groomer, availability = that groomer's weekly
  hours + overrides, via `get_available_slots`.
- **Capacity-based** (`requires_groomer_selection = false`): client doesn't
  pick anyone — booking is against the parlour's overall capacity for that
  service (`service.concurrent_capacity`, e.g. "2 wash stations"), checked
  against `parlour.weekly_hours` (parlour-wide operating hours, separate
  from any individual groomer's hours) via `get_capacity_slots`. Booking's
  `groomer_id` is nullable in this mode — staff assign internally later
  (no admin UI for that assignment yet — noted gap).
- Both models are enforced at the database level against double-booking:
  an exclusion constraint for per-groomer, a BEFORE INSERT/UPDATE trigger
  checking overlap count against capacity for the capacity model. Neither
  relies solely on the app-level slot check before insert.
