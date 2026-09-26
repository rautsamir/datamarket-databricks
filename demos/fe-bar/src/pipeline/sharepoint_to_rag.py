"""SharePoint policy PDFs → bronze → parsed → chunks.

Bronze streams binary files through the Lakeflow Connect SharePoint connector,
so only new or changed PDFs flow downstream. Parsing and chunking are
streaming too, which keeps ai_parse_document cost proportional to new files.
"""

import json

import dlt
from pyspark.sql import functions as F
from pyspark.sql.types import ArrayType, StringType

SHAREPOINT_CONNECTION = spark.conf.get("datamarket.sharepoint_connection")
SHAREPOINT_URL = spark.conf.get("datamarket.sharepoint_url")
# Shared libraries hold more than the demo set; only matching files are ingested.
FILE_GLOB = spark.conf.get("datamarket.file_glob", "*.pdf")


@dlt.table(
    name="rag_docs_bronze",
    comment="Raw policy PDFs streamed from SharePoint via Lakeflow Connect.",
)
def rag_docs_bronze():
    return (
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "binaryFile")
        .option("databricks.connection", SHAREPOINT_CONNECTION)
        .option("pathGlobFilter", FILE_GLOB)
        .load(SHAREPOINT_URL)
        .selectExpr("*", "_metadata AS file_metadata")
    )


@dlt.table(
    name="rag_docs_parsed",
    comment="Document structure extracted with ai_parse_document, one row per PDF.",
)
@dlt.expect_or_drop("parsed", "parsed_content IS NOT NULL")
def rag_docs_parsed():
    return (
        spark.readStream.table("rag_docs_bronze")
        .selectExpr(
            "path",
            "file_metadata",
            "ai_parse_document(content) AS parsed_content",
        )
    )


def _extract_text(parsed_json):
    if not parsed_json:
        return None
    doc = (json.loads(parsed_json) or {}).get("document", {})
    parts = [p.get("content") for p in (doc.get("pages") or []) if p.get("content")]
    if not parts:
        # Newer ai_parse_document versions put text on elements, not pages.
        parts = [e.get("content") for e in (doc.get("elements") or []) if e.get("content")]
    return "\n\n".join(parts) or None


def _chunk_text(text, max_chars=2000, overlap=200):
    if not text:
        return []
    chunks, current = [], ""
    for block in text.split("\n\n"):
        if len(current) + len(block) > max_chars and current:
            chunks.append(current.strip())
            current = current[-overlap:]
        current += "\n\n" + block
    if current.strip():
        chunks.append(current.strip())
    return chunks


extract_text = F.udf(_extract_text, StringType())
chunk_text = F.udf(_chunk_text, ArrayType(StringType()))


@dlt.table(
    name="rag_docs_chunks",
    comment="Policy document text split into ~2,000 character chunks. Source for Vector Search and Genie.",
    # Vector Search Delta Sync indexes require Change Data Feed on the source.
    table_properties={"delta.enableChangeDataFeed": "true"},
)
@dlt.expect_or_drop("non_empty_chunk", "length(chunk) > 0")
def rag_docs_chunks():
    docs = (
        spark.readStream.table("rag_docs_parsed")
        .select(
            "path",
            "file_metadata",
            extract_text(F.to_json("parsed_content")).alias("full_text"),
        )
        .filter(F.col("full_text").isNotNull())
    )
    return (
        docs.withColumn("chunk", F.explode(chunk_text("full_text")))
        # Deterministic key so re-runs keep stable primary keys in the index.
        .withColumn("chunk_id", F.sha2(F.concat_ws("||", "path", "chunk"), 256))
        .select(
            "chunk_id",
            "path",
            F.col("file_metadata.file_path").alias("source_file"),
            "chunk",
        )
    )
