#!/usr/bin/env python3
"""
DataMarket — Sample Data Generation
Generates sample Unity Catalog tables that can be registered as data products
in the DataMarket catalog. Configure via environment variables.
"""

import os
import random
from datetime import datetime, timedelta
from pyspark.sql import SparkSession
from pyspark.sql.types import (
    StructType, StructField, LongType, StringType, DoubleType,
    TimestampType, IntegerType
)


def create_spark_session():
    return (
        SparkSession.builder
        .appName("datamarket_sample_data")
        .config("spark.sql.adaptive.enabled", "true")
        .getOrCreate()
    )


def random_timestamp(start_days_ago=365, end_days_ago=0):
    delta = timedelta(days=random.randint(end_days_ago, start_days_ago))
    return datetime.now() - delta


def generate_revenue_summary(spark, num_rows=200):
    regions = ["West", "East", "Central", "South"]
    units = ["Engineering", "Sales", "Operations", "Finance", "IT"]
    rows = []
    for i in range(num_rows):
        rows.append((
            i + 1,
            random.choice(units),
            random.choice(regions),
            random_timestamp(365, 0),
            round(random.uniform(50_000, 5_000_000), 2),
            round(random.uniform(40_000, 4_800_000), 2),
        ))
    schema = StructType([
        StructField("record_id", LongType(), False),
        StructField("business_unit", StringType()),
        StructField("region", StringType()),
        StructField("period_date", TimestampType()),
        StructField("budgeted_amount", DoubleType()),
        StructField("actual_amount", DoubleType()),
    ])
    return spark.createDataFrame(rows, schema)


def generate_service_requests(spark, num_rows=500):
    categories = ["IT Support", "Facilities", "HR", "Finance", "General"]
    statuses = ["Open", "In Progress", "Resolved", "Closed"]
    priorities = ["Low", "Medium", "High", "Critical"]
    rows = []
    for i in range(num_rows):
        rows.append((
            i + 1,
            f"SR-{i+1:05d}",
            random.choice(categories),
            random.choice(priorities),
            random.choice(statuses),
            random_timestamp(180, 0),
            random.randint(1, 30) if random.random() > 0.3 else None,
        ))
    schema = StructType([
        StructField("request_id", LongType(), False),
        StructField("request_number", StringType()),
        StructField("category", StringType()),
        StructField("priority", StringType()),
        StructField("status", StringType()),
        StructField("created_at", TimestampType()),
        StructField("resolution_days", IntegerType(), True),
    ])
    return spark.createDataFrame(rows, schema)


def main():
    catalog = os.getenv("CATALOG_NAME", "your_catalog")
    schema = os.getenv("SCHEMA_NAME", "datamarket")

    print(f"Generating sample data into {catalog}.{schema}")
    spark = create_spark_session()

    try:
        spark.sql(f"CREATE CATALOG IF NOT EXISTS {catalog}")
        spark.sql(f"CREATE SCHEMA IF NOT EXISTS {catalog}.{schema}")
    except Exception as e:
        print(f"Warning: {e}")

    tables = {
        "revenue_summary": generate_revenue_summary(spark),
        "service_requests": generate_service_requests(spark),
    }

    for name, df in tables.items():
        table = f"{catalog}.{schema}.{name}"
        print(f"Writing {table} ({df.count()} rows)...")
        df.write.format("delta").mode("overwrite").saveAsTable(table)
        print(f"Done: {table}")

    spark.stop()
    print("Sample data generation complete.")


if __name__ == "__main__":
    main()
