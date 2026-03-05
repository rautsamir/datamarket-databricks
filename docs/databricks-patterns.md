# Databricks Best Practices & Patterns

This document outlines Databricks platform best practices and patterns for building professional demos.

## 🏛️ Unity Catalog Standards

### Naming Conventions:
```sql
-- Use three-part naming
catalog.schema.table

-- Environment-specific catalogs
dev_retail_demo.customers
prod_finance_demo.transactions
```

### Catalog Structure:
```
catalog/
├── schema/
│   ├── raw/           # Raw data tables
│   ├── bronze/        # Cleaned data
│   ├── silver/        # Business logic applied
│   └── gold/          # Aggregated metrics
```

### Permissions:
```sql
-- Grant appropriate permissions
GRANT SELECT ON catalog.schema.table TO `account users`;
GRANT MODIFY ON catalog.schema.table TO `data engineers`;
```

## 🔄 Asset Bundle Patterns

### Bundle Configuration:
```yaml
bundle:
  name: project_name

targets:
  dev:
    default: true
    workspace:
      host: https://adb-1234567890123456.7.azuredatabricks.net
    resources:
      jobs:
        data_generation_job:
          name: "Data Generation"
          tasks:
            - task_key: generate_data
              notebook_task:
                notebook_path: ./src/main
                source: WORKSPACE
```

### Resource Organization:
```yaml
# Separate resources by type
resources:
  jobs:
    # Data processing jobs
  apps:
    # Web applications
  models:
    # ML models
  warehouses:
    # SQL warehouses
```

## 📊 Data Generation Excellence

### Synthetic Data Quality:
```python
# Use realistic distributions
.withColumn("income", "decimal(10,2)", 
    minValue=20000, maxValue=500000, 
    distribution="lognormal")

# Ensure referential integrity
.withColumn("customer_id", "string", 
    values=customer_ids)

# Add business logic
.withColumn("total_amount", "decimal(10,2)", 
    expr="quantity * unit_price")
```

### Performance Optimization:
```python
# Optimize partitions
def optimize_partitions(spark, row_count):
    optimal_partitions = max(1, row_count // 10000)
    return min(optimal_partitions, 200)

# Use efficient data types
.withColumn("created_date", "timestamp", 
    begin="2023-01-01", end="2024-01-01")
```

## 🚀 Model Serving & Agents

### MLflow Integration:
```python
# Register model
mlflow.register_model(
    model_uri="runs:/1234567890abcdef/model",
    name="retail_forecasting_model"
)

# Serve model
mlflow models serve -m "models:/retail_forecasting_model/Production"
```

### Agent Framework:
```python
# Mosaic AI Agent
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.workspace import Agent

client = WorkspaceClient()
agent = Agent(
    name="retail_analytics_agent",
    model="llama-2-70b-chat",
    tools=["sql_query", "data_analysis"]
)
```

## 🔒 Security & Governance

### Service Principals:
```bash
# Create service principal
databricks service-principals create \
  --display-name "demo-service-principal" \
  --application-id "your-app-id"
```

### Secrets Management:
```python
# Use Databricks secrets
from databricks.sdk import WorkspaceClient
client = WorkspaceClient()

# Store secrets
client.secrets.put_secret(
    scope="demo-secrets",
    key="database-password",
    string_value="secure-password"
)
```

### Data Classification:
```sql
-- Apply data classification
ALTER TABLE catalog.schema.table 
SET TBLPROPERTIES (
    'data.classification' = 'internal',
    'data.owner' = 'data-team'
);
```

## ⚡ Performance Optimization

### Delta Lake Optimizations:
```sql
-- Z-ordering for query performance
OPTIMIZE catalog.schema.table
ZORDER BY (customer_id, transaction_date);

-- Vacuum to remove old files
VACUUM catalog.schema.table
RETAIN 168 HOURS;
```

