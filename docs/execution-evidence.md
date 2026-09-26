# Execution Evidence

Captured on **September 26, 2026** against a live Azure Databricks workspace. Every output here came from a real run, not a mock. The raw responses are in [`evidence/run-2026-09-26.json`](evidence/run-2026-09-26.json). The workspace host, app URL, and service principal ID are redacted. The source documents are synthetic county policy PDFs (see [`demos/fe-bar/README.md`](../demos/fe-bar/README.md)).

| # | What ran | Proves |
|---|----------|--------|
| 1 | Lakeflow job: ingest → vector sync → Genie publish | Lakeflow Connect, SDP, AI Functions, Vector Search, Genie automation |
| 2 | SQL on the governed catalog table | Unity Catalog output with AI-derived columns |
| 3 | Vector Search similarity query | Retrieval over the chunked documents |
| 4 | Genie answering a question in plain English | Genie on the published space |
| 5 | DataMarket app API: catalog and access request round trip | Databricks App + Lakebase + a real UC `GRANT`/`REVOKE` |

---

## 1. Lakeflow job run

Job `datamarket-sharepoint-refresh` (defined in [`demos/fe-bar/databricks.yml`](../demos/fe-bar/databricks.yml)), run `798790042350279`: **SUCCESS** in 1 min 30 s.

| Task | Result | Duration |
|------|--------|----------|
| `ingest_parse_classify` (SDP pipeline: SharePoint → `ai_parse_document` → chunks → `AI_CLASSIFY`/`AI_SUMMARIZE`) | SUCCESS | 65 s |
| `sync_vector_index` → `rag_docs_chunks_index` | SUCCESS | 24 s |
| `publish_genie_space` → `https://<workspace-host>/genie/rooms/01f1b97b7e6c195bb70fd6311e02757e` | SUCCESS | 22 s |

Pipeline event log for the same update:

```text
07:30:15 update_progress: Update 89eb8e is RUNNING.
07:30:23 flow_progress: Flow '…rag_docs_bronze' has COMPLETED.
07:30:26 flow_progress: Flow '…rag_docs_parsed' has COMPLETED.
07:30:30 flow_progress: Flow '…rag_docs_chunks' has COMPLETED.
07:30:49 flow_progress: Flow '…policy_document_catalog' has COMPLETED.
07:30:49 update_progress: Update 89eb8e is COMPLETED.
```

Row counts after the run. All 12 source PDFs made it through every layer.

| Table | Rows |
|-------|------|
| `rag_docs_bronze` | 12 |
| `rag_docs_parsed` | 12 |
| `rag_docs_chunks` | 12 |
| `policy_document_catalog` | 12 |

## 2. Query on the governed catalog

```sql
SELECT document_title, policy_domain, chunk_count, summary
FROM demo.dev_samir_raut_sled_datamarket_docs.policy_document_catalog
ORDER BY policy_domain, document_title;
```

`policy_domain` comes from `AI_CLASSIFY` and `summary` comes from `AI_SUMMARIZE`, both computed inside the pipeline.

| document_title | policy_domain | summary |
|---|---|---|
| Community Engagement Framework | Community Engagement | Community Engagement Framework outlines 5 levels of engagement and requires equity, accessibility, and digital inclusion in all activities, with annual reporting on engagement efforts and outcomes. |
| Emergency Operations Plan | Emergency Management | County Emergency Operations Plan outlines framework for emergency response, including activation levels, EOC structure, and communication protocols. |
| Annual Budget Procedures | Finance and Budget | Annual budget development involves department requests, hearings, and board approvals, with a final budget adopted by June and implemented July 1. |
| Fleet Management Policy | Fleet and Operations | County fleet policy outlines vehicle assignment, maintenance, electric transition, and accident reporting guidelines for employees and fleet management. |
| GIS Data Standards | GIS and Infrastructure | County GIS data standards require California State Plane Coordinate System, specific data layers, and FGDC-compliant metadata, with data published on an open portal. |
| Infrastructure Inspection Standards | GIS and Infrastructure | Public infrastructure inspection standards cover bridges, roads, storm drains, and traffic signals with regular inspections and maintenance schedules. |
| Employee Handbook Summary | Human Resources | County employee handbook outlines employment standards, leave policies, code of conduct, and telework policy for employees. |
| IT Disaster Recovery Plan | Information Technology and Security | IT disaster recovery plan outlines objectives, backup strategies, and failover procedures for critical systems, ensuring timely recovery and minimal data loss. |
| Information Security Policy | Information Technology and Security | County's information security policy outlines access controls, data classification, and incident response for employees, contractors, and third-party providers. |
| Procurement Policy | Procurement | County procurement policy outlines thresholds, vendor selection criteria, contract types, and protest procedures for purchases over $10,000. |
| Water Quality Monitoring | Public Health and Environment | Water quality monitoring program includes sampling surface, ground, storm, beach, and drinking water, testing for various parameters, and responding to exceedances with re-sampling and public notification. |
| Public Records Request Policy | Public Records | Policy governs public records requests under CPRA and FOIA, outlining response timelines, exempt records, and fee schedules for processing requests. |


