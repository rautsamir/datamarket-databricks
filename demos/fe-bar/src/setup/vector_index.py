# Databricks notebook source
# MAGIC %md
# MAGIC # Vector Search index over policy document chunks
# MAGIC
# MAGIC Creates (or syncs) a Delta Sync index on `rag_docs_chunks` so semantic
# MAGIC search stays current as the pipeline adds documents. Safe to re-run.

# COMMAND ----------

dbutils.widgets.text("catalog", "demo")
dbutils.widgets.text("schema", "sled_datamarket_docs")
dbutils.widgets.text("vs_endpoint", "sled_sharepoint_vs")
dbutils.widgets.text("embedding_endpoint", "databricks-gte-large-en")

catalog = dbutils.widgets.get("catalog")
schema = dbutils.widgets.get("schema")
vs_endpoint = dbutils.widgets.get("vs_endpoint")
embedding_endpoint = dbutils.widgets.get("embedding_endpoint")

source_table = f"{catalog}.{schema}.rag_docs_chunks"
index_name = f"{catalog}.{schema}.rag_docs_chunks_index"

# COMMAND ----------

from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
from databricks.sdk.service.vectorsearch import (
    DeltaSyncVectorIndexSpecRequest,
    EmbeddingSourceColumn,
    EndpointType,
    PipelineType,
    VectorIndexType,
)

w = WorkspaceClient()

try:
    w.vector_search_endpoints.get_endpoint(vs_endpoint)
    print(f"Endpoint {vs_endpoint} exists")
except NotFound:
    print(f"Creating endpoint {vs_endpoint} (takes several minutes)")
    w.vector_search_endpoints.create_endpoint_and_wait(
        name=vs_endpoint, endpoint_type=EndpointType.STANDARD
    )

# COMMAND ----------

try:
    w.vector_search_indexes.get_index(index_name)
    print(f"Index {index_name} exists — triggering sync")
    w.vector_search_indexes.sync_index(index_name)
except NotFound:
    print(f"Creating index {index_name} on {source_table}")
    w.vector_search_indexes.create_index(
        name=index_name,
        endpoint_name=vs_endpoint,
        primary_key="chunk_id",
        index_type=VectorIndexType.DELTA_SYNC,
        delta_sync_index_spec=DeltaSyncVectorIndexSpecRequest(
            source_table=source_table,
            pipeline_type=PipelineType.TRIGGERED,
            embedding_source_columns=[
                EmbeddingSourceColumn(
                    name="chunk", embedding_model_endpoint_name=embedding_endpoint
                )
            ],
            columns_to_sync=["chunk_id", "source_file", "chunk"],
        ),
    )

# COMMAND ----------

dbutils.notebook.exit(index_name)
