#!/usr/bin/env python3
"""
DataMarket — Data Generation Script
Generates synthetic data for Databricks demo using PySpark.
Configure via environment variables: CATALOG_NAME, SCHEMA_NAME, DATA_SCALE.
"""

import os
import sys
import random
from datetime import datetime, timedelta
from pyspark.sql import SparkSession
from pyspark.sql.types import *

def create_spark_session():
    spark = SparkSession.builder \
        .appName("datamarket_data_generation") \
        .config("spark.sql.adaptive.enabled", "true") \
        .config("spark.sql.ansi.enabled", "false") \
        .getOrCreate()
    return spark

def generate_retail_data(spark, data_scale="medium"):
    """Generate retail data using pure PySpark"""
    
    scale_map = {"small": 100, "medium": 1000, "large": 10000}
    num_customers = scale_map.get(data_scale, 1000)
    
    print(f"🎯 Generating {num_customers} customer records...")
    
    # Generate customer data
    customers = []
    first_names = ["John", "Jane", "Michael", "Sarah", "David", "Lisa"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones"]
    cities = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"]
    
    for i in range(num_customers):
        customers.append((
            i + 1,  # customer_id
            random.choice(first_names),  # first_name
            random.choice(last_names),   # last_name
            f"user{i}@example.com",      # email
            random.choice(cities),       # city
            round(random.uniform(100, 10000), 2)  # total_spent
        ))
    
    # Create schema and DataFrame
    schema = StructType([
        StructField("customer_id", LongType(), False),
        StructField("first_name", StringType(), True),
        StructField("last_name", StringType(), True),
        StructField("email", StringType(), True),
        StructField("city", StringType(), True),
        StructField("total_spent", DoubleType(), True)
    ])
    
    customers_df = spark.createDataFrame(customers, schema)
    
    return {"customers": customers_df}

def write_to_databricks(spark, dataframes, catalog, schema):
    """Write dataframes to Databricks Unity Catalog"""
    
    print(f"💾 Writing data to Unity Catalog: {catalog}.{schema}")
    
    try:
        spark.sql(f"CREATE CATALOG IF NOT EXISTS {catalog}")
        spark.sql(f"CREATE SCHEMA IF NOT EXISTS {catalog}.{schema}")
    except Exception as e:
        print(f"⚠️  Warning: {str(e)}")
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    for table_name, df in dataframes.items():
        full_table_name = f"{catalog}.{schema}.{table_name}_synthetic_{timestamp}"
        print(f"📝 Writing {table_name} to {full_table_name}...")
        
        df.write.format("delta").mode("overwrite").saveAsTable(full_table_name)
        
        row_count = df.count()
        print(f"✅ Created {table_name} with {row_count} rows")
        df.show(5, truncate=False)

def main():
    """Main data generation function"""
    
    industry = os.getenv("INDUSTRY", "finance")
    data_scale = os.getenv("DATA_SCALE", "medium") 
    catalog = os.getenv("CATALOG_NAME", "your_catalog")
    schema = os.getenv("SCHEMA_NAME", "datamarket")
    
    print(f"🚀 Starting data generation")
    print(f"📊 Scale: {data_scale}, Target: {catalog}.{schema}")
    
    spark = create_spark_session()
    
    try:
        dataframes = generate_retail_data(spark, data_scale)
        write_to_databricks(spark, dataframes, catalog, schema)
        print("✅ Data generation completed successfully!")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        spark.stop()

if __name__ == "__main__":
    main()