## 3. Vector Search

Query `"purchasing thresholds that require competitive bids"` against `rag_docs_chunks_index` (`databricks-gte-large-en` embeddings):

| Rank | Document | Score | Chunk (excerpt) |
|---|---|---|---|
| 1 | SLED-006_Procurement_Policy.pdf | 0.626 | *Micro-purchase (under $10,000): Direct purchase, no competitive bidding required • Small purchase ($10,000–$100,000): Minimum 3 written quotes • Formal bid ($100,000–$1,000,000): Sealed co…* |
| 2 | SLED-012_Infrastructure_Inspection_Standards.pdf | 0.494 | *Bridge Inspections • Routine: Every 24 months per FHWA…* |
| 3 | SLED-002_Public_Records_Request_Policy.pdf | 0.492 | *This policy governs the processing of public records requests under the CPRA…* |

## 4. Genie answer

Space: **DataMarket — County Policy Documents**, created and updated by the `publish_genie_space` task from [`space.template.json`](../demos/fe-bar/src/genie/space.template.json).

**Question:** *What does the IT disaster recovery plan say about recovery time objectives?*

**Genie's answer:**
> The **IT Disaster Recovery Plan** sets these recovery time objectives: **Tier 1 (Critical) = 4 hours**, **Tier 2 (Essential) = 24 hours**, **Tier 3 (Standard) = 72 hours**, and **Tier 4 (Non-critical) = 1 week**. The plan shows that recovery targets become longer as system criticality decreases.

**SQL Genie generated.** It joins the AI-built catalog to the chunks table:

```sql
SELECT d.`document_title`, c.`chunk`
FROM `demo`.`dev_samir_raut_sled_datamarket_docs`.`rag_docs_chunks` c
JOIN `demo`.`dev_samir_raut_sled_datamarket_docs`.`policy_document_catalog` d
  ON c.`source_file` = d.`source_file`
WHERE d.`document_title` ILIKE '%IT disaster recovery%'
  AND (LOWER(c.`chunk`) LIKE '%recovery time objective%' OR LOWER(c.`chunk`) LIKE '%rto%')
ORDER BY d.`document_title`
```

**Result row:** `IT Disaster Recovery Plan | "1. Recovery Objectives • Tier 1 (Critical): RTO 4 hours, RPO 1 hour (911, financial systems, email) • Tier 2 (Es…"`

## 5. DataMarket app: catalog and access round trip

All calls went to the deployed Databricks App as an authenticated admin (`GET /api/portal/identity` → `role: admin`, `mode: sso`).

### Catalog entries for this build

Registered through the app API: `POST /api/portal/admin/import-uc` for the UC table, and `POST /api/portal/products` followed by `PUT …/publish` for the rest.

| Ref | Product | Type | Backing asset |
|---|---|---|---|
| DP-022 | Policy Document Catalog | Dataset | `…sled_datamarket_docs.policy_document_catalog` |
| DP-023 | County Policy Documents — Ask Genie | Genie Space | same table |
| DP-024 | Expenditure Monitoring Dashboard | Power BI | report link (not in UC) |
| DP-025 | Vendor Payment Aging Report | Power BI | report link (not in UC) |
| DP-026 | Payroll and Overtime Trends | Power BI | report link (not in UC) |

