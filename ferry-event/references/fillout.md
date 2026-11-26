# Fillout form

The form has three jobs: carry `auth_token` from Ferry's redirect, write the submission to `YSWS Project Submission`, and link it to the User.

## Steps (same in browser or instructions mode)

1. Start from the form they gave, a copy of an older event's form (Fillout → ⋯ → Duplicate), or a new form. Update the title and cover text to the event.
2. **Integrate → Airtable**: connect a new account named `YSWS - <Event>` with custom access to this base only → table `YSWS Project Submission` → **Create record**. A duplicated form keeps the old base's connection: switch it, or it writes into last event's base.
3. **Pre-fetch records → Add new**, name `User`: table `User`, filter `Auth Token` equals the `auth_token` URL parameter, limited to the `Fillout (DON'T TOUCH)` view.
4. Hidden field **Auth Token**: set its **Default value** to the `auth_token` URL parameter. Not the Placeholder: a placeholder is never saved, so the field stays empty and every link and filter breaks. This is the most common Ferry bug. Map it to `Auth Token`.
5. Hackatime project picker: record picker on `Hackatime Projects`, filtered where `Auth Token (from User)` equals the form's Auth Token field (Fillout may offer "contains" instead for a lookup; either works) (people see only their own projects), placed after the Auth Token field, mapped to the Hackatime Projects link. Remove it if Hackatime is off.
6. Mappings: Project Name, Code URL, Playable URL, Description, Screenshot, Hackatime Projects, the three feedback questions, Auth Token. Save, reopen the connection, add **User → Record ID** (under Prefetches › User) mapped to the `User` link field.
7. Publish; optionally a custom link like `forms.hackclub.com/<event>-submit`. That URL is `FERRY_FILLOUT_FORM_URL`.

## Browser mode

Use the person's preferred browser and load its skill (`built-in-browser` or `chrome-browser`) first. They sign in to Fillout and approve the Airtable account connection themselves; never type passwords or tokens. Ask before each step that changes something live: connecting an account, granting access, saving the integration, publishing. If a step fails or the UI looks different, stop and switch that step to written instructions. Create the `Fillout (DON'T TOUCH)` view in Airtable here too, if it's missing.

## Instructions mode

The steps above with their real base, table and form names filled in.

## Edits and resubmissions

Fillout's update-mode edit links skip Ferry, so a person editing doesn't re-sync Hackatime, and the edit URL isn't protected by Ferry sign-in. If the event lets people edit, offer the opt-in `Ferry: Resync Hours on Edit` automation (references/automations.md) and tell them edit links should only go to the submitter.
