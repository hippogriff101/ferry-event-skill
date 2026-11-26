// Ferry: fill Submitted Hackatime Projects / Hours from the submitter's own Hackatime token.
// Hours are the overlap-merged wall-clock total (heartbeat spans), not a sum of per-project totals,
// so time logged to two projects at once is only counted once.
// Reads live Hackatime data each run, so it is safe to run again after a submission is edited.
// Trigger: "When a record matches conditions" in YSWS Project Submission: the User link is not empty
// AND the Hackatime Projects link is not empty. (Optional second copy for edits: "When a record is updated",
// watching the Hackatime Projects link field.)
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
const errorField = byName(SUBS, 'Automation - Error');
const outProjects = byName(SUBS, 'Submitted Hackatime Projects');
const outHours = byName(SUBS, 'Submitted Hackatime Hours');
// Optional Unified YSWS fields: filled only if they exist and are still empty.
const justNames = byName(SUBS, 'Justification - Hackatime Project Name(s) + Date Range(s)');
const justId = byName(SUBS, 'Justification - Submitter Hackatime ID');
const overrideHours = byName(SUBS, 'Optional - Override Hours Spent');

async function fail(message) {
  if (errorField) await SUBS.updateRecordAsync(recordId, { [errorField.id]: 'Hackatime hours: ' + message });
  else throw new Error(message);
}

async function startDate() {
  let t;
  try { t = base.getTable('YSWS Config'); } catch (e) { return ''; }
  const key = byName(t, 'Key');
  const value = byName(t, 'Value');
  if (!key || !value) return '';
  const q = await t.selectRecordsAsync({ fields: [key, value] });
  const row = q.records.find((r) => r.getCellValueAsString(key).trim() === 'Start Date');
  return row ? row.getCellValueAsString(value).trim() : '';
}

async function main() {
  if (!subUser || !subProjects) return fail('submission table needs link fields to User and Hackatime Projects.');
  const rec = await SUBS.selectRecordAsync(recordId);
  if (!rec) return fail('submission not found.');
  const userLink = rec.getCellValue(subUser) || [];
  if (userLink.length === 0) return fail('no linked User yet.');
  const user = await USERS.selectRecordAsync(userLink[0].id);
  const token = (user.getCellValueAsString('Hackatime Token') || '').trim();
  if (!token) return fail('linked User has no Hackatime Token.');
  const names = (rec.getCellValue(subProjects) || []).map((p) => p.name).filter(Boolean);
  if (names.length === 0) return fail('no Hackatime projects picked.');

  const start = await startDate();
  const qs = (o) =>
    Object.entries(o)
      .filter(([, v]) => v)
      .map(([k, v]) => k + '=' + encodeURIComponent(v))
      .join('&');
  const get = async (path, params) => {
    const res = await fetch('https://hackatime.hackclub.com/api/v1/users/my/' + path + '?' + qs(params), {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) throw new Error(path + ' returned ' + res.status + ': ' + (await res.text()).slice(0, 200));
    return res.json();
  };
  const filter = { filter_by_project: names.join(','), start_date: start };

  const stats = await get('stats', { ...filter, features: 'projects' });
  const per = ((stats.data && stats.data.projects) || []).filter((p) => names.includes(p.name));
  const projectsText = per.map((p) => p.name + ' (' + (p.total_seconds / 3600).toFixed(1) + 'h)').join(', ');

  const spans = ((await get('heartbeats/spans', filter)).spans || [])
    .map((s) => [Number(s.start_time), Number(s.end_time)])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let total = 0;
  let curStart = null;
  let curEnd = null;
  for (const [a, b] of spans) {
    if (curEnd === null || a > curEnd) {
      if (curEnd !== null) total += curEnd - curStart;
      curStart = a;
      curEnd = b;
    } else if (b > curEnd) {
      curEnd = b;
    }
  }
  if (curEnd !== null) total += curEnd - curStart;
  const hours = Math.round((total / 3600) * 100) / 100;

  const fields = {};
  if (outProjects) fields[outProjects.id] = projectsText;
  if (outHours) fields[outHours.id] = hours;
  if (justNames && !rec.getCellValueAsString(justNames)) fields[justNames.id] = names.join(', ');
  if (justId && !rec.getCellValueAsString(justId)) fields[justId.id] = user.getCellValueAsString('Hackatime User ID');
  if (overrideHours && rec.getCellValue(overrideHours) === null) fields[overrideHours.id] = hours;
  // Safe to re-run (e.g. the optional resync-on-edit automation): clear an old hours error once it works.
  if (errorField && rec.getCellValueAsString(errorField).startsWith('Hackatime hours:')) fields[errorField.id] = '';
  await SUBS.updateRecordAsync(recordId, fields);
  output.set('hours', hours);
}

try {
  await main();
} catch (e) {
  await fail(String((e && e.message) || e));
}
