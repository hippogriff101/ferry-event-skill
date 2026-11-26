# Troubleshooting

Symptoms seen on real Hack Club events, with the usual cause.

| Symptom | Likely cause | Fix |
|---|---|---|
| Everyone's submission has an empty Auth Token; nothing links; project picker is empty | Fillout hidden field set via **Placeholder** instead of **Default value** | Set Default value to the `auth_token` URL parameter; fix past rows by matching on Hackatime projects |
| Sign-in fails for every Ferry event at once | Hack Club Auth itself is down | Check another event's `/submit` before debugging yours; wait, or ask in Hack Club's Slack |
| `redirect_uri` mismatch after sign-in | OAuth app redirect doesn't equal `<origin><basePath>/hca` (or `/hackatime`) exactly; `/submit` vs `/api/submit` is the classic | Fix the URI in the app, or `basePath` in code |
| Hackatime step works for you, fails for others | Hackatime OAuth app not **Verified** | Press Verify, or ask a Hackatime superadmin |
| Ferry error page "Airtable … 422 UNKNOWN_FIELD_NAME" | A field Ferry writes is missing or misspelt, or the inverse link is named `Hackatime Projects 2` | Run `check_schema.py`; rename or add the field |
| Ferry error page listing `FERRY_*` names | Env vars missing in production (often set for Preview but not Production on Vercel) | Add them in Vercel, redeploy |
| Everyone suddenly signed out | `FERRY_SECRET` changed | Expected; keep it stable |
| Link automation fails with "setTimeout is not defined" | V1 script | Replace with the current `link-submission-to-user.js` |
| `Automation - Error`: "could not identify the User" | Form opened directly (not via `/submit`), or Auth Token empty | Point Submit buttons at `/submit`; check the hidden field |
| `Automation - Error`: "another User row shares this email" | Same person signed in with two Slack accounts, or a shared email | Review before approving; it's a warning, not a failure |
| Hours 0 or missing projects | Time logged before the Start Date, or projects renamed in Hackatime since syncing | Check `YSWS Config` Start Date; have them revisit `/submit` to re-sync |
| Hours higher than expected in review | Someone summed per-project totals elsewhere | Use `Submitted Hackatime Hours` (overlap-merged) |
| Hours stale after an edit | Edit link skips Ferry; the hours automation fires once | Opt-in `Ferry: Resync Hours on Edit` |
| Submissions land in last event's base | Duplicated Fillout form kept its old Airtable connection | Reconnect to this event's base |
| Vercel 404 on `/submit` but `/api/submit/start` works | Redirect missing in `vercel.json` | Add both redirects from INSTALL.md |
| Automation change "didn't work" | Script edited but **Update** not pressed | Press Update in the automation editor |

Still stuck? Read Ferry's `DESIGN.md` (routes, state machine, Airtable mapping) rather than guessing, and check the repo's issues.
