# Pawlour — Business & Product Decisions Log

Recreated after a sandbox reset wiped the original file. Captures key
decisions from the full build so far.

## Company structure
- **WorkInFlow** (division of CapeX Transport) builds and sells Pawlour.
- Multi-tenant: any parlour can self-serve sign up, fully isolated via RLS,
  independent of who owns WorkInFlow — the system is meant to be sold to
  unrelated third-party parlours, not just parlours the owner personally runs.
- Supabase org: WorkInFlow. Project: Pawlour.

## Pricing tiers (staff logins)
- Starter: 1 login. Growth: 3 logins. Pro: 10 logins.
- Group tier (planned, not built): 3+ parlours under one owner, cross-parlour
  reporting, one login switching parlours, centralized billing — offered via
  direct conversation, not self-serve.

## Billing
- Provider: **Paystack** (SA-friendly, ZAR native). Not yet connected — no
  API keys provided. Placeholder pricing: Starter R399, Growth R799, Pro
  R1,499/month.
- 14-day free trial, **no card required** to go live.
- On trial expiry with no active subscription: parlour auto-**pauses**
  (never deletes data). Enforced by a daily `pg_cron` job plus a client-side
  status check on the booking page.
- Parlour's subscription to WorkInFlow is a separate concern from a
  parlour's own clients paying them in-app (also via Paystack, Growth/Pro
  tiers only) — must not be conflated in the schema.

## Booking models
- **Per-groomer**: client picks a specific groomer (stylist model).
- **Capacity-based**: client picks no one — books against overall parlour
  capacity for that service (e.g. "2 wash stations"). Staff assign a
  groomer afterward from the admin bookings list. Both enforced against
  double-booking at the database level (exclusion constraint / trigger).
- Both toggled per-service via "Clients choose which groomer" on the
  Services page — editable after creation, not just at creation time.

## Rewards ("stamps")
- Configurable per parlour (visit count or spend threshold; free service,
  %, or fixed discount). A stamp is earned only when a booking transitions
  to **status = 'completed'** (parlour marks it done & the client has
  paid) — not at booking time. Client sees a real stamp-card visual.

## Pets, not just dogs
- `dog` table (name kept for historical reasons) has a `species` field
  (dog/cat/other) — every pet-facing form and label should not assume dogs
  only.
- Rich pet profile: breed, size, coat, personality tags, health/vet info,
  favorites/quirks, photo upload (Supabase Storage, scoped per user folder).
  Only the pet's name is required — everything else is skippable, with a
  "just book me in" shortcut at every step.

## Client app navigation
- Mobile-first. Uses a slide-out drawer (hamburger button, not a persistent
  sidebar) — "Book", "Offers", "My profile" (renamed from "Account").

## Admin app navigation
- Persistent left sidebar (desktop-oriented, unlike the client app), grouped
  into Bookings / Setup / Grow sections. Overview page shows live stats
  (today's bookings, next 7 days, plan) instead of a plain link list.

## Design direction
- "Premium and minimal": near-white background (#FAFAF8), charcoal text
  (#1A1A1A), small uppercase eyebrow labels, hairline (0.5px) dividers
  between list items instead of separate bordered cards, restrained motion.
- Branding: each parlour sets a logo + two brand colors (primary/accent) via
  `/dashboard/branding`, applied dynamically on the client app via inline
  styles reading from Supabase — real per-parlour white-labelling.

## Client-to-parlour payments (separate from WorkInFlow subscription billing)
- **Done**: each parlour connects their OWN Paystack account (public + secret
  key) via `/dashboard/payment-setup` in admin. WorkInFlow takes no cut —
  money goes straight to the parlour. Secret key protected by RLS (only that
  parlour's staff can read/write it) and never sent to the client app —
  only a public-safe view (`parlour_payment_public`) exposing the public
  key is readable by clients.
- **Done**: two Supabase Edge Functions handle the privileged parts
  server-side using the service role key (never exposed): `verify-payment`
  (confirms a Paystack charge succeeded and matches the booking price, then
  marks it paid) and `refund-payment` (staff-only, checks the caller is
  actually staff of that parlour before refunding via Paystack).
- **Done**: client booking flow — if a parlour has payments enabled, client
  sees "Pay now" / "Pay at the parlour" at confirm. "Pay now" creates the
  booking first (holding the slot), launches Paystack Inline.js, and calls
  `verify-payment` on success before showing confirmation.
- **Refund policy**: no automatic refunds — parlour must manually click
  "Refund via Paystack" on a cancelled, paid-in-app booking.
- **Done**: client self-cancel respecting a per-parlour
  `cancellation_cutoff_hours` setting (Opening Hours page). Inside the
  cutoff, client is told to contact the parlour directly. "Reschedule" is
  currently just a link to book a new time, not a true same-booking move.
- Real end-to-end testing (an actual successful charge) is blocked until a
  parlour connects real Paystack test/live keys — the whole flow is
  code-complete and deployed but unverified against a live payment.

## Known gaps (as of this entry)
- GitHub → Netlify auto-deploy not confirmed reliable; manual `netlify
  deploy --prod` used throughout.
- No parlour switcher for users who belong to multiple parlours.
- No staff invite flow (only the original signup owner can log in).
- No custom domain support.
- Offer audience targeting (all/lapsed/loyal) is stored but not enforced.
- No notifications (booking reminders, reward-ready alerts).
- WorkInFlow's own subscription billing (parlour → WorkInFlow) still needs
  the actual Paystack checkout + webhook wired up — same real-keys blocker
  as client payments above, tracked separately in the Billing section.
