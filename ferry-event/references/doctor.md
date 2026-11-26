# Doctor mode: check an existing Ferry setup

For "Ferry's broken", "submissions aren't linking", "hours are 0", "can you check our setup before launch". Read-only until the person approves a fix. Work through the layers in this order (cheapest and most common first), then give one report.

## 1. Airtable schema
Read the base (`list_tables_for_base`, plus `get_table_schema` for the four Ferry tables). Save the result to a JSON file and run `python3 scripts/check_schema.py <file> [--hackatime off]`. Anything under "Fields to create" or "Links to fix" will break Ferry's writes.

## 2. Automations
`list_automations`, then `get_automation` on each Ferry one:
- Missing, or **off**.
- Link automation still contains `setTimeout` (V1 of this skill): it crashes whenever it has to wait. Replace it with `scripts/link-submission-to-user.js`.
- Hours automation triggered by "record created": fires before the User link exists, so hours fail. Should be "matches conditions" (references/automations.md).
- Script edited but not deployed (the UI shows a pending **Update**).
- `list_automation_runs`: recent failures and their messages.

## 3. Recent submissions (last ~20)
Count rows with an empty `Auth Token`, empty `User` link, empty Hackatime projects, a non-empty `Automation - Error`, or empty `Submitted Hackatime Hours`. Match the pattern, not the first familiar cause:
- **Every** recent row has an empty Auth Token, but Hackatime projects were picked → the Fillout hidden field uses Placeholder, not Default value.
- **Some** rows have tokens and others have no token **and** no projects → the hidden field works; those people didn't finish `/submit` (Ferry erroring at a step, often a missing or misnamed field from layer 1, or a Submit button linking straight to the form). Still ask them to confirm Default value, as a quick rule-out.
- Auth Token set but no User → the link automation is off or failing, or the token doesn't match any User.
- User set, hours empty → hours automation off or wrongly triggered, no Hackatime Token on the User, or no projects picked.

Fixing past rows: once the cause is fixed, rows that already failed won't re-trigger by themselves. Say which rows need a person to resubmit through `/submit`, and which just need the automation re-run (in Airtable, toggle the trigger condition, or run the script with that record ID).

## 4. The live site
WebFetch `<site>/submit`: expect a redirect to `auth.hackclub.com`. A 404 points to the mount; a 500 or Ferry's config error page lists missing env vars. If the repo is available, check env names (not values) and `basePath` against the OAuth redirect URIs.

## 5. Fillout (only if the above doesn't explain it)
Browser or ask them to check: hidden-field Default value, the Airtable connection pointing at this event's base (duplicated forms keep the old one), the User prefetch filter, the project picker filter.

## Report
Only claim what you saw. If views, run history or the live site weren't available, say "couldn't check" rather than "missing", and count failures from the runs you actually have. When the replacement for a broken script is needed, use this skill's `scripts/` files rather than writing a new one, so every event runs the same tested code.

Lead with the most likely cause in one sentence. Then a short table: check, result, fix. Put fixes Claude can make (create a field, replace a script, flip an automation on) separately from the person's own steps, and ask once before applying the Claude-side fixes. Check troubleshooting.md for symptoms that don't match any of these.
