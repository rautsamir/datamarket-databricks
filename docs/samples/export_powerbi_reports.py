#!/usr/bin/env python3
"""
List the Power BI reports you can see and write them to a CSV that DataMarket's
"Import from a file" accepts (Manage -> Add products).

    az login
    python3 export_powerbi_reports.py                  # writes powerbi-reports.csv
    python3 export_powerbi_reports.py -o reports.csv

It uses the standard Power BI REST API with your own sign-in, so it only sees
workspaces you are a member of (plus "My workspace"). No Power BI admin rights
and no service principal are needed. For a tenant-wide list, use the admin
scanner API instead (see docs/import_external_products.md).

Requires: Azure CLI (`az`) signed in with the same account you use for
app.powerbi.com, and Python 3.8+. No other packages.

Owner: the report list has no owner field, so this uses the dataset's
"configuredBy" (usually the person who published it). Check it before importing.
"""
import argparse
import csv
import json
import subprocess
import sys
import urllib.request

API = "https://api.powerbi.com/v1.0/myorg"
RESOURCE = "https://analysis.windows.net/powerbi/api"
COLUMNS = ["name", "description", "report_url", "owner_email", "source_type", "workspace"]


def get_token():
    out = subprocess.run(
        ["az", "account", "get-access-token", "--resource", RESOURCE, "--query", "accessToken", "-o", "tsv"],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        sys.exit("Could not get a Power BI token. Run `az login` with your Power BI account first.\n" + out.stderr.strip())
    return out.stdout.strip()


def get(token, path):
    req = urllib.request.Request(API + path, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp).get("value", [])


def flatten(workspace_name, reports, datasets):
    """One CSV row per report. Pure function: no network, easy to test."""
    owner_by_dataset = {d.get("id"): (d.get("configuredBy") or "") for d in datasets}
    rows = []
    for r in reports:
        rows.append({
            "name": r.get("name", ""),
            "description": r.get("description", "") or "",
            "report_url": r.get("webUrl", ""),
            "owner_email": owner_by_dataset.get(r.get("datasetId"), ""),
            "source_type": "Power BI",
            "workspace": workspace_name,
        })
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-o", "--output", default="powerbi-reports.csv")
    args = ap.parse_args()

    token = get_token()
    all_rows = []

    # "My workspace" has no group id, so it uses the un-grouped endpoints.
    all_rows += flatten("My workspace", get(token, "/reports"), get(token, "/datasets"))

    for g in get(token, "/groups"):
        try:
            all_rows += flatten(g.get("name", ""), get(token, f"/groups/{g['id']}/reports"),
                                get(token, f"/groups/{g['id']}/datasets"))
        except Exception as e:  # one unreadable workspace should not stop the export
            print(f"  skipped workspace {g.get('name')}: {e}", file=sys.stderr)

    with open(args.output, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(all_rows)
    print(f"Wrote {len(all_rows)} reports to {args.output}")


if __name__ == "__main__":
    main()
