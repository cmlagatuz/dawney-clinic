# RC2 manual backup and independent recovery — owner quick guide
Accepted utility from PR136 e8537d5535ac7b5277cd790968ac26d7494c8bad; exact unchanged [manual recovery guide](MANUAL_SUPABASE_RECOVERY.md), [utility](../scripts/recovery/manual-supabase-recovery.py). The guide is authoritative for command details; this is a simplified sequence, not another backup implementation. [Actual intermediate synthetic verification](https://github.com/cmlagatuz/dawney-clinic/actions/runs/45769785504/job/139739392303) proved PG17 restore, actual GPG and representative object bytes, wrong signer/target and corruption denials. Provider collection/version commands simulated, actual provider recovery, Windows owner UAT and RTO/RPO NOT VERIFIED.

## Before touching a provider
Owner chooses a trusted existing computer, WSL Linux filesystem on encrypted storage, private 0700 workspace outside repository/Windows mount, Python 3.12, Node 22, GPG 2.4+, PG17 client, Supabase CLI 3.0.0 (check actual supported versions and help). No new purchase. Verify independent owner signing/encryption fingerprints, GPG challenge, private keys and passphrase custody; no keys/credentials in commands, chats or GitHub. Agree exact source project/cutoff and pause writes/object changes under separate owner authorization. Review available space for raw collection, plaintext scratch, encrypted components and restore plus duplicate media. Utility's 64 MiB startup floor is not a capacity estimate.
Destination approval is separate: neither existing clinic project may be overwritten, no third free hosted slot assumed. Consider an existing owner-designated isolated machine running compatible local PG17/Auth/Storage/API stack only if documented resources allow it. Record actual database size and object inventory byte totals/counts, expected unpack/restore scratch and images, free encrypted disk, memory/CPU/runtime, supported versions/extensions/managed components, isolated access and adequate recovery window. Local rehearsal is not equivalent to managed provider restore; document differences and require separate compatible destination evidence. If no zero-cost suitable destination is verified, STOP clinic-live release; do not spend or delete either project.

## Create and independently verify
From trusted reviewed checkout in WSL, only after owner approvals:
```bash
mkdir -m 700 -p ~/dawney-manual
python3 scripts/recovery/manual-supabase-recovery.py guide ~/dawney-manual
```
Choose 1 Create backup; independently confirm source and keys twice, space, encrypted disk and authorization. Fresh collection folder only. Menu does NOT collect provider data. Follow approved detailed collection guide manually for five components:
| Component | Required completeness evidence |
|---|---|
| application | roles, schema, data, exact history, managed changes; counts/UUID/relationships/schema/ACL/RLS/routine/trigger fingerprint |
| auth-identities | users/identities and relevant session/account coverage; supported provider export; no double replay of overlapping dumps |
| storage-metadata | buckets, object metadata and policies; independent full source listing paths/counts/sizes, optional source hashes |
| storage-objects | actual original bytes, not metadata alone; exact listing-to-download parity and hashes |
| configuration | nonsecret versions, Auth redirects/email, bucket privacy/limits, extensions, functions/realtime/network, secret names only; manually reconfigure separately |
Review unsupported/filtered components, cutoff and overlap; no guessed NONE or fabricated empty listing. Provide independent listing outside collection; menu hashes files and compares listing. Sign and encrypt five components. Copy entire backup directory to two independent encrypted owner-controlled media; keys separate from copies, not in repository. Choose 2 Verify backup on independently trusted copy with confirmed signer/source, repeat other copy. Verify signed ciphertext sizes/hashes, all components, decryption/object parity. Integrity is not completeness; compare source evidence independently. Protect plaintext/scratch according to clinic retention policy.

## Restore rehearsal and acceptance
After owner approves distinct compatible independent destination choose 3 Prepare restore. Reconfirm source/destination/signer; only local decrypted plan produced, no SQL/import/upload. Review actual provider-supported import plan (avoid duplicate Auth/Storage replay), restore in approved isolated destination only under separate authorization. Start with synthetic data. Record actual source/destination counts/UUIDs, historical patient and appointment, taxonomy, branch grants, policy/ACL/function/trigger fingerprint, receipt/audit/stock balances, object paths/sizes/hash and actual downloaded bytes, private bucket/authorized read and denied access, confirmed identity/fresh login and old token/session behavior, configuration and migration history. Test missing/corrupt package refusal. Measure time from approved start to verified usable service (RTO) and source cutoff vs recovered data (RPO); proposed 4h/24h are unmeasured targets, owner must approve achievable values. No claim of live restore from PREPARED ONLY.
| Message | Operator action |
|---|---|
| COLLECTION_INCOMPLETE | complete missing evidence/export; no reuse of old cutoff |
| SOURCE_MISMATCH / DESTINATION_MISMATCH | stop, independently reconfirm; no relabel/overwrite |
| SIGNATURE_INVALID / BACKUP_CORRUPT | trusted signer/original verified copy; never bypass |
| VERSION_MISMATCH / KEY_NOT_READY / TOOL_FAILURE | confirm versions/key custody/capacity privately; stop on unresolved |
| PACKAGE CREATED / INTEGRITY VERIFIED | independent copy check and source completeness still needed |
| PREPARED ONLY / RESTORE NOT VERIFIED | actual separately approved independent restore and acceptance still required |
On restoration failure isolate target, retain encrypted originals and sanitized failure evidence, investigate compatibility, reattempt only approved clean independent restore. Never silently skip records, relax RLS, rename objects or overwrite clinic. Owner decides scope, target, keys/media, cutoff, capacity, acceptable recovery objectives and any real restore. No actual hosted exports/restores or credentials requested or executed.
