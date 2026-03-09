---
description: Expert patterns for building Genie Spaces and deploying conversational AI agents with Databricks
globs: notebooks/**/*.py, src/**/*.py, **/*agent*.py
alwaysApply: false
---

# Genie Space & AI Agent Development - Expert Patterns

You are an expert in building Databricks Genie Spaces and deploying conversational AI agents using the Databricks Agent Framework.

## 🧠 Genie Space Creation & Configuration

### Core Principles:
- **Genie Spaces are SQL-based conversational interfaces** to Unity Catalog data
- **Permissions are critical** - Genie service principal needs SELECT on all tables
- **SQL Warehouse required** - Specify warehouse_id for query execution
- **Business context matters** - Add descriptions and sample questions

### Genie Space Setup Pattern:
```python
# 1. Create Genie Space via UI (preferred method)
# - Navigate to Genie Spaces in Databricks workspace
# - Select SQL Warehouse for query execution
# - Add Unity Catalog tables/schemas to scope
# - Configure business context and sample questions

# 2. Grant Permissions (CRITICAL STEP)
# Run SQL to grant access:
"""
GRANT SELECT ON SCHEMA catalog.schema TO `genie_service_principal`;
-- OR grant on individual tables:
GRANT SELECT ON TABLE catalog.schema.table TO `genie_service_principal`;
"""

# 3. Verify Genie Space Access
from databricks_langchain.genie import GenieAgent

genie_agent = GenieAgent(
    genie_space_id="your-genie-space-id",  # Get from Genie UI
    genie_agent_name="inventory-analyzer",
    description="Analyzes inventory data and provides recommendations"
)

# Test with sample query
test_query = "Show me stores with critical inventory issues"
response = genie_agent.invoke({"messages": [test_query]})
```

### Permission Troubleshooting:
```sql
-- Check current permissions
SHOW GRANTS ON SCHEMA catalog.schema;
SHOW GRANTS ON TABLE catalog.schema.table;

-- Common issues:
-- ❌ "User does not have access to table" → Grant SELECT permission
-- ❌ "Genie space cannot execute query" → Check SQL Warehouse access
-- ❌ "Table not found" → Verify three-part naming (catalog.schema.table)

-- Solution: Grant schema-level access (recommended)
GRANT SELECT ON SCHEMA catalog.schema TO `service_principal`;
```

## 🤖 AI Agent Development Patterns

### Modern Databricks Agent Framework:
```python
# Install required packages (exact versions matter)
%pip install -U -qqq mlflow-skinny[databricks] databricks-langchain databricks-agents langgraph-supervisor==0.0.29

# Core imports for agent development
from databricks_langchain import ChatDatabricks, DatabricksFunctionClient, UCFunctionToolkit
from databricks_langchain.genie import GenieAgent
from langgraph_supervisor import create_supervisor
from mlflow.pyfunc import ResponsesAgent
from mlflow.types.responses import ResponsesAgentRequest, ResponsesAgentResponse
```

### Multi-Agent Architecture Pattern:
```python
# Define agent structure
class Genie(BaseModel):
    space_id: str
    name: str
    task: str = "genie"
    description: str

# Create LangGraph supervisor with Genie integration
def create_multi_agent_system():
    """
    Best practice: LLM-powered supervisor with specialized agents
    - Supervisor routes queries intelligently (not hard-coded rules)
    - Genie agent handles data queries via SQL
    - LLM provides business analysis and recommendations
    """
    
    # Define Genie agent
    genie_agent = Genie(
        space_id="your-genie-space-id",
        name="inventory-genie",
        description="Analyzes store inventory data, identifies issues, and retrieves metrics"
    )
    
    # Define LLM for supervisor
    llm = ChatDatabricks(
        endpoint="databricks-meta-llama-3-1-70b-instruct",  # or Claude Sonnet 4
        max_tokens=4000,
        temperature=0.1  # Low temperature for consistent business advice
    )
    
    # Create supervisor agent
    supervisor_prompt = """You are a professional retail operations advisor.
    
    Your role:
    - Route data questions to inventory-genie agent
    - Analyze results and provide business recommendations
    - Format responses for executive audience
    - Include ROI and financial impact in recommendations
    
    Response format:
    1. Executive Summary (key finding)
    2. Analysis (data-driven insights)
    3. Root Cause (why this is happening)
    4. Recommendations (what to do, with timeline and ROI)
    """
    
    graph = create_supervisor(
        llm=llm,
        externally_served_agents=[genie_agent],
        prompt=supervisor_prompt
    )
    
    return graph
```

## 🚀 Model Serving Deployment

### Deployment Pattern (Following Official Databricks Pattern):
```python
import mlflow
from databricks import agents

# 1. Write agent code to file (not inline notebook code)
%%writefile your_agent.py
# Agent implementation here (see full pattern in notebooks/15_*.py)

# 2. Log model to MLflow with all resources
UC_MODEL_NAME = "catalog.schema.agent_name"

# Define all resources the agent needs access to
resources = []
resources.append(DatabricksSQLWarehouse(warehouse_id="your-warehouse-id"))
resources.extend([
    DatabricksTable(table_name="catalog.schema.table1"),
    DatabricksTable(table_name="catalog.schema.table2"),
    # Add all tables the Genie space needs
])
resources.append(DatabricksGenieSpace(genie_space_id="your-genie-id"))

# Add any UC functions/tools
for tool in TOOLS:
    if isinstance(tool, UnityCatalogTool):
        resources.append(DatabricksFunction(function_name=tool.uc_function_name))

with mlflow.start_run():
    logged_agent_info = mlflow.pyfunc.log_model(
        name="your_agent_name",
        python_model="your_agent.py",  # File path, not code
        resources=resources,
        pip_requirements=[
            "databricks-langchain",
            "langgraph",
            "langgraph-supervisor==0.0.29",
            "mlflow"
        ]
    )

# 3. Register to Unity Catalog
mlflow.set_registry_uri("databricks-uc")
uc_registered_model_info = mlflow.register_model(
    model_uri=logged_agent_info.model_uri, 
    name=UC_MODEL_NAME
)

# 4. Deploy to Model Serving (simple - no auth needed in deployment)
deployment_info = agents.deploy(
    UC_MODEL_NAME,
    uc_registered_model_info.version,
    tags={"endpointSource": "demo_project"}
)

print(f"✅ Agent deployed!")
print(f"Endpoint name: agents_{UC_MODEL_NAME.replace('.', '-')}")
```

### Agent Endpoint URL Pattern:
```python
# Model Serving endpoints follow this pattern:
# https://<workspace-url>/serving-endpoints/agents_<catalog>-<schema>-<model_name>/invocations

# Example:
# Model: your_catalog.your_schema.your_agent_name
# Endpoint: https://workspace.databricks.com/serving-endpoints/agents_your_catalog-your_schema-your_agent_name/invocations
```

## 📊 Agent Response Formatting

### Professional Business Response Pattern:
```python
# Clean and format agent responses for business users
def clean_agent_content(state):
    """Remove technical artifacts from agent responses"""
    msgs = state["messages"]
    if len(msgs) > 0:
        last_msg = msgs[-1]
        
        # Convert raw data tables to summaries
        if isinstance(last_msg.content, list):
            last_msg.content = "[Data analysis completed - see summary below]"
        
        # Remove technical markers
        if isinstance(last_msg.content, str):
            content = last_msg.content
            content = content.replace("<name>", "").replace("</name>", "")
            content = content.replace("Transferring back to supervisor", "")
            
            # Clean markdown table artifacts
            if "|---:" in content or "| |" in content:
                content = "[Analysis completed - results processed]"
            
            last_msg.content = content.strip()
    
    return {"messages": msgs}

# Use in agent graph
agent = create_react_agent(
    llm,
    tools=tools,
    name="data-agent",
    post_model_hook=clean_agent_content  # Clean responses before returning
)
```

### Business-Focused Prompts:
```python
# Professional advisor tone for retail operations
supervisor_prompt = f"""You are the DataMarket Intelligence Agent, a professional business advisor.

**Your Role:**
- Provide data-driven insights with clear business recommendations
- Focus on actionable solutions with ROI calculations
- Use professional, analytical tone appropriate for executives

**Response Framework:**
1. **Executive Summary** - Key finding in 1-2 sentences
2. **Analysis** - Data-driven insights with specific metrics
3. **Root Cause** - Why this is happening (planning constraints, vendor issues, etc.)
4. **Recommendations** - What to do about it (timeline, cost, ROI)

**Business Context:**
- SSIS (In-Stock): Target 85%+ for optimal performance
- DOS (Days of Supply): Target 60+ days for critical categories
- Crisis Thresholds: Red <85% SSIS, Yellow 85-90%, Green >90%

**Available Agents:**
{agent_descriptions}

Route data queries to appropriate agents, then synthesize results into executive-ready insights.
"""
```

## 🔍 Testing & Validation

### Comprehensive Agent Testing Pattern:
```python
# Test scenarios for different store health levels
test_scenarios = [
    {
        "name": "GREEN Store - High Performer",
        "query": "Analyze store #12345 performance",
        "expected": "optimization opportunities, maintain performance"
    },
    {
        "name": "ORANGE Store - At Risk",
        "query": "What's happening at store #67890?",
        "expected": "specific risk factors, intervention recommendations"
    },
    {
        "name": "RED Store - Critical",
        "query": "Store #04782 needs urgent help",
        "expected": "critical issues, immediate action plan with ROI"
    }
]

# Run validation tests
for scenario in test_scenarios:
    print(f"\n🧪 Testing: {scenario['name']}")
    
    response = agent.invoke({
        "messages": [scenario["query"]],
        "context": {"scenario": scenario["name"]}
    })
    
    print(f"Response: {response['messages'][-1].content[:200]}...")
    
    # Validate response quality
    assert len(response['messages'][-1].content) > 100, "Response too short"
    assert "recommendation" in response['messages'][-1].content.lower(), "Missing recommendations"
    
    print("✅ Test passed")
```

## 🎯 Key Patterns Summary

### DO's:
- ✅ **Create Genie Space via UI** (most reliable method)
- ✅ **Grant schema-level SELECT permissions** for all required tables
- ✅ **Use LLM-powered supervisor** for intelligent routing (not hard-coded)
- ✅ **Write agent code to file** (%%writefile pattern for deployment)
- ✅ **Include all resources** in MLflow logging (Genie spaces, warehouses, tables)
- ✅ **Clean agent responses** before returning to users
- ✅ **Test with multiple scenarios** (green/orange/red stores)
- ✅ **Use professional business tone** in prompts and responses

### DON'Ts:
- ❌ **Don't skip permission grants** - causes "access denied" errors
- ❌ **Don't hard-code routing logic** - use LLM supervisor instead
- ❌ **Don't return raw data tables** to users - summarize and format
- ❌ **Don't use technical jargon** - translate to business language
- ❌ **Don't deploy inline notebook code** - write to file first
- ❌ **Don't forget to specify SQL Warehouse** for Genie Space
- ❌ **Don't use production tokens in code** - use secrets or environment variables

## 🚨 Common Issues & Solutions

### Issue: "User does not have access to table"
**Cause:** Genie service principal lacks SELECT permission  
**Solution:** `GRANT SELECT ON SCHEMA catalog.schema TO principal;`

### Issue: Agent responses include raw SQL/tables
**Cause:** Missing response cleaning  
**Solution:** Add `post_model_hook=clean_agent_content` to agent

### Issue: Supervisor always routes to same agent
**Cause:** Agent descriptions not clear or missing  
**Solution:** Provide detailed agent descriptions with use cases

### Issue: Model Serving deployment fails
**Cause:** Inline notebook code or missing resources  
**Solution:** Use `%%writefile` pattern and include all resources

### Issue: Slow agent responses (>30 seconds)
**Cause:** Complex Genie queries or warehouse scaling  
**Solution:** Optimize SQL, use larger warehouse, or cache common queries

## 📚 Reference Notebooks

Based on this project's successful patterns:
- `notebooks/15_official_pattern_multi_agent.py` - Complete multi-agent implementation
- `notebooks/16_fix_genie_permissions.sql` - Permission grant patterns
- `notebooks/17_test_genie_permissions.py` - Validation tests
- `notebooks/18_deploy_with_personal_auth.py` - Deployment authentication

These patterns ensure production-ready, maintainable AI agents that provide real business value with professional presentation quality.

