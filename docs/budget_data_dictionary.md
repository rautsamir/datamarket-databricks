# Budget & Expenditure Analytics - Data Dictionary
## LA County Auditor-Controller DNA Platform

### Overview
The Budget & Expenditure Analytics product provides comprehensive departmental budget data including allocations, actuals, encumbrances, and variance analysis across all 15 County departments.

### Table: gold_departments
| Column | Type | Description |
|--------|------|-------------|
| department_id | INT | Unique department identifier |
| department_name | STRING | Official department name |
| department_code | STRING | 3-letter department code |
| budget_allocation | DECIMAL(15,2) | Total annual budget allocation |
| headcount | INT | Authorized headcount |
| director_name | STRING | Department director/head |

### Table: gold_budget_summary
| Column | Type | Description |
|--------|------|-------------|
| budget_id | INT | Unique budget line identifier |
| department_id | INT | FK to gold_departments |
| fiscal_year | STRING | Fiscal year (e.g., FY2024-25) |
| budget_category | STRING | Salaries, Services, Capital, Supplies, Other |
| original_budget | DECIMAL(15,2) | Board-approved original budget |
| revised_budget | DECIMAL(15,2) | Current revised budget (after amendments) |
| actual_expenditure | DECIMAL(15,2) | Actual expenditure to date |
| encumbrance | DECIMAL(15,2) | Committed but not yet spent |
| available_balance | DECIMAL(15,2) | Remaining available balance |
| variance_pct | DECIMAL(5,2) | Variance as percentage ((actual-original)/original) |

### Table: gold_internal_billing
| Column | Type | Description |
|--------|------|-------------|
| billing_id | INT | Unique billing record identifier |
| source_department_id | INT | Department providing the service |
| target_department_id | INT | Department receiving/paying for service |
| billing_date | DATE | Date of billing |
| billing_amount | DECIMAL(15,2) | Amount billed |
| service_type | STRING | Type of inter-departmental service |
| service_description | STRING | Detailed description |
| fiscal_year | STRING | Fiscal year |
| is_anomaly | BOOLEAN | Whether billing was flagged as anomalous |
| anomaly_type | STRING | Type of anomaly detected (null if none) |

### Business Rules
- Budget variance > 10% triggers automatic alert to department director
- Encumbrance + Actual cannot exceed Revised Budget without Board approval
- Internal billing anomalies detected by ML model comparing to historical patterns
- Available balance = Revised Budget - Actual Expenditure - Encumbrance
- Fiscal year runs July 1 - June 30

### Key Metrics
- Total County Budget: ~$30 billion (FY2024-25)
- Number of Departments: 15 major departments
- Total Headcount: ~98,900 authorized positions
- Budget Categories: Salaries (65%), Services (20%), Capital (8%), Supplies (5%), Other (2%)

### Data Freshness
- Source: eCAPS/CAPS+ (County Accounting System)
- Refresh: Daily at 1:00 AM PST
- Latency: T+1 business day
- Quality Score: 91%
