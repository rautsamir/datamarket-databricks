# DataMarket User Guide
## Enterprise Data Product Marketplace on Databricks

### What is DataMarket?

DataMarket is your organization's enterprise data marketplace, built natively on the Databricks Lakehouse Platform. It enables employees to discover, explore, and request access to curated data products — governed by Unity Catalog.

### Getting Started

#### Logging In
1. Navigate to your DataMarket URL
2. Sign in using your organization's SSO credentials (Entra ID / Okta)
3. Your access permissions are automatically determined by your department and role

#### Portal Navigation
- **Overview**: Dashboard showing key metrics across all data products
- **Data Products**: Browse the data product catalog, search by keyword, filter by domain
- **Vendor Analytics**: Vendor payment tracking with risk and fraud detection flags
- **Budget & Finance**: Departmental budget analysis and variance reporting
- **Internal Billing**: Inter-departmental charge analysis and anomaly detection
- **AI Explorer**: Ask questions about enterprise data in natural language
- **Documents**: Access data dictionaries, training materials, and guides

### Using the Data Product Catalog

#### Searching for Data
1. Click "Data Products" in the navigation
2. Use the search bar to find products by name, description, or tags
3. Filter by domain using the chips: Finance, Procurement, HR, Operations, etc.

#### Understanding Data Product Cards
- **Domain** — which business area this data belongs to
- **Access Level** — who can access (Public, Restricted, Confidential)
- **Sensitivity** — PII, financial, or operational designation
- **Refresh Frequency** — how often the data is updated
- **Steward** — who to contact with questions

### Requesting Data Access

1. Find a data product you need
2. Click "Request Access"
3. Fill in your business justification
4. Submit — your Data Steward will receive a notification
5. You'll receive email confirmation when approved or denied

### AI Explorer

Ask questions in plain English about any data products you have access to:
- "What are the top 5 departments by budget?"
- "Show vendor payments flagged for review this quarter"
- "What is the variance between budget and actuals for Operations?"

Results are returned as interactive tables with the underlying SQL query shown.

### Your Library

Approved data products appear in your Library. From there you can:
- View connection details (catalog, schema, table name)
- Download documentation
- See your access expiry date

### Support

Contact your Data Platform team or open an access request for assistance.
