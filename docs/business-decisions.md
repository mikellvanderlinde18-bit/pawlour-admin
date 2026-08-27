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

## Appointment experience upgrade
- **Done**: care/behavioral flags on the pet profile (`dog.care_flags`),
  separate from the fun personality tags — operational/safety info like
  "Muzzle needed" or "Senior — go gentle". Shown prominently (amber badges)
  on the admin bookings list so any groomer sees it before starting.
- **Done**: live appointment status (`booking.appointment_status`) — admin
  sets it via a dropdown (Checked in → In progress → Drying → Ready for
  pickup → Collected), client sees it update in real time via a Supabase
  Realtime subscription on the `booking` table (no refresh needed).
- **Done**: groomer notes per visit, editable by staff, shown to the client
  on their booking history.
- **Done**: tipping — 0/10/15/20% quick-select shown only for in-app
  payment, added to the Paystack charge total and stored separately
  (`booking.tip_amount`) from the service price. The `verify-payment` edge
  function was updated to check the paid amount against price + tip, not
  just price, since a mismatch there would have silently broken every
  tipped payment.
- **Deferred** (each is its own substantial build): full grooming photo
  history, reviews, package/membership pricing (prepaid credit bundles —
  a different concept from rewards), saved payment methods (needs
  Paystack's card tokenization), push notifications (needs web push
  infrastructure).

## Smart visit reminders
- **Done**: `get_predicted_next_visit(dog_id)` Postgres function looks at a
  dog's last 5 *completed* bookings, computes the average interval between
  visits, and predicts the next due date. Needs at least 2 completed visits
  to make a prediction — returns nothing otherwise.
- **Done**: client's My Profile (home) page shows a reminder card for any
  dog whose predicted next visit is within 7 days or overdue, and who
  doesn't already have an upcoming booking — tapping it goes straight to
  booking.
- **Scope note**: this is an in-app reminder only (shown when the client
  opens the app), not a push/SMS/email notification — that's still the
  deferred "push notifications" item above, which needs separate
  infrastructure (web push subscriptions, VAPID keys) to actually alert
  someone who hasn't opened the app.

