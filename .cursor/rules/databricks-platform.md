---
description: Databricks platform requirements and best practices for production apps
globs: src/app/app.js, src/app/**/*.js, databricks.yml, package.json
alwaysApply: false
---

# Databricks Platform Requirements & Best Practices

You are a Databricks platform expert who ensures apps follow production requirements and security best practices.

## 🚨 CRITICAL Platform Requirements

### **App Startup & Runtime:**
- **MUST bind to `0.0.0.0`** and port from `DATABRICKS_APP_PORT` environment variable
- **MUST shutdown within 15 seconds** after receiving `SIGTERM` signal
- **MUST support HTTP/2 cleartext (H2C)** - Databricks handles TLS termination
- **MUST log to stdout/stderr only** - never write logs to local files
- **NO privileged operations** - apps run as non-privileged users

### **Express.js Implementation:**
```javascript
const PORT = process.env.DATABRICKS_APP_PORT || process.env.PORT || 3000;

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Bind to correct host
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
});
```

## 🔒 Security Requirements

### **Authentication & Authorization:**
- **Use dedicated service principals** per app
- **Grant minimum permissions** (CAN USE instead of CAN MANAGE)
- **Never expose secrets** in environment variables
- **Use `valueFrom` in app config** for secret management

### **Network Security:**
- **Restrict outbound network access** to required domains only
- **Validate and sanitize ALL user input** 
- **Implement proper error handling** without exposing stack traces
- **Use parameterized SQL queries** to prevent injection

### **databricks.yml Configuration:**
```yaml
resources:
  apps:
    {{.project_name}}_app:
      name: {{.project_name}}-dashboard
      description: "{{.demo_description}}"
      source_code_path: ./src/app
      config:
        command: ["npm", "run", "start"]
      # Never expose secrets directly:
      # env:
      #   SECRET_KEY: 
      #     valueFrom: secret-scope/secret-key
```

## ⚡ Performance Best Practices

### **Minimize Startup Time:**
- **Keep initialization lightweight** - avoid blocking operations
- **Load heavy resources only when needed**
- **Pin dependency versions** in package.json
- **Use in-memory caching** for expensive operations

### **Resource Management:**
```javascript
// Example: Efficient caching
const cache = new Map();
const getCachedData = (key) => {
  if (!cache.has(key)) {
    cache.set(key, expensiveOperation(key));
  }
  return cache.get(key);
};
```

## 🏗️ Data Integration Best Practices

### **Use Databricks-Native Features:**
- **Databricks SQL** for queries and datasets
- **Lakeflow Jobs** for batch processing  
- **Model Serving** for AI inference workloads
- **Unity Catalog** for data governance

### **API Endpoint Patterns:**
```javascript
// Example: Proper data fetching
app.get('/api/data', async (req, res) => {
  try {
    // Use Databricks SQL connector
    const result = await databricksQuery(`
      SELECT * FROM ${catalog}.${schema}.table_name 
      WHERE condition = ?
    `, [req.query.filter]);
    
    res.json(result);
  } catch (error) {
    console.error('Query failed:', error.message);
    res.status(500).json({ error: 'Data fetch failed' });
  }
});
```

## 📦 Package.json Requirements

### **Required Scripts:**
```json
{
  "scripts": {
    "start": "node app.js",
    "build": "npm run build:client",
    "health": "curl -f http://localhost:$PORT/health || exit 1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## 🔍 Monitoring & Observability

### **Required Endpoints:**
```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version 
  });
});

// Structured logging
console.log(JSON.stringify({
  level: 'info',
  message: 'User action',
  userId: req.user?.id,
  action: 'data_query',
  timestamp: new Date().toISOString()
}));
```

## 🚫 Common Anti-Patterns to AVOID

- ❌ **Don't implement custom TLS handling**
- ❌ **Don't depend on request origin** (reverse proxy forwards requests)
- ❌ **Don't use blocking initialization** (large dependency installs)
- ❌ **Don't share service principal credentials** across apps
- ❌ **Don't expose raw secret values** in environment variables
- ❌ **Don't write logs to local files**
- ❌ **Don't ignore graceful shutdown signals**

## ✅ Template Compliance Checklist

When building Databricks Apps, ensure:
- [ ] App binds to `0.0.0.0:${DATABRICKS_APP_PORT}`
- [ ] Graceful shutdown handling implemented
- [ ] HTTP/2 cleartext support (automatic with Express.js)
- [ ] All logging goes to stdout/stderr
- [ ] Health check endpoint available
- [ ] Error handling without stack trace exposure
- [ ] Input validation and sanitization
- [ ] Dedicated service principal configuration
- [ ] Network access restrictions defined
- [ ] Performance optimization implemented

These requirements ensure your Databricks Apps are production-ready, secure, and performant on the Databricks platform.