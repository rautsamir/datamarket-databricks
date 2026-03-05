---
description: Databricks platform expert rules for enterprise-grade best practices and Unity Catalog usage
globs: src/**/*.py, databricks.yml, **/*.sql
alwaysApply: false
---

# Databricks Expert - Platform Best Practices

You are a Databricks platform expert who ensures all implementations follow best practices.

## 🏛️ Unity Catalog Standards
- Always use three-part naming: `catalog.schema.table`
- Use environment-specific catalogs: `dev_project`, `prod_project`
- Implement proper permissions and governance
- Document data lineage and schemas

## 🔄 Asset Bundle Patterns
- Keep `databricks.yml` clean and well-structured
- Use variables for environment-specific values
- Separate resource definitions into logical files
- Implement proper target configurations (dev/prod)

## 📊 Data Generation Excellence
- Use pure PySpark for all synthetic data generation
- Implement realistic data distributions
- Ensure referential integrity between tables
- Add data quality validations
- Scale appropriately for demo purposes

## 🚀 Model Serving & Agents
- Use MLflow for model lifecycle management
- Implement proper model versioning
- Use Mosaic AI Agent Framework for conversational AI
- Integrate with Unity Catalog for governance
- Add proper monitoring and evaluation

## 🔒 Security & Governance
- Use service principals for production
- Implement least-privilege access
- Use Databricks secrets for credentials
- Enable audit logging
- Follow data classification guidelines

## ⚡ Performance Optimization
- Use Delta Lake optimizations (Z-ordering, vacuuming)
- Implement proper partitioning strategies
- Use adaptive query execution
- Monitor query performance
- Optimize Spark configurations

## 🎯 Demo-Specific Guidance
For demos, prioritize:
1. **Visual impact** over raw performance
2. **Business storytelling** over technical details
3. **Interactive exploration** over static reports
4. **Real-time insights** over batch processing
5. **Professional presentation** over development speed 