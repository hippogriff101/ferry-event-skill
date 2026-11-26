# Ferry setup: <Event>

*Set up <date> with the ferry-event skill (Ferry <version>).*

## How submitting works
<site>/submit → Hack Club Auth sign-in → Hackatime connect → Fillout form → `YSWS Project Submission` row → Ferry automations link the User and fill in hours.

## Where things are
| Thing | Where |
|---|---|
| Site / submit page | <site>/submit |
| Code | <repo + path to the Ferry mount> |
| Airtable base | <base name> (<base ID>) |
| Fillout form | <form URL> |
| Hack Club Auth app | <app name> |
| Hackatime app | <app name>, verified: <yes/no> |
| Automations | Ferry: Link Submission to User · Ferry: Submitted Hackatime Hours · <resync, if on> (all <on/off>) |
| Event start date | <YYYY-MM-DD> (YSWS Config → Start Date) |

## Environment variables (names only, never values)
Set in <host>: <list>. Secrets are stored only in <host>.

## Still to do
- [ ] <each remaining step, with who owns it>

## If something breaks
Most common: the Fillout Auth Token hidden field must use **Default value**, not Placeholder. Then check the automations are on, then `<site>/submit` redirects to Hack Club Auth. Run the ferry-event skill in doctor mode for a full check.
