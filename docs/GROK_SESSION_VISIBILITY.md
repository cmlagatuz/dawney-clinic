# Grok Build — Browser-Accessible Session Monitoring for Dawney Clinic

**Current as of 2026-11-14.** This policy exists because the owner wants to read **Grok's actual task conversations/messages in a browser**, not just a PR summary.

## Critical platform distinction

The official Grok Build changelog states that **CLI `/share` and CLI session sharing were removed in v1.0.51 on 2026-10-09**: https://x.ai/changelog/build . Some older command-reference pages still list `/share`; do not tell the owner a live link was created without testing actual installed CLI functionality. **Grok Build terminal sessions do not automatically appear in the ordinary grok.com chat history.** Newer Grok Build still stores sessions locally in `~/.grok/sessions/`, and provides `/export` to file/clipboard, `/resume` and `grok dashboard` for local viewing. Actual exports can contain sensitive content, so do not upload them automatically to public repositories.

## End-of-task requirement for GROK.md

At the end of **each Dawney task/session**:
1. Report the task, session ID (use `/session-info` if available), Git branch, PR/issue, tests and outcomes. Do not fabricate a share URL.
2. If installed Grok CLI supports a native private session-share feature, provide the actual browser URL only after confirming it exists and disclose its access scope. Do not assume `/share` exists.
3. Otherwise use the supported `/export` command or the local saved session to create a **sanitized, readable Markdown transcript preserving actual user and assistant messages in order**. Label it `REDACTED` and distinguish full exported transcript from an AI-written summary. Never invent, rewrite or imply missing messages.
4. Scrub API keys, auth tokens, cookies, login credentials, `.env` contents, patient/owner identifiers, private medical details, signed attachment URLs, raw tool outputs and internal system prompts. If reliable sanitization is impossible, **leave the original transcript local only** and tell the owner.
5. If and only if the owner has configured a **separate PRIVATE GitHub session-archive repository**, commit the sanitized Markdown transcript there under `grok/YYYY-MM-DD/issue-NN-session-<sessionid>.md`. Verify the target repository is private and the resulting GitHub link is readable by the authenticated owner. Never commit raw transcripts to `cmlagatuz/dawney-clinic`, public PRs/issues, or public Gists.
6. Finish Grok's response with **Session transcript: [actual private browser URL]**; if not available, state **Session transcript: local only — <path>**, with the specific reason.
7. Independently update the public Dawney PR with a **short sanitized technical outcome** (not the chat transcript).

This creates one private browser-readable transcript per session *when a private archive and GitHub authorization are configured*. It does **not** sync transcripts into grok.com chat history. The private archive is an opt-in external GitHub storage location, not a default public share.

## One-time owner setup (optional, recommended)

- In GitHub, create a new **Private** repository, e.g. `cmlagatuz/dawney-clinic-agent-sessions`; do not make it public.
- Authenticate `gh auth login` on the machine where Grok runs. Give that account only the permissions it needs and keep the archive separate from the public code repo. Verify `gh repo view cmlagatuz/dawney-clinic-agent-sessions --json isPrivate` returns true before writing.
- Tell Grok the private repo name. Grok should ask the owner before first transcript publication and use a scoped `grok/*` path.
- If the private archive has not been set up, the safe fallback is `/export` locally and open the exported file in your own browser or text viewer. A `file://` URL is local-only and is not a remotely accessible share link.
- For current sessions and real-time local monitoring run `grok dashboard` from a separate terminal; it is **not** the grok.com website.

## Safety and free-tier limits

Do not install third-party public session viewers, anonymous tunnels, webhook relays, public Pages sites, or paid APIs solely to expose private transcripts. GitHub private repositories are accessible via the owner's signed-in browser without needing a new paid AI plan, subject to GitHub's applicable terms/limits. If Grok lacks GitHub write authorization, export locally and report the blocker; do not claim a private URL exists.
