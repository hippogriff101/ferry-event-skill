---
name: ferry-event
description: Sets up, copies or checks Ferry (Hack Club Auth + Hackatime submission flow) for a Hack Club YSWS event. Builds Ferry's Airtable tables, fields and automations, adds Ferry to the event site, and sets up the Fillout form, with a preview before any change. Use whenever someone runs /ferry-event, wants submissions, /submit, Hackatime hours or Fillout wired up for a YSWS, is starting a new edition of an old event, or says Ferry, submissions linking or hours are broken. Not for review, approval, email, Slack or fraud-check flows.
---

# Ferry event setup (v2)

Ferry (`@jeremy46231/ferry`, github.com/jeremy46231/ferry) is a library mounted at `/submit` on an event's site. A submitter signs in with Hack Club Auth (HCA), is checked for YSWS eligibility, gets a `User` row in Airtable, connects Hackatime (projects synced into `Hackatime Projects`), then lands on the Fillout form with `?auth_token=…`. Fillout writes the `YSWS Project Submission` row, and two Airtable automations link it to the User and fill in the hours.

This is a Hack Club tool for event organisers, many of whom haven't set up Ferry before. Assume they know their event, not Ferry's internals: explain each choice in a line, and fill in their real names and URLs rather than placeholders.

## Where the files are

This skill's scripts, reference pages and schema live next to this file (`scripts/`, `references/`, `assets/`). If they aren't there (installed from a claude.ai save card, which only keeps this file), get them from the skill's repo at `https://raw.githubusercontent.com/hippogriff101/ferry-event-skill/main/ferry-event/<path>`. Read reference pages with WebFetch. For scripts you'll run or hand over, download them into the working directory (`curl -fsSL` if the shell can reach GitHub, otherwise WebFetch and write the file) and use them exactly as published. If GitHub can't be reached at all, say so and work from this file plus Ferry's own docs, telling the person which checks you couldn't run.

## What this skill does and doesn't do

It covers **Ferry only**: Airtable schema, the Ferry automations, the site's `/submit`, the Fillout form, and checking them. No review/approval/email/Slack/fraud-check/Unified-submission automations and no Airtable interfaces. If those exist in a base, leave them alone. If asked for them, say they're outside this skill.

Always write "Hack Club" with that spelling and spacing.

## Ground rules (these are what make it safe to hand to anyone)

- **Preview, then one yes.** Before writing anything to Airtable, a repo, Vercel or Fillout, show the exact list of changes (from `scripts/check_schema.py` plus the automations and site changes) and get a yes. People run this against live event bases; a surprise change mid-event costs real submissions.
- **Add, never remove.** Create only what's missing. Never delete, rename or retype existing tables, fields, views or automations. The one exception is renaming Airtable's auto-named inverse link to `Hackatime Projects`, which is part of the preview. If something has the wrong type, report it and ask.
- **Secrets never pass through you.** Don't ask for, print, store or commit secrets (client secrets, `FERRY_SECRET`, Airtable tokens, `Hackatime Token` values). Give the person the exact place to paste them. If one gets pasted into chat, don't repeat it, and suggest rotating it.
- **Re-runs are safe.** Every stage checks what already exists first, so the skill can be run again after a partial setup or a failure.
- **Keep a task list** (one item per stage) and say what you're doing in a line per stage.

## Stage 0: Check Ferry's version, then choose the mode

This skill was written against **Ferry 0.4.0**. Fetch `https://raw.githubusercontent.com/jeremy46231/ferry/main/package.json` (WebFetch). If the version is newer, skim `INSTALL.md` and `DESIGN.md` (Airtable mapping, routes) for changes before continuing; where they disagree with this skill, Ferry's docs win. Tell the person in one line if anything changed.

Then pick the mode. If the request already makes it clear ("set up Ferry for our new event", "copy last year's setup", "Ferry's broken"), say which mode you're using in a line and go on; only ask (AskUserQuestion if available) when it's genuinely unclear:
1. **New event**: set Ferry up from scratch.
2. **New edition of an old event**: copy the Ferry setup from a previous event's base and form.
3. **Check / fix an existing setup**: doctor mode. Read `references/doctor.md` and follow it instead of Stages 1–6.

## Stage 1: Inputs

Ask in one plain-text message (so they can paste URLs):
1. **Event name** (e.g. "Moonshot"), used in names like `Ferry - <Event>`.
2. **Airtable base**: URL, ID (`app…`) or name, or "make a new one" (ask which workspace; `list_workspaces`).
3. **Event start date** (`YYYY-MM-DD`): Hackatime time before this doesn't count.
4. **Production site URL** and, if known, the local dev port.
5. **Fillout form**: existing form URL, an old event's form to copy, or "make a new one".
6. **Hackatime required?** Yes for nearly every YSWS. "No" sets `FERRY_HACKATIME_MODE=off` and drops the hours automation and the project picker.
7. **Can submitters edit after submitting?** If yes, offer the opt-in resync automation.
8. *(Copy mode)* **The old event's base** and form.

