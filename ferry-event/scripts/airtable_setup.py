#!/usr/bin/env python3
"""Create Ferry's tables and fields in an Airtable base with the Web API.

For organisers who don't have the Airtable MCP connector. They run this on
their own computer (Claude's sandbox usually can't reach api.airtable.com).

  export AIRTABLE_TOKEN=pat...     # scopes: schema.bases:read, schema.bases:write; this base only
  python3 airtable_setup.py appXXXXXXXXXXXXXX              # preview only (default)
  python3 airtable_setup.py appXXXXXXXXXXXXXX --apply      # make the changes
  python3 airtable_setup.py appXXXXXXXXXXXXXX --hackatime off

It only ADDS missing tables and fields and renames an auto-named inverse link
to 'Hackatime Projects'. It never deletes or retypes anything. Views, lookup
fields and automations can't be made through the Web API; it prints those as
manual steps. The token is read from the environment and never printed.
Standard library only (Python 3.8+).
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from check_schema import SPEC_PATH, check, to_markdown  # noqa: E402

API = "https://api.airtable.com/v0/meta/bases/"
FIELD_TYPES_API_CANT_CREATE = {"multipleLookupValues", "formula", "rollup", "count"}


def call(token, method, path, body=None):
    req = urllib.request.Request(API + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": "Bearer " + token,
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise SystemExit(f"Airtable {method} {path} failed ({e.code}): {e.read().decode()[:300]}")


def field_body(fs, table_ids):
    body = {"name": fs["name"], "type": fs["type"]}
    if fs["type"] == "multipleRecordLinks":
        body["options"] = {"linkedTableId": table_ids[fs["linksTo"]]}
    elif fs["type"] in ("number", "duration", "date"):
        body["options"] = fs.get("options") or ({"precision": 0} if fs["type"] == "number" else {})
        if fs["type"] == "date":
            body["options"] = {"dateFormat": {"name": "iso"}}
    if fs.get("description"):
        body["description"] = fs["description"]
    return body


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base_id")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--hackatime", choices=["on", "off"], default="on")
    a = ap.parse_args()
    token = os.environ.get("AIRTABLE_TOKEN", "").strip()
    if not token:
        raise SystemExit("Set AIRTABLE_TOKEN first (a personal access token with schema.bases:read/write on this base).")
    hackatime = a.hackatime == "on"
    with open(SPEC_PATH) as f:
        spec = json.load(f)

    tables = call(token, "GET", a.base_id + "/tables")["tables"]
    print("Plan for " + a.base_id + ":\n" + to_markdown(check(tables, spec, hackatime)) + "\n")
    if not a.apply:
        print("Preview only. Re-run with --apply to make these changes.")
        return

    have = {t["name"]: t for t in tables}
    ids = {t["name"]: t["id"] for t in tables}
    manual = []
    # 1. Tables, created with their primary field only (links need both tables to exist).
    for ts in spec["tables"]:
        if ts["name"] not in have:
            t = call(token, "POST", a.base_id + "/tables",
                     {"name": ts["name"], "fields": [{"name": ts["primary"]["name"], "type": ts["primary"]["type"]}]})
            ids[ts["name"]] = t["id"]
            have[ts["name"]] = t
            print("created table " + ts["name"])
    # 2. Fields. Hackatime Projects first so the User inverse link appears before we check for it.
    order = sorted(spec["tables"], key=lambda t: t["name"] != "Hackatime Projects")
    for ts in order:
        tid = ids[ts["name"]]
        current = call(token, "GET", a.base_id + "/tables")["tables"]
        fields = next(t for t in current if t["id"] == tid)["fields"]
        names = {f["name"] for f in fields}
        for fs in ts["fields"]:
            if fs["name"] in names or (fs.get("hackatimeOnly") and not hackatime) or fs.get("optional"):
                continue
            if fs["type"] == "multipleRecordLinks":
                links = [f for f in fields if f["type"] == "multipleRecordLinks"
                         and f.get("options", {}).get("linkedTableId") == ids[fs["linksTo"]]]
                if links and fs.get("matchByLink"):
                    continue
                if links:  # auto-created inverse with a different name
                    call(token, "PATCH", f"{a.base_id}/tables/{tid}/fields/{links[0]['id']}", {"name": fs["name"]})
                    print(f"renamed {ts['name']}.{links[0]['name']} → {fs['name']}")
                    continue
            if fs["type"] in FIELD_TYPES_API_CANT_CREATE:
                manual.append(f"{ts['name']}: add lookup '{fs['name']}' (via {fs['lookup']['via']} → {fs['lookup']['field']})")
                continue
            call(token, "POST", f"{a.base_id}/tables/{tid}/fields", field_body(fs, ids))
            print(f"created {ts['name']}.{fs['name']}")
    for ts in spec["tables"]:
        for v in ts.get("views", []):
            manual.append(f"{ts['name']}: add a {v['type']} view named '{v['name']}'")
    manual.append("YSWS Config: add a row Key = 'Start Date', Value = the event start date (YYYY-MM-DD)")
    manual.append("Create the two Ferry automations by hand with the script files Claude gave you (triggers are in each script's header)")
    print("\nStill to do in the Airtable UI:\n" + "\n".join("- " + m for m in manual))


if __name__ == "__main__":
    main()
