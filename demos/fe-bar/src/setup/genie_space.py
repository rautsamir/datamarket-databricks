# Databricks notebook source
# MAGIC %md
# MAGIC # Genie space over the policy document tables
# MAGIC
# MAGIC Builds the space from `../genie/space.template.json` and creates it, or
# MAGIC updates it in place when a space with the same title already exists, so
# MAGIC the space URL registered in DataMarket stays stable across runs.

# COMMAND ----------

dbutils.widgets.text("catalog", "demo")
dbutils.widgets.text("schema", "sled_datamarket_docs")
dbutils.widgets.text("warehouse_id", "")
dbutils.widgets.text("genie_title", "DataMarket — County Policy Documents")

catalog = dbutils.widgets.get("catalog")
schema = dbutils.widgets.get("schema")
warehouse_id = dbutils.widgets.get("warehouse_id")
title = dbutils.widgets.get("genie_title")

# COMMAND ----------

import json
import os
import uuid

from databricks.sdk import WorkspaceClient

with open(os.path.join(os.getcwd(), "..", "genie", "space.template.json")) as f:
    raw = f.read().replace("{{catalog}}", catalog).replace("{{schema}}", schema)
template = json.loads(raw)


def new_id():
    return uuid.uuid4().hex


# The Genie API expects tables sorted by identifier and ids as 32-char hex.
serialized_space = {
    "version": 2,
    "config": {
        "sample_questions": sorted(
            [{"id": new_id(), "question": [q]} for q in template["sample_questions"]],
            key=lambda x: x["id"],
        )
    },
    "data_sources": {
        "tables": sorted(
            [
                {
                    "identifier": t["identifier"],
                    "column_configs": sorted(
                        [
                            {"column_name": col, "description": [desc]}
                            for col, desc in t["columns"].items()
                        ],
                        key=lambda c: c["column_name"],
                    ),
                }
                for t in template["tables"]
            ],
            key=lambda t: t["identifier"],
        )
    },
    "instructions": {
        "text_instructions": [
            {"id": new_id(), "content": [line + "\n" for line in template["instructions"]]}
        ],
        "example_question_sqls": sorted(
            [
                {"id": new_id(), "question": [e["question"]], "sql": [e["sql"]]}
                for e in template["example_sqls"]
            ],
            key=lambda x: x["id"],
        ),
    },
}

# COMMAND ----------

w = WorkspaceClient()
me = w.current_user.me().user_name

body = {
    "title": title,
    "description": template["description"],
    "warehouse_id": warehouse_id,
    "parent_path": f"/Users/{me}",
    "serialized_space": json.dumps(serialized_space),
}


def find_space(title):
    token = None
    while True:
        query = {"page_token": token} if token else {}
        page = w.api_client.do("GET", "/api/2.0/genie/spaces", query=query)
        for space in page.get("spaces", []):
            if space.get("title") == title:
                return space["space_id"]
        token = page.get("next_page_token")
        if not token:
            return None


space_id = find_space(title)
if space_id:
    w.api_client.do("PATCH", f"/api/2.0/genie/spaces/{space_id}", body=body)
    print(f"Updated Genie space {space_id}")
else:
    space_id = w.api_client.do("POST", "/api/2.0/genie/spaces", body=body)["space_id"]
    print(f"Created Genie space {space_id}")

url = f"{w.config.host.rstrip('/')}/genie/rooms/{space_id}"
print(url)
dbutils.notebook.exit(url)
