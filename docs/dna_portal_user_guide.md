# DNA Portal User Guide
## LA County Auditor-Controller - Data & Analytics Platform

### What is the DNA Portal?
The DNA (Data & Analytics) Portal is LA County's enterprise data marketplace, built natively on the Databricks Lakehouse Platform. It enables County employees to discover, explore, and access curated data products across all departments.

### Getting Started

#### Logging In
1. Navigate to the DNA Portal URL
2. Sign in using your County Entra ID (SSO) credentials
3. Your access permissions are automatically determined by your department and role

#### Portal Navigation
- **Overview**: Dashboard showing key metrics across all data products
- **Data Products**: Browse the data product catalog, search by keyword, filter by domain
- **Vendor Analytics**: Real-time vendor payment tracking with fraud detection flags
- **Budget & Finance**: Departmental budget analysis and variance reporting
- **Internal Billing**: Inter-departmental charge analysis and anomaly detection
- **AI Explorer**: Ask questions about County data in natural language
- **Documents**: Access data dictionaries, training materials, and guides

### Using the Data Product Catalog

#### Searching for Data
1. Click "Data Products" in the navigation
2. Use the search bar to find products by name, description, or tags
3. Filter by domain using the chips: Finance, Procurement, HR, Operations, etc.

#### Understanding Data Product Cards
Each data product card shows:
- **Domain**: The business domain (e.g., Finance, Procurement)
- **Classification**: Public, Internal, Confidential, or Restricted
- **Owner**: The data steward responsible for quality
- **Quality Score**: AI-measured data quality (completeness + accuracy + timeliness)
- **Tables/Rows**: Size of the dataset
- **Refresh Frequency**: How often the data is updated

#### Requesting Access
1. Click "Request Access" on any data product card
2. Fill in the business justification
3. Your request routes to the data owner and IT security for approval
4. Access is granted via Unity Catalog RBAC within 24-48 hours

### Using AI Explorer (Genie)
The AI Explorer lets you ask questions about County data in plain English:

**Example questions:**
- "What are the top 5 departments by budget allocation?"
- "Show me all flagged vendor payments this quarter"
- "Which vendors have the highest risk scores?"
- "What is the total internal billing by service type?"
- "Compare budget variance across departments"

**Tips:**
- Be specific about time periods (e.g., "this fiscal year" or "FY2024-25")
- Reference department names or vendor names exactly
- Ask follow-up questions to drill deeper into results

### Understanding Fraud Detection Flags
The DNA platform uses AI/ML models to detect potential fraud indicators:

| Flag Type | Description | Action Required |
|-----------|-------------|-----------------|
| Amount Exceeds Average | Payment > 3x vendor's historical average | Enhanced review |
| Duplicate Invoice | Matching invoice numbers detected | Verify with vendor |
| PO Box Address | Vendor registered with PO Box only | Address verification |
| Rapid Spend Increase | >200% payment increase YoY | Management review |
| Split Purchase | Multiple payments just under threshold | Audit investigation |
| New Vendor Fast Pay | Payment within 30 days of registration | Background check |

### Getting Help
- **Technical Support**: Contact DNA Platform team at dna-support@lacounty.gov
- **Data Questions**: Reach out to the data product owner listed on each card
- **Access Issues**: Submit a ticket through the Access Requests page
- **Training**: Check the Documents section for latest training materials