The Power BI reports sit next to the governed tables in the same catalog. Finding both in one place is the problem this build solves.

### Access request → approval → UC grant → revoke

The requester is an account-level group, `data_engineers_demo_group`, requesting read access to DP-022.

**Submitted.** `POST /api/portal/requests` → `REQ-007`, status `Pending`, reason *"Audit analysts need the policy catalog to scope procurement testing in the annual audit plan"*.

**First approval attempt: blocked (HTTP 502).** The app's service principal didn't yet have `CAN_USE` on the SQL warehouse:

```json
{ "error": "Unity Catalog rejected the grant: You do not have permission to use the SQL Warehouse. Please contact your administrator. The request is still pending." }
```

The request stayed `Pending`. Before this run, the app marked requests *Approved* even when the `GRANT` failed. This evidence run exposed that bug, and it is now fixed: approval only succeeds when Unity Catalog confirms the grant.

**Environment fix:** `databricks permissions update sql/warehouses <warehouse>` gives the app service principal `CAN_USE`.

**Invalid principal: blocked.** A request for `fs_analysts`, a workspace-local group that Unity Catalog can't see, was also blocked:

```json
{ "error": "Unity Catalog rejected the grant: [...] PRINCIPAL_DOES_NOT_EXIST [...] Could not find principal with name fs_analysts. The request is still pending." }
```

**Self-approval: blocked (HTTP 403).** In a separate request from the same run (REQ-003), an admin who tried to approve their own request got `"You cannot approve your own access request."`

**Approved.** `PUT /api/portal/requests/REQ-007/approve`:

```json
{
  "status": "Approved",
  "uc_grant_sql": "GRANT SELECT ON demo.dev_samir_raut_sled_datamarket_docs.policy_document_catalog TO `data_engineers_demo_group`;",
  "uc_executed": true,
  "uc_status": "SUCCEEDED"
}
```

**Verified in Unity Catalog:**

| When | `SHOW GRANTS \`data_engineers_demo_group\` ON TABLE …policy_document_catalog` |
|---|---|
| Before approval | *(no rows)* |
| After approval | `data_engineers_demo_group · SELECT · TABLE · demo.dev_samir_raut_sled_datamarket_docs.policy_document_catalog` |
| After revoke | *(no rows)* |

**Revoked.** `PUT …/REQ-007/revoke` → `REVOKE SELECT … FROM \`data_engineers_demo_group\`;`, `uc_status: SUCCEEDED`.

### Audit trail (Lakebase `audit_log`, newest first)

| Time (UTC) | Event | Actor | Request | Detail |
|---|---|---|---|---|
| 23:48:16 | ACCESS_REVOKED | admin | REQ-007 | REVOKE succeeded — "Audit fieldwork complete" |
| 23:48:14 | REQUEST_APPROVED | admin | REQ-007 | GRANT `SUCCEEDED` |
| 23:48:12 | REQUEST_DENIED | admin | REQ-008 | "Not a Unity Catalog group" |
| 23:48:11 | GRANT_FAILED | admin | REQ-008 | PRINCIPAL_DOES_NOT_EXIST |
| 23:48:09 | REQUEST_SUBMITTED | fs_analysts | REQ-008 | |
| 23:48:02 | GRANT_FAILED | admin | REQ-007 | no warehouse permission |
| 23:48:02 | REQUEST_SUBMITTED | data_engineers_demo_group | REQ-007 | |

Once the approver clicks Approve, one API call writes the decision to Lakebase, runs the `GRANT`, and confirms it in Unity Catalog. The manual process it replaces is measured in weeks.

---

## Reproduce

```bash
cd demos/fe-bar
DATABRICKS_BUNDLE_ENGINE=direct databricks bundle deploy -t dev
databricks bundle run refresh -t dev
```

Then register the outputs in DataMarket (Admin → Import from UC) and submit a request from the product page.
