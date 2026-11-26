// Ferry: link a new submission to its User row and copy identity fields onto it.
// Trigger: "When a record is created" in YSWS Project Submission.
// Input variable: recordId = the trigger record's Airtable record ID.
const { recordId } = input.config();
const SUBS = base.getTable('YSWS Project Submission');
const USERS = base.getTable('User');
const PROJECTS = base.getTable('Hackatime Projects');

const byName = (table, name) => table.fields.find((f) => f.name === name) || null;
const linkTo = (table, target) =>
  table.fields.find(
    (f) => f.type === 'multipleRecordLinks' && f.options && f.options.linkedTableId === target.id,
  ) || null;

const subUser = linkTo(SUBS, USERS);
const subProjects = linkTo(SUBS, PROJECTS);
const projUser = linkTo(PROJECTS, USERS);
const subToken = byName(SUBS, 'Auth Token');
const userToken = byName(USERS, 'Auth Token');
const userEmail = byName(USERS, 'Email');
const errorField = byName(SUBS, 'Automation - Error');
if (!subUser) throw new Error('YSWS Project Submission has no link field to the User table.');

const TEXT_TYPES = ['singleLineText', 'multilineText', 'email', 'url', 'phoneNumber'];
const COPY = [
  'First Name', 'Last Name', 'Email', 'Birthday', 'Address (Line 1)', 'Address (Line 2)',
  'City', 'State / Province', 'ZIP / Postal Code', 'Country',
]
  .map((n) => [byName(SUBS, n), byName(USERS, n)])
  .filter(([s, u]) => s && u && !s.isComputed);

// Airtable's automation runtime has no setTimeout, so wait by re-reading the record
// (each read is a real round trip). Capped at a few reads, because scripts have a
// limit on how many queries one run may make.
async function pause(ms) {
  const until = Date.now() + ms;
  for (let n = 0; n < 4 && Date.now() < until; n++) await SUBS.selectRecordAsync(recordId, { fields: [] });
}

async function findUserId(rec) {
  const linked = rec.getCellValue(subUser) || [];
  if (linked.length === 1) return linked[0].id; // Fillout's User prefetch already linked it
  const token = subToken ? (rec.getCellValueAsString(subToken) || '').trim() : '';
  if (token && userToken) {
    const q = await USERS.selectRecordsAsync({ fields: [userToken] });
    const m = q.records.find((r) => (r.getCellValueAsString(userToken) || '').trim() === token);
    if (m) return m.id;
  }
  if (subProjects && projUser) {
    const ids = new Set();
    for (const l of rec.getCellValue(subProjects) || []) {
      const p = await PROJECTS.selectRecordAsync(l.id, { fields: [projUser] });
      for (const u of (p && p.getCellValue(projUser)) || []) ids.add(u.id);
    }
    if (ids.size === 1) return [...ids][0];
  }
  return null;
}

async function writeError(id, message) {
  if (errorField) await SUBS.updateRecordAsync(id, { [errorField.id]: message });
  else throw new Error(message);
}

let rec = null;
let userId = null;
for (let i = 0; i < 3 && !userId; i++) {
  rec = await SUBS.selectRecordAsync(recordId);
  if (!rec) throw new Error('Submission not found: ' + recordId);
  userId = await findUserId(rec);
  if (!userId && i < 2) await pause(2000); // Fillout may still be writing links
}

if (!userId) {
  await writeError(
    rec.id,
    'Ferry: could not identify the User (no User link, no matching Auth Token, and no single owner of the picked Hackatime projects). Check the Fillout Auth Token hidden field.',
  );
} else {
  const user = await USERS.selectRecordAsync(userId);
  const fields = { [subUser.id]: [{ id: userId }] };
  for (const [s, u] of COPY) {
    let v = TEXT_TYPES.includes(s.type) ? user.getCellValueAsString(u) : user.getCellValue(u);
    if (v && typeof v === 'object' && !Array.isArray(v) && v.name) v = { name: v.name };
    if (v !== null && v !== undefined && v !== '') fields[s.id] = v;
  }
  await SUBS.updateRecordAsync(rec.id, fields);

  const email = userEmail ? (user.getCellValueAsString(userEmail) || '').trim().toLowerCase() : '';
  if (email) {
    const all = await USERS.selectRecordsAsync({ fields: [userEmail] });
    const same = all.records.filter(
      (r) => (r.getCellValueAsString(userEmail) || '').trim().toLowerCase() === email,
    );
    if (same.length > 1) {
      await writeError(rec.id, 'Ferry duplicate check: another User row shares this email. Review before approving.');
    }
  }
  console.log('Linked submission ' + rec.id + ' to User ' + userId);
}
