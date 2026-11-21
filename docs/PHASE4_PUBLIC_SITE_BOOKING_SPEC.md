# Dawney Clinic — Public Website and Customer Booking Product Contract

**Supervisor checkpoint: 2026-11-14, Philippines location identified.** Owner request: a modern **public** clinic landing page, actual approved services, location and directions, safe customer appointment booking and private clinic workspace. This is **NOT implemented on current master**. Owner has supplied an original Google Maps link `https://maps.app.goo.gl/JGCXR1H6sHN42aSo6`; use verbatim for a Directions CTA after owner verifies its correct location. Keep the owner portal behind authentication.

## Grounded business facts (external discovery; require owner confirmation before publishing)

- Business: **Dawney Animal Clinic**, along **Brookside Lane, Barangay San Francisco, Arnaldo Highway, General Trias, Cavite, Philippines**.
- Google-matched business listing/Waze: **EBS Building, Phase 5 Lot 14 Block 1**, **0949 375 4160**, hours listed **Monday–Saturday 8:00–17:00 and Sunday 8:00–16:00**, but *other sources list different building/unit and closing hours*. Sources: https://www.waze.com/live-map/directions/ph/calabarzon/general-trias/dawney-animal-clinic?to=place.ChIJf1Oax2rVlzMR4HJjiLSRcd8 , https://www.clinicfinderph.com/clinic/dawney-animal-clinic and https://www.lookph.com/p/dawney-animal-clinic-5b5ee.html .
- Other directories display **Gerardo Commercial** and alternate contact **0939 467 3280**; do not choose an address/unit, phone or hours as authoritative without owner confirmation.
- **Verified externally as advertised/reviewed:** general veterinarian/pet care and *grooming* noted in reviews. Consultation reasonably follows veterinary clinic function but the owner must approve specific marketed offerings; do **not** invent vaccine packages, surgeries, diagnostic services, 24/7 emergency, species treated (especially cattle), prices, veterinarians or appointment availability.
- **Clinic timezone: Asia/Manila**, to be proposed/owner approved and enforced in clinic booking, *not* customer's device timezone nor owner's Saudi timezone. User-provided map short link is a navigation reference; direct link resolution was not available during this checkpoint, though independent business search grounded the place.

## Required information architecture and UX (NEW public routes)

- `/`: public home. Genuine owner-supplied Dawney logo, clinic identity, welcoming hero, **Book an appointment**, **Our services**, **Call clinic** and **Get directions**. Accessible, responsive 360/768/1440, SEO metadata and social share tags (no invented customer reviews).
- `/services`: card/list of **approved service categories only**, with explicit consultation/booking intent, optional descriptions, duration, eligibility/supported species and pricing ONLY if verified and approved. Hide/unpublish unapproved entries rather than generic placeholders. Services must be a source-of-truth contract that clinic staff can review later.
- `/about`, `/location` or `/contact`: approved clinic contact, map link, address/telephone, real hours and holiday notices. **No false map embed, default hours or hidden price claims.**
- `/book`: unauthenticated visitors can **view the intake flow and approved services**, but do not write PII/patient records before authenticating. On choosing service, request time selection only from **actual approved availability** or display **request callback/contact** without claiming a confirmed slot. Maintain *non-sensitive* prebooking intent in memory/session across signup/login; route back safely to booking.
- `/app/*`: retain existing authenticated pet-owner app; distinct authorized `/staff/*` workspace planned. Do not create public access to clinical records. Root must no longer redirect a fresh visitor straight to login/profile.
- Authentication: avoid login wall just to browse services/location. For actual booking, authenticate (existing verified Supabase flow), complete minimal owner profile/register pet, then store **requested** appointment with patient-owner RLS and conflict-safe scheduling; only clinic staff can **confirm**. Clear request/confirmed/cancelled state and handle login return. If future guest-booking is desired, require a separate anti-abuse/security design and explicit owner approval.

## Four-AI boundaries

- **Astra (architecture/backend)**: finish existing Phase4 P0 PR #40 correctly; then on a **new branch/PR** design/implement small verified read-only service catalog/availability contracts, `Asia/Manila` schedule/holiday/resource model with owner-approved values (never invent), robust authentication return-to-booking and booked/confirmed state transitions; `web/src/lib/`, schema/data tests and `docs/` only. Do not edit React pages owned by Claude. Apply no live migration without separate approval.
- **Claude (frontend)**: **do not interrupt active PR #34/#41** while quota exhausted. After resuming and finishing previous task, separate new scoped public `/services`, `/book`, `/location` and home PR from merged master consuming Astra's contracts. Real logo and content only; no fake clinic services or fake availability. Use product brief once active.
- **Qwen (QA)**: first prove GitHub branch/PR ability and finish Issue #36 or extend tests for new public routes without editing production UI. Offline anonymous navigation, SEO/ARIA, 360/768/1440, map link/contact display, deep link, and continuation flow; no live synthetic writes.
- **Grok (audit)**: review public marketing/book flow for anonymous RLS denial, patient enumeration, time-slot race, booking spam/duplicate/abuse, PII before login, staff confirmation authority and exact UTC↔Asia/Manila conversion, without editing production code or live data.

## P0 public website/booking acceptance

1. Unauthenticated customer opens `/` and sees a public Dawney-branded home, approved services and correct Cavite location/contact **without login**.
2. `/services`, `/book`, `/location` deep-link and refresh work on Cloudflare Pages, mobile and desktop; no generic Vite page or redirect loop.
3. Only approved services/treatment eligibility appear; no unsupported animals treated, unverified prices, 24/7 claims, or invented veterinarian profiles.
4. Get Directions uses owner's validated Google Maps link; phone `tel:` button and hours match confirmed clinic information.
5. A visitor can select a service and begin booking, with graceful login/signup and return; no PII preauth storage. Existing owner can choose registered pet, resource/slot and request; status `requested` not `confirmed`.
6. No conflicts/double booking; availability and holiday/hour rules are clinic-timezone aware (Asia/Manila after owner signoff) and server checked; no claims that device time is clinic time.
7. Owner A cannot read owner B bookings/pets; anonymous cannot access owner/staff records; staff confirmation requires verified role and audit event.
8. Real email confirmations only after approved provider/configuration (free-only). If unavailable, show in-app confirmation state and clear instructions to call the clinic; don't pretend emails/SMS sent.
9. Qwen browser tests, Grok security audit, Astra backend verification, Claude visual review all pass before supervisor approves real clinical launch.

## Release gates and owner actions

**Owner confirm:** accurate unit/building and phone; actual opening days/hours, holiday policy, available vet staff/resources, accepted species, service types/durations/prices (if published), whether grooming accepts online requests, and cancellation policies. Do not silently translate Waze directory hours into booking capacity. No paid services. Private patient info never appears on public marketing pages or analytics. Full data recovery / clinical launch still gated.
