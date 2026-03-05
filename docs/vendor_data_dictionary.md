# Vendor Master Data - Data Dictionary
## LA County Auditor-Controller DNA Platform

### Overview
The Vendor Master Data product provides a comprehensive registry of all vendors registered with LA County. It includes business information, compliance status (LSBE/Prop A), and AI-generated risk scoring.

### Table: gold_vendors
| Column | Type | Description |
|--------|------|-------------|
| vendor_id | INT | Unique vendor identifier |
| vendor_name | STRING | Legal business name |
| vendor_type | STRING | Business category (Construction, Healthcare, IT, Consulting, etc.) |
| tax_id | STRING | Federal Tax ID (EIN) - masked for non-admin users |
| address | STRING | Primary business address |
| city | STRING | City |
| state | STRING | State |
| zip_code | STRING | ZIP code |
| phone | STRING | Primary contact phone |
| is_lsbe | BOOLEAN | Local Small Business Enterprise certified |
| is_prop_a | BOOLEAN | Proposition A certified vendor |
| registration_date | DATE | Date first registered with County |
| risk_score | DECIMAL(5,2) | AI-generated risk score (0.00-1.00) |
| total_payments_ytd | DECIMAL(15,2) | Year-to-date payment total |
| contract_count | INT | Number of active contracts |

### Table: gold_vendor_payments
| Column | Type | Description |
|--------|------|-------------|
| payment_id | INT | Unique payment identifier |
| vendor_id | INT | FK to gold_vendors |
| department_id | INT | FK to gold_departments |
| payment_date | DATE | Date payment was processed |
| payment_amount | DECIMAL(15,2) | Payment amount in USD |
| payment_type | STRING | CHECK, EFT, ACH, WIRE |
| invoice_number | STRING | Vendor invoice reference |
| purchase_order | STRING | County purchase order number |
| fiscal_year | STRING | County fiscal year (e.g., FY2024-25) |
| fiscal_period | INT | Fiscal period (1-12) |
| commodity_code | STRING | County commodity classification code |
| commodity_description | STRING | Description of goods/services |
| is_flagged | BOOLEAN | Whether AI flagged this transaction |
| flag_reason | STRING | Reason for flag (null if not flagged) |

### Business Rules
- Risk scores above 0.50 trigger enhanced review procedures
- PO Box addresses are automatically flagged for additional verification
- LSBE/Prop A status is verified quarterly through the County Clerk
- Payments exceeding 3x the vendor's historical average are auto-flagged
- Duplicate invoice detection runs daily using fuzzy matching
- Vendors registered less than 30 days before first payment are flagged
- Split purchase detection: multiple payments just under approval thresholds

### Data Freshness
- Source: eCAPS (Enterprise County Accounting and Payroll System)
- Refresh: Daily at 2:00 AM PST
- Latency: T+1 business day
- Quality Score: 94% (measured by completeness, accuracy, timeliness)
