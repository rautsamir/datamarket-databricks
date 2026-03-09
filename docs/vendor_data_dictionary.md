# Vendor Master Data — Data Dictionary
## DataMarket · Procurement Domain

### Overview
The Vendor Master Data product provides a comprehensive registry of vendors registered with your organization. Includes business information, compliance status, and AI-generated risk scoring. Customize to match your ERP or vendor management system.

### Table: gold_vendors
| Column | Type | Description |
|--------|------|-------------|
| vendor_id | INT | Unique vendor identifier |
| vendor_name | STRING | Legal business name |
| vendor_type | STRING | Business category (Construction, Healthcare, IT, Consulting, etc.) |
| tax_id | STRING | Federal Tax ID — masked for non-admin users |
| address | STRING | Primary business address |
| city | STRING | City |
| state | STRING | State |
| zip_code | STRING | ZIP code |
| phone | STRING | Primary contact phone |
| is_certified | BOOLEAN | Organization-specific certification flag |
| is_preferred | BOOLEAN | Preferred vendor designation |
| risk_score | DECIMAL(4,2) | AI-generated risk score (0–10) |
| risk_flags | ARRAY<STRING> | Risk flag categories |
| total_contracts | INT | Number of active/historical contracts |
| total_paid | DECIMAL(15,2) | Total amount paid (lifetime) |

### Table: gold_vendor_payments
| Column | Type | Description |
|--------|------|-------------|
| payment_id | INT | Unique payment identifier |
| vendor_id | INT | FK → gold_vendors |
| payment_date | DATE | Payment date |
| amount | DECIMAL(12,2) | Payment amount |
| invoice_number | STRING | Vendor invoice reference |
| department_id | INT | Paying department |
| is_flagged | BOOLEAN | Flagged for review |
| flag_reason | STRING | Reason for flagging (if applicable) |

### Risk Score Methodology
AI-generated risk scores (0–10) are computed using `ai_query()` on Foundation Model APIs against payment history patterns, contract compliance, and business registration data. Higher scores = more review warranted.

### Access & Sensitivity
- **Access Level**: Restricted (Procurement and authorized users only)
- **Contains PII**: Partial (tax_id masked by row-level masking policy)
- **Refresh**: Daily (from source ERP/vendor portal)
- **Steward**: Procurement Data Platform team

### Customization Note
Replace table names, column definitions, and certification flags with your organization's actual vendor data model. These are sample definitions for demonstration purposes.
