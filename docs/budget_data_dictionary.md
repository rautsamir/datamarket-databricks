# Budget & Expenditure Analytics — Data Dictionary
## DataMarket · Finance Domain

### Overview
The Budget & Expenditure Analytics product provides comprehensive departmental budget data including allocations, actuals, encumbrances, and variance analysis. Customize table names and column definitions to match your organization's data model.

### Table: gold_departments
| Column | Type | Description |
|--------|------|-------------|
| department_id | INT | Unique department identifier |
| department_name | STRING | Official department name |
| department_code | STRING | Short department code |
| budget_allocation | DECIMAL(15,2) | Total annual budget allocation |
| headcount | INT | Authorized headcount |
| director_name | STRING | Department head |

### Table: gold_budget_summary
| Column | Type | Description |
|--------|------|-------------|
| budget_id | INT | Unique budget line identifier |
| department_id | INT | FK → gold_departments |
| fiscal_year | INT | Fiscal year (e.g., 2025) |
| budget_category | STRING | Appropriation category |
| budget_amount | DECIMAL(15,2) | Budgeted amount |
| actual_amount | DECIMAL(15,2) | Actual spending to date |
| encumbered_amount | DECIMAL(15,2) | Committed/encumbered funds |
| variance | DECIMAL(15,2) | Budget − Actual |

### Table: gold_expenditure_detail
| Column | Type | Description |
|--------|------|-------------|
| transaction_id | INT | Unique transaction identifier |
| department_id | INT | FK → gold_departments |
| vendor_id | INT | FK → gold_vendors |
| transaction_date | DATE | Transaction date |
| amount | DECIMAL(12,2) | Transaction amount |
| category | STRING | Expenditure category |
| status | STRING | Approved, Pending, Flagged |

### Access & Sensitivity
- **Access Level**: Restricted (Finance and authorized users only)
- **Contains PII**: No
- **Refresh**: Daily (from source ERP)
- **Steward**: Finance Data Platform team

### Customization Note
Replace table names and column definitions with your organization's actual Gold layer schema. These are sample definitions for demonstration purposes.
