# Import products from a file

Register many reports and dashboards at once: Power BI, Tableau, Looker, or anything that has a link. This is the quickest way to put non-Unity-Catalog content into the catalog, and it works for every tool because the file is the same no matter where it came from.

**Where:** Manage → **Add products** → **Import from a file** (stewards and admins only).

## How it works

1. **Download the template** and fill it in, or export from your tool (see below).
2. **Choose the file** (CSV or JSON). DataMarket checks every row and shows a preview. Nothing is written yet.
3. **Pick where new products land.** *Pending review* (recommended) puts them in Manage Approvals so a steward looks at them first. *Published* makes them live immediately.
4. **Import.** You get a summary of what was added, updated and skipped.

Importing the same file again is safe: products are matched on their link, so existing ones are updated instead of duplicated.

## The file

| Column | Required | Notes |
|---|---|---|
| `name` | yes | Up to 255 characters |
| `report_url` | yes | Full `http(s)` link. Identifies the product |
| `owner_email` | recommended | The person to ask for access. Must be an email address |
| `description` | recommended | What the report answers, in plain language. Ask AI reads this |
| `source_type` | no | Power BI, Tableau, Looker, … up to 20 characters. Guessed from the link if blank |
| `workspace` | no | Power BI workspace, Tableau project/site, etc. Added as a searchable tag |
| `domain` | no | Defaults to *Other*. Matched to existing domains ignoring case |
| `tags` | no | Separated by `;` |
| `classification` | no | Public, Internal, Confidential or Restricted. Defaults to Internal |
| `refresh_frequency` | no | Real-time, Hourly, Daily, Weekly, Monthly, Quarterly, Annual. Defaults to Daily |
| `upstream_table` | no | The Unity Catalog table behind the report, as `catalog.schema.table`. Shown as a searchable tag |

Column names from vendor exports are understood too, so you rarely need to rename anything: `webUrl`, `configuredBy`, `Report Name`, `Workspace Name`, and similar.

A JSON file works as well: an array of rows, or an object with a `value` array (the shape Power BI's REST API returns).

Up to 500 rows per file.

### What the checks do

- **Skipped, with a reason:** no name, no link, a link that isn't a full URL, an owner that isn't an email address, an unknown classification, the same link twice in one file.
- **Imported with a warning:** no owner, no description, an unrecognized refresh value (falls back to Daily).
- **Updates:** only fields the file actually filled in are changed. A blank classification column never resets an existing one. An existing product's status (Published, Archived, …) is never changed by an import.

### Access for imported products

Approving a request for an imported product is **recorded in DataMarket**, but DataMarket does not grant access in Power BI or Tableau. The owner grants access in that tool. This is why `upstream_table` is only a tag: it is never used as a table to `GRANT` on.

## Getting a file out of your tool

### Power BI, as yourself (no admin needed)

`samples/export_powerbi_reports.py` lists the reports in the workspaces you belong to and writes a file that "Import from a file" accepts.

```bash
az login                       # the account you use for app.powerbi.com
python3 docs/samples/export_powerbi_reports.py -o powerbi-reports.csv
```

It sees only workspaces you are a member of. The owner column is the dataset's `configuredBy`, which is usually the publisher, so check it. Review the file before importing: it can include personal or experimental reports you may not want in the catalog.

PowerShell equivalent, for machines without Python (needs the `MicrosoftPowerBIMgmt` module):

```powershell
Connect-PowerBIServiceAccount
Get-PowerBIWorkspace | ForEach-Object {
  $ws = $_
  Get-PowerBIReport -WorkspaceId $ws.Id |
    Select-Object @{n='name';e={$_.Name}}, @{n='report_url';e={$_.WebUrl}}, @{n='workspace';e={$ws.Name}}
} | Export-Csv powerbi-reports.csv -NoTypeInformation
```

### Power BI, whole tenant

Needs a Fabric administrator to enable the admin "scanner" APIs for a service principal. It returns owners, sensitivity labels and upstream data sources for every workspace. A scheduled job that writes the same columns into this importer is the natural next step; the file format here is chosen so that job can feed the same code.

### Tableau

Use the REST API with a personal access token to list workbooks and views, or the Metadata API (GraphQL) for owners and upstream tables. Put each view's link in `report_url`. Tableau Cloud keeps the view path after a `#`; DataMarket handles that when matching.

### Anything else

Most tools can export a list of reports to CSV or Excel. Save it as CSV, make sure it has a name and a link for each row, and import it.

## Sample file

`samples/external-products-sample.csv` is a synthetic file of 20 rows: 15 that import cleanly (Power BI, Tableau, Looker and a generic link) and 5 that are skipped on purpose, one for each kind of problem. Use it to try the import without touching real content.

## For deployers

- The import endpoint is `POST /api/portal/admin/import-external` and is admin-only. Send `dryRun: true` to preview.
- Imported products set `product_url` (the link), `source_type`, `source_system` and `type`. They need no new columns.
- The request body limit is 2 MB.
