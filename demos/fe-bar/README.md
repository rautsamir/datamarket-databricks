# SharePoint policy documents → DataMarket

A reference build that puts DataMarket on top of a full Databricks data journey.
County policy PDFs live in SharePoint, where nobody can find them and nobody
governs who reads them. This bundle ingests them with Lakeflow Connect, turns
them into governed Unity Catalog tables, makes them searchable through Vector
Search and Genie, and publishes them in DataMarket as data products that
people discover and request access to.

```
SharePoint library (policy PDFs)
   │  Lakeflow Connect — SharePoint connector (UC connection)
   ▼
Spark Declarative Pipeline  ── datamarket-sharepoint-to-rag ─────────────────
   rag_docs_bronze          streaming · raw binary, new/changed files only
   rag_docs_parsed          streaming · ai_parse_document
   rag_docs_chunks          streaming · ~2,000-char chunks, CDF on
   policy_document_catalog  materialized view · one row per document,
                            ai_classify (policy domain) + ai_summarize
   │
   ▼  Unity Catalog  demo.<schema>.*   (lineage, grants, comments)
   ├── Vector Search   rag_docs_chunks_index  (Delta Sync, gte-large-en)
   ├── Genie space     "DataMarket — County Policy Documents"
   └── DataMarket app  products registered from UC; access requests
                       approved in-app run a real UC GRANT; Ask AI
                       answers over product metadata via FMAPI
```

## What gets deployed

| Resource | Name | Purpose |
|---|---|---|
| Schema | `demo.sled_datamarket_docs` | Home for every table below |
| Pipeline | `datamarket-sharepoint-to-rag` | Serverless SDP: ingest → parse → chunk → classify |
| Job | `datamarket-sharepoint-refresh` | Pipeline, then Vector Search sync and Genie publish (daily schedule, paused) |
| Vector index | `rag_docs_chunks_index` | Semantic search over chunks, created on first run |
| Genie space | `DataMarket — County Policy Documents` | Natural-language questions over the catalog and chunks, updated in place on re-runs |

Development mode prefixes names per user (`dev_<user>_sled_datamarket_docs`,
`[dev <user>] …`), so several people can deploy into one workspace.

## Prerequisites

- A Unity Catalog connection of type `SHAREPOINT` with `USE CONNECTION` for the
  deploying user ([setup guide](https://docs.databricks.com/aws/en/ingestion/lakeflow-connect/sharepoint-source-setup-overview))
- `CREATE SCHEMA` on the target catalog
- Serverless compute for pipelines, jobs, and notebooks
- A SQL warehouse for the Genie space
- Databricks CLI 0.279 or later

## Deploy and run

```bash
cd demos/fe-bar

# Override any default in databricks.yml with --var
databricks bundle deploy -t dev --profile <profile> \
  --var sharepoint_connection=<connection> \
  --var sharepoint_url='<library URL>' \
  --var warehouse_id=<warehouse id>

databricks bundle run refresh -t dev --profile <profile>
```

If deploy fails with `openpgp: key expired` while downloading Terraform, use the
direct engine: `DATABRICKS_BUNDLE_ENGINE=direct databricks bundle deploy …`.

## Publish in DataMarket

1. **Dataset:** in DataMarket, go to **Manage → Import from Unity Catalog**,
   select `policy_document_catalog` and `rag_docs_chunks`, and import. Table
   comments become product descriptions, and the UC owner becomes the product
   owner.
2. **Genie space:** go to **Register Data**, choose type **Genie Space**, and
   paste the space URL that the `publish_genie_space` task prints.
3. **Access:** a business user requests access to the dataset; a steward
   approves it in **Manage → Approvals**, and DataMarket runs
   `GRANT SELECT` on the table through the SQL warehouse.

## Files

| Path | What it is |
|---|---|
| `databricks.yml` | Bundle: schema, pipeline, job, variables |
| `src/pipeline/sharepoint_to_rag.py` | Bronze, parsed, and chunk streaming tables |
| `src/pipeline/policy_document_catalog.sql` | Per-document materialized view with AI classification and summary |
| `src/setup/vector_index.py` | Creates or syncs the Vector Search index |
| `src/setup/genie_space.py` | Creates or updates the Genie space from the template |
| `src/genie/space.template.json` | Genie tables, column descriptions, instructions, and example SQL |

## Data

The PDFs are synthetic county policy documents written for demos. They are not
committed here; the pipeline reads them from SharePoint at run time.