Then ask how to do the hands-on parts:
- **Website**: "Add Ferry to this repo" (only if you're in a git repo with a web project) / "I'll name a GitHub repo" / "Make a separate submit site" / "Just give me instructions".
- **Fillout**: "Set it up in my browser" / "Give me step-by-step instructions".

Ask only for what the message didn't already give. Anything you assume (a dev port, a base name, whether edits are allowed) goes in the reply labelled as an assumption, never stated as fact.

Base IDs are `app` plus 14 letters and digits (17 characters). If the one given doesn't fit, ask them to copy it from the base's URL before calling any tool. Resolve the base with `search_bases`, and confirm the exact base name and ID back to them before going further. Create a new base (`create_base`, named `<Event> - YSWS`) only after they confirm.

## Stage 2: Airtable schema

Read `references/schema.md`. Load the Airtable tools with ToolSearch; work out which connector you have (that page explains both, and the no-connector fallback).

1. Read the base (`list_tables_for_base`, plus `get_table_schema` where needed) and save it as JSON in the working directory.
2. Run `python3 scripts/check_schema.py <file> [--hackatime off]`. Its output is the schema part of the preview.
3. **Copy mode:** also run it on the old base. Fields the old submission table has beyond Ferry's are offered, not copied silently: recommend the event's own questions (the duplicated form writes to them) and Unified fields like `Optional - Override Hours Spent`; flag fields that belong to review or fraud-check flows (a Status field, for example) as outside Ferry. List the old base's non-Ferry automations and tables (e.g. a Shop) and say they aren't copied.
4. Show the preview (schema + Stage 3 automations); on a yes, apply it. Then re-read and re-run the checker until it's clean, except for the manual items.
5. Create or update `YSWS Config` row `Start Date`.

No connector: give them `scripts/airtable-extension-setup.js` to paste into Extensions → Scripting in their base. It's one self-contained file that previews, asks, then adds what's missing; no token or install. For people who'd rather use a terminal, hand over `scripts/airtable_setup.py` **together with** `scripts/check_schema.py` and `assets/ferry-schema.json` in the same layout (it needs both). The schema.md table works as a checklist otherwise.

## Stage 3: Ferry automations

Read `references/automations.md`. Build `Ferry: Link Submission to User`, and with Hackatime on `Ferry: Submitted Hackatime Hours`, plus `Ferry: Resync Hours on Edit` if they opted in. Use the script files in `scripts/` exactly as they are. Leave them off, check they're `valid`, then ask whether to turn them on.

## Stage 4: Website

Read `references/website.md`. Fetch Ferry's `INSTALL.md` fresh and follow it for the chosen route. Work on a branch and ask before pushing. Set only non-secret env vars yourself (with a yes); give the person the OAuth app steps with exact redirect URIs. Check `<site>/submit` redirects to Hack Club Auth once it's deployed.

**Copy mode on the same site:** usually no code changes, only env vars (`FERRY_AIRTABLE_BASE_ID`, `FERRY_EVENT_START_DATE`, `FERRY_FILLOUT_FORM_URL`). Changing them switches live submissions to the new base at once, so agree a switch-over time with the person first (after the old event's deadline). The Airtable token must also cover the new base: they add it to the existing token or make a new one.

## Stage 5: Fillout

Read `references/fillout.md` and follow it in the chosen mode. The Auth Token hidden field's **Default value** (not Placeholder) is the step that breaks most often, so call it out even in browser mode. In copy mode, make sure the duplicated form is reconnected to the new base.

## Stage 6: Verify and hand over

1. Re-run `check_schema.py` and `list_automations`; confirm everything from Stages 2–3.
2. End-to-end test (the person does it): visit `<site>/submit`, sign in, connect Hackatime, submit. Then check with MCP: a `User` row with Auth Token, `Hackatime Projects` rows, the submission linked with copied fields, hours filled, and clean `list_automation_runs`. Empty Auth Token on the test submission = the Placeholder bug.
3. Write the handover doc from `assets/handover-template.md`, filled in with real names, IDs and URLs and no secret values. Save it as a Doc artifact if that type is available (otherwise a markdown file), so the event team can find it later. If the run stops early (waiting for approval, or the person doing their parts later), still write it, with the unfinished items under "Still to do", so nothing is lost between sessions.
4. Finish with a short checklist: done, and still to do with who owns each item (OAuth apps, secrets, Hackatime verification, turning automations on, publishing the form). Offer one next step.

When something goes wrong at any stage, check `references/troubleshooting.md` before improvising.
