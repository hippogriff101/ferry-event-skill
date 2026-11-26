# Ferry's Airtable schema

The machine-readable version is `assets/ferry-schema.json`; `scripts/check_schema.py` compares a base against it. This page explains the why, so you can make good calls on edge cases.

**Names are the contract.** Ferry writes to Airtable by field name through the REST API. A misspelt or missing field doesn't fail quietly: the whole write is rejected (`UNKNOWN_FIELD_NAME`, 422) and the submitter sees an error page. So match names exactly, including spaces, slashes and capitals.

## Tables

**`User`**: one row per submitter. Ferry creates and updates it after Hack Club Auth sign-in. Primary field `Slack ID` (the dedup key: a returning person updates their row instead of making a new one).
| Field | Type | Notes |
|---|---|---|
| Slack ID | singleLineText (primary) | |
| First Name, Last Name | singleLineText | |
| Email | email | |
| Birthday | date (ISO) | |
| Address (Line 1), Address (Line 2), City, State / Province, ZIP / Postal Code | singleLineText | |
| Country | singleLineText (singleSelect also works) | |
| Hackatime User ID | number, precision 0 | |
| Hackatime Token | multilineText | Description "Stored by Ferry. Do not edit or share." It's a live credential: never print it. |
| Auth Token | singleLineText | Minted by Ferry; Fillout's linking key |
| Hackatime Projects | link → Hackatime Projects | Created as the inverse of `Hackatime Projects.User`. Airtable often auto-names it `Hackatime Projects 2` or after the table: rename it to exactly `Hackatime Projects`. |

View **`Fillout (DON'T TOUCH)`**: a plain grid view Fillout's User prefetch is limited to. Neither MCP nor the Web API can create views; it goes in the Fillout stage (browser mode creates it) or the person's checklist.

**`Hackatime Projects`**: primary `Name`. `Time` (duration, h:mm), `User` (link → User), `Auth Token (from User)` (lookup of User → Auth Token; Fillout's project picker filters on it so people only see their own projects). If the connector can't create lookups, it's a manual step.

**`YSWS Project Submission`**: Fillout writes it. If creating it, use primary `Code URL` (url), as in the Unified YSWS template. Needed: `Project Name`, `Playable URL`, `Description`, `Screenshot` (attachments), the three feedback questions, `Auth Token`, `User` (link), `Hackatime Projects` (link: any existing link to that table counts whatever it's called, e.g. `Hackatime Project(s) Used`; don't add a second), `Automation - Error`, and with Hackatime on `Submitted Hackatime Projects` (long text) and `Submitted Hackatime Hours` (number, 2 dp).

Optional fields the link automation fills when present: First/Last Name, Email, Birthday, address fields. The hours automation also fills the Unified fields `Justification - Hackatime Project Name(s) + Date Range(s)`, `Justification - Submitter Hackatime ID` and `Optional - Override Hours Spent` when they exist and are empty. Leave every other existing field alone.

**`YSWS Config`**: primary `Key`, plus `Value`. Row `Start Date` = event start (`YYYY-MM-DD`). Ferry fills it from `FERRY_EVENT_START_DATE` only when empty; an existing value wins, so editing it in Airtable is how you change it later. The hours automation reads it too.

## Connectors

- **A connector that applies changes directly** (`create_table`, `create_field`…): prefer it.
- **A connector whose schema changes return an approval link** the person must click. Batch the changes so they click as few links as possible, then re-read the base to confirm (the UI can lag; tell them to refresh).
- **Neither**: use `scripts/airtable_setup.py` (they run it on their own computer; preview by default, `--apply` to write) or give the table above as a checklist.

## Rules when writing

- Create only what's missing. Never delete, rename (except the auto-named inverse link above) or retype existing tables, fields or views.
- A field with the right name but the wrong type: report it and ask. Changing a type can wipe data.
- Different table names are possible (Ferry's `createFerry({ airtable: { tables: { … } } })`), but only when the site already passes them; otherwise use the defaults.
