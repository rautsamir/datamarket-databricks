---
description: Data engineering rules for generating realistic synthetic data using pure PySpark and Databricks best practices
globs: src/**/*.py, **/*main.py
alwaysApply: false
---

# Data Generation - Synthetic Data Patterns

You are a data engineering expert who creates realistic, industry-appropriate synthetic data using pure PySpark and Databricks best practices.

## 🎯 Data Generation Principles

### Quality Standards:
- **Realistic distributions** - Use appropriate statistical patterns with Python's random module
- **Referential integrity** - Ensure foreign key relationships are valid
- **Business logic** - Data should follow industry-specific rules
- **Temporal consistency** - Time-based data should be coherent
- **Data quality** - No nulls in critical fields, proper data types

### ⚠️ Important Workspace Considerations:
- **Use pure PySpark** - Avoid third-party libraries like dbldatagen that may cause workspace compatibility issues
- **Avoid complex calculations** - Some Databricks workspaces with Photon engine may have division by zero sensitivity
- **Test incrementally** - Start with simple data generation and add complexity gradually
- **Use basic data types** - Stick to standard Spark SQL types for maximum compatibility

### Scale Guidelines:
- **Small**: 1K records per table (for quick demos)
- **Medium**: 10K records per table (standard demos)
- **Large**: 100K records per table (enterprise demos)

## 📊 Industry-Specific Data Patterns

### Retail Industry:

#### Customers Table:
```python
# Customer demographics with realistic distributions using pure PySpark
import random
from datetime import datetime, timedelta

def generate_customer_data(spark, num_rows=10000):
    """Generate customer data using pure PySpark"""
    
    # Sample data arrays
    first_names = ["John", "Jane", "Michael", "Sarah", "David", "Lisa", "Robert", "Jennifer"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller"]
    segments = ["bronze", "silver", "gold", "platinum"]
    income_levels = ["low", "medium", "high"]
    
    # Generate customer data
    customers = []
    base_date = datetime.now() - timedelta(days=365*2)
    
    for i in range(num_rows):
        customers.append((
            i + 1,  # customer_id
            random.choice(first_names),
            random.choice(last_names),
            f"user{i}@example.com",
            f"+1-{random.randint(200,999)}-{random.randint(200,999)}-{random.randint(1000,9999)}",
            random.choice(["M", "F"]),
            random.choice(income_levels),
            random.choice(segments),
            round(random.uniform(100, 50000), 2),  # lifetime_value
            round(random.uniform(0.0, 1.0), 2),   # churn_risk
            base_date + timedelta(days=random.randint(0, 365*2)),  # created_date
            random.randint(0, 200),  # total_purchases
            round(random.uniform(25, 500), 2)  # avg_order_value
        ))
    
    # Create schema and DataFrame
    schema = StructType([
        StructField("customer_id", LongType(), False),
        StructField("first_name", StringType(), True),
        StructField("last_name", StringType(), True),
        StructField("email", StringType(), True),
        StructField("phone", StringType(), True),
        StructField("gender", StringType(), True),
        StructField("income_level", StringType(), True),
        StructField("customer_segment", StringType(), True),
        StructField("lifetime_value", DoubleType(), True),
        StructField("churn_risk", DoubleType(), True),
        StructField("created_date", DateType(), True),
        StructField("total_purchases", IntegerType(), True),
        StructField("avg_order_value", DoubleType(), True)
    ])
    
    return spark.createDataFrame(customers, schema)
```

#### Products Table:
```python
# Product catalog with categories and pricing
products_df = dg.DataGenerator(
    spark,
    rows=5000,
    partitions=4
).withIdOutput() \
 .withColumn("product_id", "string", uniqueValues=True) \
 .withColumn("product_name", "string", template=r'Product \\w{3,8}') \
 .withColumn("category", "string", values=["electronics", "clothing", "home", "sports", "books", "beauty"], weights=[0.2, 0.25, 0.2, 0.15, 0.1, 0.1]) \
 .withColumn("subcategory", "string", template=r'Sub-\\w{4,8}') \
 .withColumn("brand", "string", values=["BrandA", "BrandB", "BrandC", "BrandD", "BrandE"], weights=[0.3, 0.25, 0.2, 0.15, 0.1]) \
 .withColumn("price", "decimal(10,2)", minValue=10, maxValue=1000, distribution="lognormal") \
 .withColumn("cost", "decimal(10,2)", expr="price * (0.4 + rand() * 0.3)") \
 .withColumn("inventory_level", "integer", minValue=0, maxValue=500, distribution="poisson") \
 .withColumn("reorder_point", "integer", minValue=10, maxValue=100) \
 .withColumn("supplier_id", "string", template=r'SUP\\d{4}') \
 .withColumn("is_active", "boolean", values=[True, False], weights=[0.9, 0.1]) \
 .withColumn("created_date", "timestamp", begin="2019-01-01", end="2024-01-01")
```

#### Transactions Table:
```python
# Sales transactions with realistic patterns
transactions_df = dg.DataGenerator(
    spark,
    rows=50000,
    partitions=8
).withIdOutput() \
 .withColumn("transaction_id", "string", uniqueValues=True) \
 .withColumn("customer_id", "string", values=customer_ids) \
 .withColumn("product_id", "string", values=product_ids) \
 .withColumn("transaction_date", "timestamp", begin="2023-01-01", end="2024-01-01", distribution="normal") \
 .withColumn("quantity", "integer", minValue=1, maxValue=10, distribution="poisson") \
 .withColumn("unit_price", "decimal(10,2)", minValue=10, maxValue=500, distribution="lognormal") \
 .withColumn("total_amount", "decimal(10,2)", expr="quantity * unit_price") \
 .withColumn("payment_method", "string", values=["credit_card", "debit_card", "cash", "paypal"], weights=[0.6, 0.25, 0.1, 0.05]) \
 .withColumn("store_id", "string", values=store_ids) \
 .withColumn("sales_person_id", "string", template=r'SP\\d{4}') \
 .withColumn("is_return", "boolean", values=[False, True], weights=[0.95, 0.05]) \
 .withColumn("return_reason", "string", values=["", "defective", "wrong_size", "not_satisfied"], weights=[0.95, 0.02, 0.02, 0.01])
```

### Supply Chain Industry:

#### Suppliers Table:
```python
# Supplier information with performance metrics
suppliers_df = dg.DataGenerator(
    spark,
    rows=2000,
    partitions=4
).withIdOutput() \
 .withColumn("supplier_id", "string", uniqueValues=True) \
 .withColumn("supplier_name", "string", template=r'Supplier \\w{4,10}') \
 .withColumn("contact_person", "string", template=r'\\w{3,8} \\w{4,10}') \
 .withColumn("email", "string", template=r'contact@\\w{4,10}\\.com') \
 .withColumn("phone", "string", template=r'\\d{3}-\\d{3}-\\d{4}') \
 .withColumn("country", "string", values=["USA", "China", "Germany", "Japan", "Mexico", "Canada"], weights=[0.4, 0.25, 0.15, 0.1, 0.05, 0.05]) \
 .withColumn("performance_score", "decimal(3,2)", minValue=0.5, maxValue=1.0, distribution="normal") \
 .withColumn("lead_time_days", "integer", minValue=1, maxValue=60, distribution="poisson") \
 .withColumn("quality_rating", "decimal(3,2)", minValue=0.7, maxValue=1.0, distribution="normal") \
 .withColumn("cost_rating", "decimal(3,2)", minValue=0.5, maxValue=1.0, distribution="normal") \
 .withColumn("is_active", "boolean", values=[True, False], weights=[0.9, 0.1])
```

#### Shipments Table:
```python
# Shipment tracking with delays and costs
shipments_df = dg.DataGenerator(
    spark,
    rows=15000,
    partitions=6
).withIdOutput() \
 .withColumn("shipment_id", "string", uniqueValues=True) \
 .withColumn("supplier_id", "string", values=supplier_ids) \
 .withColumn("product_id", "string", values=product_ids) \
 .withColumn("order_date", "timestamp", begin="2023-01-01", end="2024-01-01") \
 .withColumn("ship_date", "timestamp", expr="order_date + interval (rand() * 30) days") \
 .withColumn("expected_delivery", "timestamp", expr="ship_date + interval (rand() * 14 + 3) days") \
 .withColumn("actual_delivery", "timestamp", expr="expected_delivery + interval (rand() * 10 - 5) days") \
 .withColumn("quantity", "integer", minValue=10, maxValue=1000, distribution="poisson") \
 .withColumn("unit_cost", "decimal(10,2)", minValue=5, maxValue=200, distribution="lognormal") \
 .withColumn("total_cost", "decimal(10,2)", expr="quantity * unit_cost") \
 .withColumn("shipping_cost", "decimal(10,2)", minValue=50, maxValue=500, distribution="normal") \
 .withColumn("is_delayed", "boolean", expr="actual_delivery > expected_delivery") \
 .withColumn("delay_days", "integer", expr="datediff(actual_delivery, expected_delivery)") \
 .withColumn("carrier", "string", values=["FedEx", "UPS", "DHL", "USPS"], weights=[0.4, 0.3, 0.2, 0.1])
```

### Finance Industry:

#### Accounts Table:
```python
# Bank accounts with balances and types
accounts_df = dg.DataGenerator(
    spark,
    rows=25000,
    partitions=6
).withIdOutput() \
 .withColumn("account_id", "string", uniqueValues=True) \
 .withColumn("customer_id", "string", values=customer_ids) \
 .withColumn("account_type", "string", values=["checking", "savings", "credit", "investment"], weights=[0.5, 0.3, 0.15, 0.05]) \
 .withColumn("balance", "decimal(12,2)", minValue=0, maxValue=100000, distribution="lognormal") \
 .withColumn("credit_limit", "decimal(12,2)", minValue=0, maxValue=50000, distribution="lognormal") \
 .withColumn("interest_rate", "decimal(5,4)", minValue=0.01, maxValue=0.25, distribution="normal") \
 .withColumn("risk_score", "integer", minValue=300, maxValue=850, distribution="normal") \
 .withColumn("account_status", "string", values=["active", "suspended", "closed"], weights=[0.95, 0.03, 0.02]) \
 .withColumn("opened_date", "timestamp", begin="2015-01-01", end="2024-01-01") \
 .withColumn("last_activity", "timestamp", begin="2023-01-01", end="2024-01-01")
```

#### Transactions Table:
```python
# Financial transactions with fraud indicators
transactions_df = dg.DataGenerator(
    spark,
    rows=100000,
    partitions=10
).withIdOutput() \
 .withColumn("transaction_id", "string", uniqueValues=True) \
 .withColumn("account_id", "string", values=account_ids) \
 .withColumn("transaction_date", "timestamp", begin="2023-01-01", end="2024-01-01", distribution="normal") \
 .withColumn("amount", "decimal(12,2)", minValue=1, maxValue=10000, distribution="lognormal") \
 .withColumn("transaction_type", "string", values=["deposit", "withdrawal", "transfer", "payment", "fee"], weights=[0.3, 0.25, 0.2, 0.2, 0.05]) \
 .withColumn("merchant_category", "string", values=["retail", "restaurant", "gas", "online", "utilities", "entertainment"], weights=[0.3, 0.2, 0.15, 0.2, 0.1, 0.05]) \
 .withColumn("merchant_name", "string", template=r'\\w{4,12} \\w{3,8}') \
 .withColumn("location", "string", template=r'\\w{4,8}, \\w{2}') \
 .withColumn("is_fraud", "boolean", values=[False, True], weights=[0.99, 0.01]) \
 .withColumn("fraud_score", "decimal(3,2)", minValue=0.0, maxValue=1.0, distribution="normal") \
 .withColumn("is_approved", "boolean", values=[True, False], weights=[0.98, 0.02])
```

## 🔧 Data Generation Patterns

### Time Series Data:
```python
# Generate time series with realistic patterns
def generate_time_series(spark, base_date, periods, trend=0, seasonality=0):
    """Generate time series data with trend and seasonality"""
    dates = [base_date + timedelta(days=i) for i in range(periods)]
    
    # Base values with trend
    base_values = [100 + (i * trend) for i in range(periods)]
    
    # Add seasonality (weekly pattern)
    seasonal_values = [base_values[i] + (seasonality * sin(2 * pi * i / 7)) for i in range(periods)]
    
    # Add random noise
    final_values = [max(0, seasonal_values[i] + (random.normal(0, 10))) for i in range(periods)]
    
    return spark.createDataFrame([
        (dates[i], final_values[i]) for i in range(periods)
    ], ["date", "value"])
```

### Correlated Data:
```python
# Generate correlated fields
def generate_correlated_data(spark, base_df, correlation_field, target_field, correlation=0.7):
    """Generate correlated data based on existing field"""
    # Use existing field to influence new field
    correlated_df = base_df.withColumn(
        target_field,
        expr(f"{correlation_field} * {correlation} + rand() * {1 - correlation}")
    )
    return correlated_df
```

### Geographic Data:
```python
# Generate location-based data
locations_df = dg.DataGenerator(
    spark,
    rows=1000,
    partitions=4
).withIdOutput() \
 .withColumn("location_id", "string", uniqueValues=True) \
 .withColumn("city", "string", values=["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose"]) \
 .withColumn("state", "string", values=["NY", "CA", "IL", "TX", "AZ", "PA", "TX", "CA", "TX", "CA"]) \
 .withColumn("latitude", "decimal(8,6)", minValue=25.0, maxValue=49.0) \
 .withColumn("longitude", "decimal(9,6)", minValue=-125.0, maxValue=-66.0) \
 .withColumn("population", "integer", minValue=100000, maxValue=10000000, distribution="lognormal")
```

## 📊 Data Quality Patterns

### Validation Functions:
```python
# Data quality checks
def validate_data_quality(df, table_name):
    """Validate data quality for generated table"""
    total_rows = df.count()
    null_counts = {}
    
    for column in df.columns:
        null_count = df.filter(f"{column} IS NULL").count()
        null_counts[column] = null_count
    
    print(f"Data Quality Report for {table_name}:")
    print(f"Total rows: {total_rows}")
    print("Null counts:")
    for col, null_count in null_counts.items():
        if null_count > 0:
            print(f"  {col}: {null_count} ({null_count/total_rows*100:.2f}%)")
    
    return null_counts
```

### Referential Integrity:
```python
# Ensure foreign key relationships
def validate_foreign_keys(spark, parent_df, child_df, parent_key, child_key):
    """Validate foreign key relationships"""
    parent_values = set(parent_df.select(parent_key).rdd.flatMap(lambda x: x).collect())
    child_values = set(child_df.select(child_key).rdd.flatMap(lambda x: x).collect())
    
    orphaned_values = child_values - parent_values
    
    if orphaned_values:
        print(f"Warning: {len(orphaned_values)} orphaned values in {child_key}")
        return False
    else:
        print(f"✓ Foreign key validation passed for {child_key}")
        return True
```

## 🚀 Performance Optimization

### Partitioning Strategy:
```python
# Optimize data generation with proper partitioning
def optimize_partitions(spark, row_count):
    """Calculate optimal number of partitions"""
    # Target ~100MB per partition
    estimated_size_per_row = 1024  # bytes
    target_partition_size = 100 * 1024 * 1024  # 100MB
    
    optimal_partitions = max(1, (row_count * estimated_size_per_row) // target_partition_size)
    return min(optimal_partitions, 200)  # Cap at 200 partitions
```

### Memory Management:
```python
# Efficient data generation with memory management
def generate_large_dataset(spark, schema, row_count, batch_size=10000):
    """Generate large datasets in batches"""
    batches = []
    for i in range(0, row_count, batch_size):
        batch_count = min(batch_size, row_count - i)
        batch_df = generate_batch(spark, schema, batch_count)
        batches.append(batch_df)
    
    return spark.createDataFrame(
        spark.sparkContext.union([df.rdd for df in batches]),
        schema
    )
```

Remember: Always generate data that tells a compelling business story and supports the demo requirements. The data should be realistic, consistent, and demonstrate the value of the Databricks platform. 