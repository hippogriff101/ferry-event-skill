# Ferry automations

Scope: only these. No review, approval, email, Slack, fraud-check or Unified-submission automations. If the base has those, leave them untouched.

| Automation | Trigger (on `YSWS Project Submission`) | Script |
|---|---|---|
| `Ferry: Link Submission to User` | When a record is created | `scripts/link-submission-to-user.js` |
| `Ferry: Submitted Hackatime Hours` (Hackatime on) | When a record matches conditions: User link **is not empty** AND Hackatime Projects link **is not empty** (use their field IDs in the filter) | `scripts/submitted-hackatime-hours.js` |
| `Ferry: Resync Hours on Edit` (opt-in) | When a record is updated, watching the Hackatime Projects link field | same hours script |

**What they do.** *Link* finds the submitter's User (Fillout's prefetched User link → else Auth Token match → else the single owner of the picked Hackatime projects), retrying briefly while Fillout finishes writing, then links it, copies identity fields that exist on the submission, and writes a duplicate-email or no-match warning into `Automation - Error`. *Hours* calls Hackatime with the User's stored token (`stats?features=projects` for the per-project list, `heartbeats/spans` for the total) from the `YSWS Config` Start Date, and writes the **overlap-merged** total, so time logged to two projects at once counts once. Summing per-project totals over-counts.

**Why the resync one exists.** The matches-conditions trigger fires once, when the record first matches. If a submitter later edits their submission through a Fillout edit link (which skips Ferry), the hours stay stale. The resync automation re-runs the hours script on edits; the script reads live Hackatime data and is safe to re-run. It doesn't overwrite `Optional - Override Hours Spent` once set, because reviewers own that field. Offer it as opt-in; until Ferry gets a `/submit/edit` route, it's the workaround for resubmissions.

## Building them with MCP

1. `list_automations` first; skip any that already exist by name. If one with the same name has a different script, show the difference and ask before replacing it.
2. Call `get_create_automation_instructions` (with the baseId) once, to get the exact trigger and node shapes for this connector version.
3. Each automation is a single `customScript` node. Read the script file and pass its full text; pass the trigger record ID as input:
   ```json
   {"type": "customScript", "key": "ferryScript",
    "inputs": {"inputObj": {"recordId": {"$ref": "trigger", "path": ["id"]}}, "script": "<file contents>"}}
   ```
   The scripts find tables and fields by **name** and links by **linked table**, so they work in any base with the schema; don't swap in field IDs.
4. Give each a description: "Ferry: <what it does>. Part of the ferry-event setup; safe to re-run."
5. Confirm `configurationStatus: valid` with `get_automation`. If invalid, read the error, fix, retry once, then report.
6. Leave them **off**. Ask whether to turn them on, and turn on only with a yes. Note that script edits made after turning on need **Update** pressed in the Airtable UI before they go live.

## Without MCP

Give these steps per automation: Automations → Create → trigger as in the table → Add action → Run a script → input variable `recordId` = the trigger record's Airtable record ID → paste the script file → Test → Turn on. Put the script file contents in the reply (or a file) so they can copy it.

## Runtime notes

Airtable's script runtime has `fetch` but **no `setTimeout`**, and a script can run for about 30 seconds. Don't add timers; the link script waits by re-reading the record.
