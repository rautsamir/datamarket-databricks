---
description: Frontend integration patterns for calling Databricks Model Serving agents from React applications
globs: src/app/**/*.{js,jsx}, src/app/app.js
alwaysApply: false
---

# Frontend Agent Integration - Security & Architecture Patterns

You are an expert in securely integrating React frontends with Databricks Model Serving agents.

## 🏗️ Architecture Pattern: Backend Proxy (RECOMMENDED)

### Why Use a Backend Proxy?
- **Security**: Never expose Databricks tokens in frontend JavaScript
- **Flexibility**: Handle different auth methods (dev PAT vs production OAuth)
- **Simplicity**: Frontend doesn't need to manage authentication
- **Error Handling**: Centralized error handling and retry logic

### Three-Tier Architecture:
```
React Frontend → Express Backend Proxy → Databricks Model Serving
     ↓                    ↓                        ↓
  No Auth          Handles Auth           Agent Endpoint
  Simple API       OAuth/PAT               ResponsesAgent
```

## 🔐 Backend Proxy Implementation

### Express.js Proxy Endpoint Pattern:
```javascript
// app.js - Backend API proxy
app.post('/api/agent/chat', async (req, res) => {
  try {
    const { messages, context } = req.body;
    
    // Validate input
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid request: messages array required' 
      });
    }

    // Get authentication based on environment
    const isDatabricksApp = process.env.DATABRICKS_APP_PORT || process.env.DATABRICKS_RUNTIME_VERSION;
    let authHeaders = {};
    
    if (isDatabricksApp) {
      // Production: Service Principal OAuth
      const tokenResponse = await fetch(`https://${process.env.DATABRICKS_HOST}/oidc/v1/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          'grant_type': 'client_credentials',
          'scope': 'all-apis',
          'client_id': process.env.DATABRICKS_CLIENT_ID,
          'client_secret': process.env.DATABRICKS_CLIENT_SECRET
        })
      });
      
      const tokenData = await tokenResponse.json();
      authHeaders = {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      };
      
    } else {
      // Development: PAT token
      authHeaders = {
        'Authorization': `Bearer ${process.env.DATABRICKS_TOKEN}`,
        'Content-Type': 'application/json'
      };
    }

    // Format payload for ResponsesAgent
    const agentPayload = {
      input: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        type: "text"
      })),
      custom_inputs: context || {}
    };

    // Call Databricks Model Serving endpoint
    const agentEndpoint = 'https://<workspace>/serving-endpoints/agents_<catalog>-<schema>-<model>/invocations';
    
    const response = await fetch(agentEndpoint, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(agentPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        success: false,
        error: `Agent endpoint error: ${response.status}`,
        details: errorText
      });
    }

    const agentResponse = await response.json();
    
    // Return wrapped response
    res.json({
      success: true,
      response: agentResponse
    });

  } catch (error) {
    console.error('Agent proxy error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to communicate with agent',
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/agent/health', async (req, res) => {
  const isDatabricksApp = process.env.DATABRICKS_APP_PORT || process.env.DATABRICKS_RUNTIME_VERSION;
  
  // Check if authentication is configured
  const authConfigured = isDatabricksApp 
    ? !!(process.env.DATABRICKS_CLIENT_ID && process.env.DATABRICKS_CLIENT_SECRET)
    : !!process.env.DATABRICKS_TOKEN;
    
  if (!authConfigured) {
    return res.status(500).json({ 
      success: false, 
      error: 'Missing authentication credentials',
      environment: isDatabricksApp ? 'production' : 'development'
    });
  }
  
  res.json({ 
    success: true, 
    status: 'healthy',
    environment: isDatabricksApp ? 'production' : 'development'
  });
});
```

### Environment Variables:
```bash
# Development (Local)
DATABRICKS_TOKEN=your-personal-access-token

# Production (Databricks Apps)
DATABRICKS_HOST=your-workspace.cloud.databricks.com
DATABRICKS_CLIENT_ID=your-service-principal-client-id
DATABRICKS_CLIENT_SECRET=your-service-principal-secret
```

## 💻 Frontend API Client

### API Client Service Pattern:
```javascript
// src/services/datamarketAgentAPI.js
class DataMarketAgentAPI {
  constructor(endpointUrl = null, authToken = null) {
    // Always use backend proxy
    this.useProxy = true;
    this.endpointUrl = '/api/agent/chat';
    this.healthEndpoint = '/api/agent/health';
    
    // Store original params for debugging only (not used for auth)
    this.originalEndpoint = endpointUrl;
    this.sessionId = this.generateSessionId();
    this.conversationHistory = [];
    
    this.config = {
      timeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000,
      maxHistoryLength: 10
    };
  }

