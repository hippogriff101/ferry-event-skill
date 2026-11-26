// Ferry schema setup, for Airtable's Scripting extension.
// Paste this whole file into Extensions → Scripting in the event's base and press Run.
// It shows what it will add, then asks before changing anything. It only ADDS missing
// tables and fields (and renames an auto-named inverse link to "Hackatime Projects");
// it never deletes or retypes anything. No token or install needed.
// Generated from the ferry-event skill's assets/ferry-schema.json — don't edit by hand.

const SCHEMA = __FERRY_SCHEMA__;

const useHackatime = (await input.buttonsAsync('Does this event use Hackatime?', ['Yes', 'No'])) === 'Yes';
const wanted = (t) =>
  [{ ...t.primary }, ...t.fields].filter((f) => !f.optional && (useHackatime || !f.hackatimeOnly));
const CANT_CREATE = ['multipleLookupValues', 'formula', 'rollup', 'count'];
const tableByName = (n) => base.tables.find((t) => t.name === n) || null;
const linksTo = (table, targetName) => {
  const target = tableByName(targetName);
  return target
    ? table.fields.filter((f) => f.type === 'multipleRecordLinks' && f.options && f.options.linkedTableId === target.id)
    : [];
};
const optionsFor = (f) => {
  if (f.type === 'number') return { precision: (f.options && f.options.precision) || 0 };
  if (f.type === 'date') return { dateFormat: { name: 'iso' } };
  if (f.type === 'duration') return { durationFormat: 'h:mm' };
  if (f.type === 'multipleAttachments') return { isReversed: false };
  if (f.type === 'multipleRecordLinks') return { linkedTableId: tableByName(f.linksTo).id };
  return undefined;
};

// 1. Plan
const plan = [];
const manual = [];
const typeWarnings = [];
for (const t of SCHEMA.tables) {
  const table = tableByName(t.name);
  if (!table) plan.push(`Create table **${t.name}** with: ${wanted(t).map((f) => f.name).join(', ')}`);
  for (const f of wanted(t)) {
    if (CANT_CREATE.includes(f.type)) { manual.push(`${t.name}: add lookup "${f.name}" (${f.lookup.via} → ${f.lookup.field})`); continue; }
    if (!table) continue;
    const have = table.fields.find((x) => x.name === f.name);
    if (f.type === 'multipleRecordLinks') {
      const links = linksTo(table, f.linksTo);
      if (have && have.type === 'multipleRecordLinks') continue;
      if (links.length && f.matchByLink) continue;
      if (links.length) { plan.push(`Rename **${t.name}.${links[0].name}** → ${f.name}`); continue; }
    }
    if (!have) plan.push(`Add **${t.name}.${f.name}** (${f.type})`);
    else if (have.type !== f.type && !(f.alsoOk || []).includes(have.type))
      typeWarnings.push(`${t.name}.${f.name} is ${have.type}; Ferry expects ${f.type}. Not changed.`);
  }
  for (const v of t.views || []) manual.push(`${t.name}: add a ${v.type} view named "${v.name}"`);
}
manual.push('YSWS Config: add a row Key = "Start Date", Value = the event start date (YYYY-MM-DD)');
manual.push('Create the Ferry automations (the skill gives you the scripts and triggers)');

output.markdown(`# Ferry schema setup (Ferry ${SCHEMA.ferryVersion})`);
output.markdown(plan.length ? '## Will change\n' + plan.map((p) => '- ' + p).join('\n') : '## Nothing to add. The schema already matches Ferry.');
if (typeWarnings.length) output.markdown('## Wrong types (left alone; ask before changing)\n' + typeWarnings.map((p) => '- ' + p).join('\n'));

// 2. Apply, after a yes
if (plan.length && (await input.buttonsAsync('Make these changes?', ['Yes, make them', 'No'])) === 'Yes, make them') {
  const failed = [];
  const tryDo = async (label, fn) => { try { await fn(); output.text('✓ ' + label); } catch (e) { failed.push(label + ': ' + e.message); } };
  for (const t of SCHEMA.tables) {
    if (!tableByName(t.name)) await tryDo('table ' + t.name, () => base.createTableAsync(t.name, [{ name: t.primary.name, type: t.primary.type, options: optionsFor(t.primary) }]));
  }
  // Hackatime Projects first, so the User inverse link exists before User is checked.
  const order = [...SCHEMA.tables].sort((a, b) => (a.name === 'Hackatime Projects' ? -1 : b.name === 'Hackatime Projects' ? 1 : 0));
  for (const t of order) {
    const table = tableByName(t.name);
    if (!table) continue;
    for (const f of wanted(t)) {
      if (CANT_CREATE.includes(f.type)) continue;
      const fresh = tableByName(t.name);
      if (fresh.fields.some((x) => x.name === f.name)) continue;
      if (f.type === 'multipleRecordLinks') {
        const links = linksTo(fresh, f.linksTo);
        if (links.length && f.matchByLink) continue;
        if (links.length) { await tryDo(`rename ${t.name}.${links[0].name} → ${f.name}`, () => links[0].updateNameAsync(f.name)); continue; }
      }
      await tryDo(`${t.name}.${f.name}`, () => fresh.createFieldAsync(f.name, f.type, optionsFor(f), f.description));
    }
  }
  if (failed.length) output.markdown('## Could not create (do these by hand)\n' + failed.map((p) => '- ' + p).join('\n'));
}
output.markdown('## Still to do by hand\n' + manual.map((p) => '- ' + p).join('\n'));
