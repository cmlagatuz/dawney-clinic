# Contract request for Astra — per-service species eligibility (UI side, PR #48)

**Used today (typed, no new queries):** `lib/taxonomy.ts` → `listCatalogPets` (`species_id`, `taxonomy_review_needed`) + `listAnimalTypes` (`clinic_supported`, `is_active`, `review_status`). The UI blocks a patient only when the species is unsupported/pending, the record is uncategorised/flagged, or the species cannot be found; it never reads the free-text `species` label. Legacy patient rows are only annotated, never changed. RPC + insert trigger remain authoritative.

**Missing:** PR #43 creates `clinic_service_species` (authenticated SELECT, RLS-filtered to supported species) but `lib/public-booking.ts` exposes no reader, so the UI cannot say "this service is not offered for this animal". Request one adapter, no SQL change:

```ts
// returns species ids linked to the service (RLS already hides unsupported/pending species)
listServiceSpeciesIds(serviceId: string): Promise<string[]>   // authenticated only
```
Once available the form will additionally disable patients whose `species_id` is not in the list and show "this service is not offered for this type of animal"; until then the server's generic message covers it. Note: anonymous visitors cannot read the table (by design), so /book can only apply this after sign-in.