### Query Optimization:
```sql
-- Use adaptive query execution
SET spark.sql.adaptive.enabled = true;
SET spark.sql.adaptive.coalescePartitions.enabled = true;

-- Partition pruning
SELECT * FROM transactions 
WHERE transaction_date >= '2024-01-01'
  AND transaction_date < '2024-02-01';
```

### Cluster Configuration:
```yaml
new_cluster:
  spark_version: 14.0.x-scala2.12
  node_type_id: Standard_DS3_v2
  num_workers: 2
  spark_conf:
    spark.sql.adaptive.enabled: true
    spark.sql.adaptive.coalescePartitions.enabled: true
    spark.sql.adaptive.skewJoin.enabled: true
```

## 📈 Monitoring & Observability

### Job Monitoring:
```python
# Monitor job runs
from databricks.sdk import WorkspaceClient
client = WorkspaceClient()

runs = client.jobs.list_runs(
    job_id=123456789,
    limit=10
)

for run in runs:
    print(f"Run {run.run_id}: {run.state.life_cycle_state}")
```

### Query Performance:
```sql
-- Monitor query performance
DESCRIBE DETAIL catalog.schema.table;

-- Check partition statistics
ANALYZE TABLE catalog.schema.table COMPUTE STATISTICS;
```

### Error Handling:
```python
# Comprehensive error handling
try:
    # Data processing logic
    df.write.format("delta").saveAsTable("catalog.schema.table")
except Exception as e:
    # Log error and notify
    logger.error(f"Data processing failed: {str(e)}")
    # Send alert
    send_alert(f"Job failed: {str(e)}")
```

## 🎯 Demo-Specific Patterns

### Real-time Data:
```python
# Streaming data processing
df = spark.readStream \
    .format("delta") \
    .option("readChangeFeed", "true") \
    .table("catalog.schema.table")

# Process streaming data
streaming_query = df.writeStream \
    .format("delta") \
    .outputMode("append") \
    .trigger(processingTime="1 minute") \
    .start()
```

### Interactive Dashboards:
```javascript
// Real-time dashboard updates
const eventSource = new EventSource('/api/events');
eventSource.onmessage = function(event) {
    const data = JSON.parse(event.data);
    updateDashboard(data);
};
```

### Data Quality Checks:
```python
# Automated data quality validation
def validate_data_quality(df, table_name):
    # Check for nulls in critical fields
    null_counts = {}
    for column in df.columns:
        null_count = df.filter(f"{column} IS NULL").count()
        if null_count > 0:
            null_counts[column] = null_count
    
    # Alert if quality issues found
    if null_counts:
        send_alert(f"Data quality issues in {table_name}: {null_counts}")
    
    return null_counts
```

## 🔧 CI/CD Patterns

### Automated Testing:
```yaml
# GitHub Actions workflow
name: Test Demo
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Tests
        run: |
          databricks bundle validate
          databricks bundle test
```

### Deployment Pipeline:
```yaml
# Deployment stages
stages:
  - dev:
      workspace: dev-workspace
      resources: minimal
  - staging:
      workspace: staging-workspace
      resources: medium
  - prod:
      workspace: prod-workspace
      resources: full
```

## 📚 Best Practices Summary

### Data Management:
1. **Use Unity Catalog** for governance
2. **Implement proper naming** conventions
3. **Apply data quality** checks
4. **Optimize for performance** with partitioning

### Security:
1. **Use service principals** for automation
2. **Store secrets** in Databricks secrets
3. **Apply least-privilege** access
4. **Enable audit logging**

### Performance:
1. **Use Delta Lake** optimizations
2. **Implement proper partitioning**
3. **Monitor query performance**
4. **Optimize cluster configurations**

### Development:
1. **Use Asset Bundles** for deployment
2. **Implement comprehensive testing**
3. **Follow CI/CD patterns**
4. **Monitor and alert** on issues

### Demo Excellence:
1. **Focus on business value**
2. **Ensure professional presentation**
3. **Include interactive elements**
4. **Optimize for performance**

Remember: These patterns ensure your demos are production-ready, scalable, and maintainable while showcasing the full capabilities of the Databricks platform. 