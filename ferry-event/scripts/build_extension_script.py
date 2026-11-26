#!/usr/bin/env python3
"""Regenerate airtable-extension-setup.js from assets/ferry-schema.json.

Run after changing the schema: python3 scripts/build_extension_script.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
spec = json.load(open(os.path.join(HERE, "..", "assets", "ferry-schema.json")))
slim = {"ferryVersion": spec["ferryVersion"], "tables": spec["tables"]}
tpl = open(os.path.join(HERE, "airtable-extension-setup.template.js")).read()
out = tpl.replace("__FERRY_SCHEMA__", json.dumps(slim, indent=1))
open(os.path.join(HERE, "airtable-extension-setup.js"), "w").write(out)
print("wrote airtable-extension-setup.js")