  async sendMessage(message, context = {}) {
    if (!message?.trim()) {
      throw new Error('Message cannot be empty');
    }

    // Add to conversation history
    this.conversationHistory.push({
      type: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    // Trim history if too long
    if (this.conversationHistory.length > this.config.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.config.maxHistoryLength);
    }

    try {
      // Format for ResponsesAgent API
      const response = await this._makeRequest({
        input: [
          {
            role: "user",
            content: message
          }
        ],
        custom_inputs: {
          ...context,
          session_id: this.sessionId,
          conversation_history: this.conversationHistory.slice(-5)
        }
      });

      // Add agent response to history
      this.conversationHistory.push({
        type: 'agent',
        content: response.message,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message: response.message,
        metadata: response.metadata || {},
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId
      };

    } catch (error) {
      console.error('Agent API Error:', error);
      
      return {
        success: false,
        error: error.message,
        message: this._getErrorMessage(error),
        timestamp: new Date().toISOString()
      };
    }
  }

  async _makeRequest(payload, attempt = 1) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      // Always use proxy - backend handles authentication
      const headers = { 'Content-Type': 'application/json' };
      const proxyPayload = {
        messages: payload.input,  // Array of {role, content} objects
        context: payload.custom_inputs || {}
      };

      const response = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(proxyPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      // Handle proxy response format
      if (data.success && data.response) {
        const agentResponse = data.response;
        
        // Handle ResponsesAgent output format
        if (agentResponse.output && Array.isArray(agentResponse.output)) {
          // Extract text from message items with nested content
          const textOutputs = agentResponse.output
            .filter(item => item.type === 'message' && item.content)
            .flatMap(item => item.content)
            .filter(content => content.type === 'output_text')
            .map(content => content.text)
            .join('\n\n');
          
          return { 
            message: textOutputs || 'No response received',
            metadata: agentResponse
          };
        }
        
        return { message: agentResponse, metadata: data };
      }
      
      // Fallback for other formats
      return { message: JSON.stringify(data) };

    } catch (error) {
      // Retry logic for network errors
      if (attempt < this.config.retryAttempts && this._shouldRetry(error)) {
        console.warn(`Request failed (attempt ${attempt}), retrying...`);
        await this._delay(this.config.retryDelay * attempt);
        return this._makeRequest(payload, attempt + 1);
      }
      
      throw error;
    }
  }

  async checkHealth() {
    try {
      const response = await fetch(this.healthEndpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        return {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          details: data
        };
      } else {
        return {
          status: 'unhealthy',
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  clearHistory() {
    this.conversationHistory = [];
    this.sessionId = this.generateSessionId();
  }

  getHistory() {
    return [...this.conversationHistory];
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  _shouldRetry(error) {
    return (
      error.name === 'AbortError' ||
      error.name === 'TypeError' ||
      error.message.includes('5')
    );
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _getErrorMessage(error) {
    if (error.name === 'AbortError') {
      return '⏱️ Request timeout. The agent is taking longer than usual. Please try again.';
    }
    if (error.message.includes('401') || error.message.includes('403')) {
      return '🔐 Authentication error. Please contact your system administrator.';
    }
    if (error.message.includes('404')) {
      return '🔍 Service not found. The agent endpoint may not be deployed.';
    }
    if (error.message.includes('5')) {
      return '⚠️ Service error. Please try again in a few moments.';
    }
    return `❌ Unexpected error: ${error.message}`;
  }
}

export default DataMarketAgentAPI;
```

### React Hook for Agent:
```javascript
// React Hook wrapper
export const useDataMarketAgent = (endpointUrl = null, authToken = null) => {
  const [agent] = React.useState(() => {
    // Backend handles all authentication - no validation needed
    return new DataMarketAgentAPI(endpointUrl, authToken);
  });

  const [connectionStatus, setConnectionStatus] = React.useState('disconnected');

  React.useEffect(() => {
    const checkHealth = async () => {
      setConnectionStatus('connecting');
      const health = await agent.checkHealth();
      setConnectionStatus(health.status === 'healthy' ? 'connected' : 'error');
    };

    checkHealth();
    const healthCheckInterval = setInterval(checkHealth, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(healthCheckInterval);
  }, [agent]);

  const sendMessage = React.useCallback(async (message, context = {}) => {
    if (!agent) {
      return {
        success: false,
        error: 'Agent not initialized'
      };
    }
    return await agent.sendMessage(message, context);
  }, [agent]);

  return {
    sendMessage,
    clearHistory: () => agent.clearHistory(),
    getHistory: () => agent.getHistory(),
    connectionStatus,
    isAvailable: !!agent && connectionStatus === 'connected'
  };
};
```

## 🎨 React Component Integration

### Chat Interface Usage:
```javascript
// src/components/ChatInterface.jsx
import { useDataMarketAgent } from '../services/datamarketAgentAPI';

const ChatInterface = ({ storeData, isOpen, onToggle }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Use the agent hook (no auth params needed - backend handles it)
  const { 
    sendMessage: sendAgentMessage, 
    connectionStatus, 
    isAvailable 
  } = useDataMarketAgent();
  
  const sendMessage = async (message = inputValue) => {
    if (!message.trim() || isLoading || !isAvailable) return;
    
    // Add user message to UI
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: message.trim(),
      timestamp: new Date(),
      status: 'sent'
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    try {
      // Prepare context with store data
      const context = storeData ? {
        store_number: storeData.store_number,
        store_name: storeData.store_name,
        city: storeData.city,
        state: storeData.state,
        health_status: storeData.health_status,
        inventory_data: storeData.inventory_summary
      } : {};
      
      // Call agent API
      const result = await sendAgentMessage(message, context);
      
      // Add agent response to UI
      const agentMessage = {
        id: Date.now() + 1,
        type: 'agent',
        content: result.message,
        timestamp: new Date(),
        status: result.success ? 'delivered' : 'error'
      };
      
      setMessages(prev => [...prev, agentMessage]);
      
    } catch (error) {
      console.error('Chat error:', error);
      
      // Add error message
      const errorMessage = {
        id: Date.now() + 1,
        type: 'agent',
        content: `❌ Error: ${error.message}`,
        timestamp: new Date(),
        status: 'error'
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="chat-interface">
      {/* Connection status indicator */}
      <div className={`connection-status ${connectionStatus}`}>
        {connectionStatus === 'connected' ? '🟢' : '🔴'} {connectionStatus}
      </div>
      
      {/* Messages display */}
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.type}`}>
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        ))}
      </div>
      
      {/* Input area */}
      <div className="input-area">
        <input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
          disabled={!isAvailable || isLoading}
          placeholder={isAvailable ? "Ask about this store..." : "Connecting..."}
        />
        <button 
          onClick={() => sendMessage()} 
          disabled={!isAvailable || isLoading}
        >
          {isLoading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
};
```

## 🎯 Key Patterns Summary

### DO's:
- ✅ **Use backend proxy** for all agent calls (never expose tokens in frontend)
- ✅ **Handle environment-specific auth** (PAT for dev, OAuth for production)
- ✅ **Include store context** in agent calls for personalized responses
- ✅ **Implement retry logic** for network errors
- ✅ **Show connection status** to users
- ✅ **Parse ResponsesAgent output format** correctly (nested message/content structure)
- ✅ **Validate inputs** before sending to agent
- ✅ **Provide user-friendly error messages**

### DON'Ts:
- ❌ **Don't expose Databricks tokens** in frontend code
- ❌ **Don't call Model Serving directly** from browser
- ❌ **Don't skip health checks** - monitor connection status
- ❌ **Don't ignore retry logic** - networks are unreliable
- ❌ **Don't forget timeout handling** - agents can be slow
- ❌ **Don't hardcode endpoint URLs** - use environment variables
- ❌ **Don't skip error handling** - provide fallbacks

## 📚 Response Format Parsing

### ResponsesAgent Output Structure:
```javascript
// Agent returns this structure:
{
  output: [
    {
      type: "message",
      content: [
        {
          type: "output_text",
          text: "The actual response text here..."
        }
      ]
    }
  ]
}

// Parse with this pattern:
const textOutputs = agentResponse.output
  .filter(item => item.type === 'message' && item.content)
  .flatMap(item => item.content)
  .filter(content => content.type === 'output_text')
  .map(content => content.text)
  .join('\n\n');
```

## 🔒 Security Best Practices

1. **Never store tokens in:**
   - Frontend JavaScript code
   - Browser localStorage/sessionStorage
   - Git repositories
   - Client-side environment variables

2. **Always use:**
   - Backend proxy for authentication
   - Environment variables for credentials
   - Service Principal OAuth in production
   - PAT tokens only for development
   - HTTPS for all connections

3. **Environment separation:**
   ```javascript
   // Detect environment
   const isDatabricksApp = process.env.DATABRICKS_APP_PORT || 
                           process.env.DATABRICKS_RUNTIME_VERSION;
   
   // Use appropriate auth method
   if (isDatabricksApp) {
     // Production: OAuth with Service Principal
   } else {
     // Development: PAT token
   }
   ```

These patterns ensure secure, maintainable frontend integration with Databricks Model Serving agents.

