# ferry-event: a Claude skill for setting up Ferry

A Claude skill for Hack Club event organisers. It sets up [Ferry](https://github.com/jeremy46231/ferry), the Hack Club Auth + Hackatime submission flow, for a YSWS event, and can copy or check an existing setup.

It runs in three modes:

- **New event:** creates the Airtable tables, fields and Ferry automations, adds `/submit` to your site, and sets up the Fillout form, either in your browser or as written steps.
- **New edition of an old event:** copies the Ferry parts of your previous event's base into a new one, and plans when the site switches over.
- **Check / fix:** finds why submissions aren't linking or hours are blank. It reads first and changes nothing without asking.

It always shows what it will change and waits for a yes. It only adds things, never deletes, and secrets never pass through the chat. It covers Ferry only: no review, approval, email, Slack or fraud-check flows.

## Install

- **claude.ai:** save the skill from the card you were sent, or upload this `ferry-event` folder as a skill. If only `SKILL.md` is installed, the skill fetches its scripts and reference pages from this repo.
- **Claude Code:** `git clone https://github.com/hippogriff101/ferry-event-skill && cp -r ferry-event-skill/ferry-event ~/.claude/skills/`

Then say "set up Ferry for my event" or run `/ferry-event`.

## You don't need

- An Airtable connector. Without one, the skill gives you `scripts/airtable-extension-setup.js` to paste into Airtable's Scripting extension.
- Access to any other event's base. New-event mode builds everything from scratch.

## What's inside

| Path | What it is |
|---|---|
| `ferry-event/SKILL.md` | The skill |
| `ferry-event/references/` | Schema, automations, website, Fillout, doctor mode, troubleshooting |
| `ferry-event/scripts/` | The two Airtable automation scripts, a schema checker, and setup scripts for organisers without the connector |
| `ferry-event/assets/` | `ferry-schema.json` (the single source of truth for field names) and the handover-doc template |
| `ferry-event/evals/` | Test cases with made-up data, runnable with `claude plugin eval` |

## Maintaining it

- **Schema changes:** edit `assets/ferry-schema.json`, then run `python3 scripts/build_extension_script.py` to regenerate the extension script.
- **Ferry versions:** the skill checks Ferry's version each time it runs and follows Ferry's own docs if they've changed. The version it was written against is in `assets/ferry-schema.json` (currently 0.4.0).

Made for Hack Club event organisers. Issues and PRs welcome.