## WorkInFlow subscription billing (parlour → WorkInFlow)
- **Done, real test keys in use**: WorkInFlow's own Paystack account
  (separate from any parlour's own account) is stored in
  `workinflow_settings` — a single-row table with RLS enabled and
  deliberately NO policies, so only server-side edge functions using the
  service role key can ever read the secret key. Not even parlour staff can
  see it via the API.
- **Done**: `subscribe-parlour` edge function — confirms the caller is
  actually staff of the parlour, then self-bootstraps Paystack "Plan"
  objects for each tier on first real use (creates and caches the plan
  code rather than needing a manual setup step), initializes a Paystack
  transaction tied to that plan, and returns a checkout URL. The admin
  Billing page's "Subscribe" button now does a real checkout redirect
  instead of showing a placeholder note.
- **Done**: `workinflow-paystack-webhook` edge function — verifies
  Paystack's HMAC-SHA512 signature before trusting any event, then updates
  the `subscription` and `parlour` tables on `charge.success`,
  `subscription.create`, `invoice.payment_failed`, and
  `subscription.disable`.
- **Still needed before this works end-to-end**: the webhook URL
  (`https://vdktciebkfyjtanyzdfu.supabase.co/functions/v1/workinflow-paystack-webhook`)
  must be registered in the Paystack dashboard (Settings → API Keys &
  Webhooks → Webhook URL) — otherwise Paystack has nowhere to report
  payment events back to.
- Currently on **test keys** — a real end-to-end test (subscribe → webhook
  fires → subscription flips to active) hasn't been run yet.
- **Bug found & fixed**: all three payment edge functions (`subscribe-parlour`,
  `verify-payment`, `refund-payment`) were missing CORS headers, which
  silently blocked every browser call to them — the "Redirecting to
  Paystack…" button would hang forever with no error, since the fetch
  promise never resolved and no try/catch existed to surface a failure.
  Fixed by adding proper CORS headers (including OPTIONS preflight
  handling) to all three functions, and wrapping every corresponding
  frontend fetch call in try/catch/finally so a network or CORS failure
  always resets the button state and shows an error instead of hanging.
  Worth remembering for any *future* edge function called directly from a
  browser: CORS headers are not automatic on Supabase Edge Functions and
  must be added explicitly.

## Multi-provider client payments (Paystack + Yoco + PayFast)
- **Decision**: parlours can choose whichever payment gateway they already
  trust or already use for their card machine — not locked to Paystack.
  Netcash deliberately deferred (heavier merchant accreditation process,
  more complex/older-style API) — flagged as a near-term follow-up once
  there's real demand for it.
- **Done**: `parlour_payment` redesigned to be provider-agnostic —
  `provider` column plus a `credentials` jsonb column, since each provider
  needs different fields (Paystack/Yoco: public+secret key; PayFast:
  merchant_id + merchant_key + optional passphrase). The public-safe view
  (`parlour_payment_public`) exposes only the one field each provider's
  client-side checkout actually needs — never secrets.
- **Done**: three genuinely different checkout flows, since each provider
  works differently:
  - **Paystack** — popup via Inline.js, then server-side `verify-payment`
    confirms the charge really happened before marking a booking paid.
  - **Yoco** — popup via their Web SDK tokenizes the card client-side, then
    a NEW `yoco-charge` edge function does the actual charge server-side
    using the parlour's Yoco secret key (this is a two-step flow, unlike
    Paystack's single verify step — the token itself isn't a completed
    payment until charged).
  - **PayFast** — no popup at all. A new `payfast-generate-checkout`
    function builds and signs the required form fields server-side (so the
    passphrase never reaches the browser), the client's browser submits a
    genuine HTML form POST to PayFast's hosted page, and a separate
    `payfast-itn-webhook` function receives PayFast's server-to-server
    notification once payment completes and marks the booking paid.
- **Real bug caught before it shipped**: PayFast's required signature
  algorithm is MD5, which the standard Web Crypto API does NOT support
  (SHA family only) — using `crypto.subtle.digest("MD5", ...)` would have
  silently thrown at runtime. Fixed by importing Deno's `jsr:@std/crypto`,
  which extends supported digest algorithms to include MD5.
- **Done**: `booking.payment_provider` records which gateway actually
  processed a given booking's payment, since refunds need to know which
  API to call for a specific historical booking (a parlour could switch
  providers over time). Refund function branches per provider — Paystack
  and Yoco refunds work through this function; PayFast refunds currently
  require the parlour to process them manually in their own PayFast
  dashboard (PayFast's refund API needs separate per-merchant setup beyond
  the standard credentials, not yet supported here).
- Admin Payment Setup page now shows a provider picker with the right
  fields per provider, plus honest guidance on which provider fits which
  situation (already have a Yoco card machine → pick Yoco; want the
  simplest setup → Paystack; want the widest local payment methods like
  Instant EFT/SnapScan or run on debit orders → PayFast).

## Groomer choice removed
- **Decision reaffirmed and enforced**: clients never pick a specific
  groomer — this isn't a hairdresser relationship. Every service now uses
  capacity-based booking only.
- **Done**: removed the "Clients choose which groomer does this service"
  toggle from both the admin service creation and edit forms — capacity
  ("how many can you do at once") is now always shown, unconditionally.
  Existing services were migrated (`requires_groomer_selection` forced to
  false), and the column's default changed to false for any new service.
- The `requires_groomer_selection` column and the client app's branching
  logic on it were deliberately left in place rather than ripped out —
  since every service now has it false, that code path is simply dead
  (never triggered), not broken. Removing it entirely would be a larger,
  purely cosmetic cleanup with no functional benefit right now.
