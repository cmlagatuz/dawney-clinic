# Dawney Clinic — Owner's Operations CRM Video Reference

> **Owner channel direction (2026-11-14):** Keep WhatsApp visible for customer contact, implement the first **actual** automated shared-inbox channel with the free **Telegram Bot API**, and architect optional official **WhatsApp Business Platform** integration (potentially billable, owner-gated). **Viber remains future/disabled** because commercial chatbot terms include ongoing fees. The binding work item is [#53 — Omnichannel Messaging](https://github.com/cmlagatuz/dawney-clinic/issues/53). The clip's WhatsApp-like design is NOT evidence of a working API. No provider credentials, real sending, unapproved campaigns or patient messages before Phase4 source integration and clinic approval. Do not use WhatsApp Web scraping. This updates the future Phase5C communications priority below.

**Supervisor interpretation — November 14, 2026.** Source: owner-uploaded 11.2-second vertical clip, `WhatsApp clinic CRM dashboard_1920p.mp4`, a **human/family clinic UI demonstration**. The excerpt is incomplete; it does **not** verify actual backend, Meta WhatsApp integration, persisted workflow, sending charges, clinical permissions or exact responsive behavior. This is the intended **experience/layout reference**, NOT authority to implement every visible module or publish real patient data.

## What the source demonstrably shows

| Video window | Visible design interaction | Vet-clinic adaptation |
| --- | --- | --- |
| 0–2s | A welcoming dashboard with daily appointment/room/unread/no-show KPIs; 4-column patient-flow board: **Expected / Waiting room / In consult / Seen**, cards with provider, time, check-in, call-in, finish, Undo | **Expected arrivals / Checked in & waiting / With veterinarian / Visit complete**; display *pet name + owner* (and species/breed if appropriate), assigned vet, clinic resource, time and real status; authenticated staff operations with audited transition |
| 2–5.5s | Shared WhatsApp-branded Inbox: left conversation list, unread counters, tags and assignments; large conversation pane; **Parking / Opening hours / What to bring** quick replies, composed/sent chat bubble | Owner communications, appointment inquiries and template responses; show no messages unless provider legitimately connected; don't reveal medical info to unauthorised staff |
| 5.5–8.2s | Appointment **Schedule** with four summary cards, practitioner chips/filters, **Day/Week**, colored time blocks, lunch/unavailable overlays, reminders | Veterinary staff/resource-based schedule with clinic-approved Asia/Manila hours, blocked breaks/holidays, appointment conflict policy and day/week views. Real persisted slots only |
| 8.2–11.2s | **Campaigns** broadcast/template tabs with send/read/reply/booking metrics, cards for scheduled and in-progress campaigns, recipient counts, **no-consent exclusions**, pre-send confirmation dialog and progress | Later **vaccination/deworming/follow-up reminders and recalls**, approved templates, opt-in/opt-out, limited sending, clinician-approved content and truthful counts; no mass sending until approved integration |

## Visual design language

- Slim dark forest-green icon rail, highlighted current navigation, subtle status indicator; spacious pale mint/off-white canvas; white softly elevated rounded cards and restrained fine borders.
- Dense but legible operational cards, clear hierarchy and large heading; numeric mini-KPIs, capsule provider/status labels, in-row actions.
- Immediate interaction feedback, reversible actions, sidebar switching and contextual overlays; no full-page reloads for every state change.
- **Use Dawney's actual branding/logo and accessible established light/dark tokens**, not the reference's identity/wordmark or copied personal data; preserve existing approved React shell rather than rewriting PR #34.
- Desktop-first staff workflow can collapse to well-designed mobile views; 360/768/1440 px, keyboard focus, touch targets, contrast, reduced motion. Only live data or clearly identified preview/demo data.

## Product boundaries and release sequence

**Phase 4 MVP NOW (finish before additional module development):** PR #46 CI → #34 branded shell → #40 animal taxonomy → #43 secure booking with incorporated approval-column privacy → #49 recovery checklist → #52 regression after source integration → #41 patient form and #48 public website/owner booking. No self-merges, unapproved SQL or live availability. This video does **not** replace the public Home / Services / Location / Book experience.

**Phase 5A — FIRST reference-inspired enhancement (after approval of existing sources):** build a *staff-only Clinic Operations* dashboard with real KPIs and interactive patient-flow columns. New app data model/role permissions to be reviewed by Astra; check-in/consult/complete actions must correspond to authorized persisted transitions and audit events. Start with static design prototype on a separate Claude UI branch, then use real approved data; no mock patient rows in production.

**Phase 5B — Schedule:** rich day/week vet/resource calendar; event types, overlap prevention, room capacity, unavailable holidays; no invented practitioner schedules.

**Phase 5C — Communications inbox:** UI/UX only until provider connection is configured; no unauthorized WhatsApp Web scraping, fake sent status or hidden provider integration. Shared-inbox access needs staff permissions, auditable sender identity, consent and privacy model. Avoid clinical diagnoses in automatic responses.

**Phase 5D — Campaigns/recalls:** only after confirmed opt-in and official delivery integration, staff permissions, approved templates, rate/cost safeguards and send-confirmation UX. Template sending via Meta's platform may incur charges; the owner has said to stay on free tiers wherever possible, so a local reminder queue/draft-only mode is an acceptable first implementation. Broadcast send buttons **must remain disabled** without approved provider/costs.

## Definition of done for visual-reference implementation

- An interactive staff dashboard visibly communicates: today's appointments, checked-in patients, in consultation, completed, waiting time, room occupancy, no-shows, with permission-checked quick transitions.
- A resource/schedule calendar has day/week switch, filtering, no double-booking, correct timezone, empty/error states and explicit unpublished-hour handling.
- Inbox and campaigns never claim messages delivered/read or broadcast sent unless official platform events confirm those statuses.
- Site and clinic CRM are clearly separate navigation contexts; no exposure of protected patient data on public pages; role RLS is enforced by backend.
- Reference is a *creative direction*, not a pixel-perfect copy of someone else's branding, medical sample names, data or logo.

## Supervisor guardrails

- **Do not assign Claude a full CRM rebuild today.** Owner has shared a partial demo to establish direction; ship the existing booking MVP first. A bounded Phase5A UI brief becomes the next feature after supervisor code integration and staff authorization requirements are settled.
- Grok security review is paused by Free quota. Astra validates actual backend and permissions; Qwen Chat conducts read-only UX review; neither is independent production security acceptance by itself.
- Do not assume screenshot interactions represent backend functionality. All clinic specifics, valid service types, WhatsApp integration and pricing remain separate owner decisions.
