# Adding Ferry to the website

**Ferry's `INSTALL.md` is the authority.** Fetch it fresh (`https://raw.githubusercontent.com/jeremy46231/ferry/main/INSTALL.md`) and follow it; where it disagrees with this page, it wins. Its own rules matter most: touch as few files as practical, keep `basePath` in code and secrets in the server environment, and never read or print an env file.

## Pick the route

- **This repo** (Claude Code, a git repo with a web project: package.json, vercel.json, `api/` or `app/`): do it here, on a new branch.
- **A GitHub repo they name** (cloud session): attach it (`add_repo`, push access), work on a new branch, ask before pushing; open a PR against the repo's default branch (or the upstream repo, if they work from a fork).
- **Separate submit site**: copy `sandbox/vercel` from the Ferry repo into a new repo or folder. This is the reference setup and the fastest to get working.
- **Instructions only**: give the steps below with their real origin and paths filled in.

If the project has no server-side JavaScript runtime (pure static hosting with no functions), Ferry can't run there: say so and offer the separate submit site.

## INSTALL.md in brief (0.4.x)

- Install `@jeremy46231/ferry` with the package manager from the lockfile.
- **Static site on Vercel**: one function `api/submit/[path].ts` with `createFerry({ basePath: '/api/submit' })`, exporting `{ async fetch(request) { return (await ferry.handle(request)) ?? new Response('Not found', { status: 404 }) } }`, plus `vercel.json` redirects `/submit → /api/submit/start` and `/api/submit → /api/submit/start` (merge with existing config). Callbacks: `/api/submit/hca`, `/api/submit/hackatime`.
- **Next.js App Router**: `app/submit/[[...path]]/route.ts`, `GET` calls `ferry.handle`, `export const dynamic = 'force-dynamic'`. Callbacks `/submit/hca`, `/submit/hackatime`.
- **SvelteKit, Workers, Express, Vite**: the host's server boundary (`(await ferry.handle(request)) ?? fallback`, or `app.use(ferry.middleware())`); pass `createFerry({ env })` where `process.env` isn't filled.
- Point the site's Submit button at `/submit`.
- Env file: append Ferry's `.env.example` with the `curl | sed` command in INSTALL.md (it also generates `FERRY_SECRET`). Never `cat` the env file; check with narrow greps like `grep -c '^FERRY_' .env`.

## Environment variables

| Variable | Secret? | Value |
|---|---|---|
| `FERRY_SECRET` | yes | 32+ random bytes (`openssl rand -hex 32`). Changing it signs everyone out. |
| `FERRY_HCA_CLIENT_ID` / `_SECRET` | secret is | Hack Club Auth app |
| `FERRY_HACKATIME_CLIENT_ID` / `_SECRET` | secret is | Hackatime app |
| `FERRY_HACKATIME_MODE` | no | `off` only if Hackatime isn't used (default required) |
| `FERRY_EVENT_START_DATE` | no | `YYYY-MM-DD` |
| `FERRY_AIRTABLE_BASE_ID` | no | `app…` |
| `FERRY_AIRTABLE_API_KEY` | yes | Airtable token |
| `FERRY_FILLOUT_FORM_URL` | no | the published form URL |
| `FERRY_BASE_URL` | no | only behind a proxy or when the origin is detected wrongly |

With the Vercel MCP and a yes, you may set the **non-secret** ones on the event's project. Secrets: the person enters them in Vercel → Project → Settings → Environment Variables. Never ask them to paste a secret into chat, and never type, print, store or commit one. If they paste one anyway, don't repeat it, and suggest rotating it.

## OAuth apps and token (the person creates these)

Give exact redirect URIs for local and production, built from the real origin + `basePath`:
- **Hack Club Auth**: `https://auth.hackclub.com/developer/apps/new`, YSWS scopes (`basic_info`, `name`, `birthdate`, `address`, `verification_status`), redirect `<origin><basePath>/hca`.
- **Hackatime**: `https://hackatime.hackclub.com/oauth/applications/new`, scopes `profile read`, tick **Confidential** and **Use HCA for login**, redirect `<origin><basePath>/hackatime`. Then press **Verify** or ask a Hackatime superadmin. Unverified apps work for the creator but fail for everyone else.
- **Airtable token**: `https://airtable.com/create/tokens`, name `Ferry - <Event>`, scopes `data.records:read` + `data.records:write`, this base only.

## Check

After deploying: open `<site>/submit` (WebFetch, or ask them): it should redirect to `auth.hackclub.com`. A 404 means the mount or redirect is wrong; a 500 usually means missing env vars (Ferry's error page lists the missing names).
