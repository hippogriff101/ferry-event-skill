#!/usr/bin/env python3
"""Compare an Airtable base's schema with what Ferry needs, and print a plan.

Usage:
  python3 check_schema.py BASE_SCHEMA.json [--hackatime off] [--json]

BASE_SCHEMA.json is the base's table list saved from the Airtable MCP
(list_tables_for_base / get_table_schema) or from the Web API
(GET /v0/meta/bases/{baseId}/tables). Accepted shapes: {"tables": [...]},
a bare list of tables, or {"result": {"tables": [...]}}. Each table needs
"name" and "fields" (each field: name, type, optional id/options). Table IDs
let link fields be checked properly; without them, links are checked by type.

Read-only: it never talks to Airtable. Exit code 0 = nothing missing,
1 = changes needed, 2 = bad input.
"""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC_PATH = os.path.join(HERE, "..", "assets", "ferry-schema.json")


def load_tables(path):
    with open(path) as f:
        data = json.load(f)
    for key in ("result", "data", "base"):
        if isinstance(data, dict) and key in data and isinstance(data[key], (dict, list)):
            data = data[key]
    tables = data.get("tables") if isinstance(data, dict) else data
    if not isinstance(tables, list):
        raise ValueError("could not find a list of tables in " + path)
    return tables


def check(tables, spec, hackatime=True):
    by_name = {t.get("name"): t for t in tables}
    id_to_name = {t.get("id"): t.get("name") for t in tables if t.get("id")}
    report = {"missing_tables": [], "missing_fields": [], "wrong_types": [],
              "link_problems": [], "manual": [], "ok": 0, "extra_note": []}

    for ts in spec["tables"]:
        table = by_name.get(ts["name"])
        if table is None:
            wanted = [f for f in [ts["primary"]] + ts["fields"]
                      if not f.get("optional") and (hackatime or not f.get("hackatimeOnly"))]
            desc = ", ".join(
                f"{f['name']} ({f['type']}{' → ' + f['linksTo'] if f.get('linksTo') else ''})" for f in wanted)
            report["missing_tables"].append(f"{ts['name']}: {desc}")
            for vs in ts.get("views", []):
                report["manual"].append(f"{ts['name']} view '{vs['name']}' ({vs['type']}; create in the Airtable UI)")
            for f in wanted:
                if f["type"] == "multipleLookupValues":
                    report["manual"].append(f"{ts['name']}.{f['name']} (lookup; add by hand if the connector can't)")
            continue
        fields = table.get("fields", [])
        fnames = {f.get("name"): f for f in fields}
        primary_id = table.get("primaryFieldId")
        if primary_id:
            prim = next((f for f in fields if f.get("id") == primary_id), None)
            if prim and prim.get("name") != ts["primary"]["name"]:
                report["wrong_types"].append(
                    f"{ts['name']}: primary field is '{prim.get('name')}', Ferry expects '{ts['primary']['name']}'")
        for fs in [dict(ts["primary"], who="ferry")] + ts["fields"]:
            if fs.get("hackatimeOnly") and not hackatime:
                continue
            want = fs["type"]
            have = fnames.get(fs["name"])
            if want == "multipleRecordLinks":
                target = fs["linksTo"]
                links = [f for f in fields if f.get("type") == "multipleRecordLinks"]
                if id_to_name:
                    links = [f for f in links
                             if id_to_name.get((f.get("options") or {}).get("linkedTableId")) == target]
                exact = have if have and have.get("type") == "multipleRecordLinks" else None
                if exact:
                    report["ok"] += 1
                elif fs.get("matchByLink") and links:
                    report["ok"] += 1
                    report["extra_note"].append(
                        f"{ts['name']}: using existing link '{links[0].get('name')}' → {target} for '{fs['name']}'")
                elif links:
                    names = ", ".join(f"'{f.get('name')}'" for f in links)
                    report["link_problems"].append(
                        f"{ts['name']}: link to {target} exists as {names}; rename it to '{fs['name']}' (Ferry writes by name)")
                elif have:
                    report["wrong_types"].append(
                        f"{ts['name']}.{fs['name']}: is {have.get('type')}, should link to {target}")
                else:
                    (report["manual"] if fs.get("optional") else report["missing_fields"]).append(
                        f"{ts['name']}.{fs['name']} (link → {target})")
                continue
            if have is None:
                if fs.get("optional"):
                    continue
                entry = f"{ts['name']}.{fs['name']} ({want})"
                (report["manual"] if want == "multipleLookupValues" else report["missing_fields"]).append(entry)
                continue
            ok_types = {want, *fs.get("alsoOk", [])}
            if fs.get("optional") or have.get("type") in ok_types:
                report["ok"] += 1
            else:
                report["wrong_types"].append(
                    f"{ts['name']}.{fs['name']}: is {have.get('type')}, Ferry expects {want} (report it; don't change it without asking)")
        for vs in ts.get("views", []):
            views = table.get("views")
            if views is None:
                report["manual"].append(f"{ts['name']} view '{vs['name']}' (couldn't see views; check by hand)")
            elif vs["name"] not in {v.get("name") for v in views}:
                report["manual"].append(f"{ts['name']} view '{vs['name']}' ({vs['type']}; create in the Airtable UI)")
    return report


def to_markdown(r):
    lines = []
    def section(title, items):
        if items:
            lines.append(f"### {title} ({len(items)})")
            lines.extend(f"- {i}" for i in items)
            lines.append("")
    section("Tables to create (with their fields)", r["missing_tables"])
    section("Fields to create", r["missing_fields"])
    section("Links to fix", r["link_problems"])
    section("Wrong types (report, don't auto-change)", r["wrong_types"])
    section("Manual steps", r["manual"])
    section("Notes", r["extra_note"])
    if not any(r[k] for k in ("missing_tables", "missing_fields", "link_problems", "wrong_types", "manual")):
        lines.append("Schema matches Ferry. Nothing to change.")
    lines.append(f"({r['ok']} fields already correct.)")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("schema")
    ap.add_argument("--hackatime", choices=["on", "off"], default="on")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--spec", default=SPEC_PATH)
    a = ap.parse_args()
    try:
        tables = load_tables(a.schema)
        with open(a.spec) as f:
            spec = json.load(f)
    except (OSError, ValueError) as e:
        print("error: " + str(e), file=sys.stderr)
        sys.exit(2)
    r = check(tables, spec, hackatime=a.hackatime == "on")
    print(json.dumps(r, indent=2) if a.json else to_markdown(r))
    needs = any(r[k] for k in ("missing_tables", "missing_fields", "link_problems", "wrong_types"))
    sys.exit(1 if needs else 0)


if __name__ == "__main__":
    main()
