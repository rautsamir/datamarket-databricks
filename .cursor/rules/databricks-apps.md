---
description: Expert guidelines for Databricks Apps development with React, Vite, and modern web technologies
globs: src/app/**/*.{js,jsx,ts,tsx,json}, *.{js,jsx,ts,tsx}, databricks.yml, package.json, vite.config.js
alwaysApply: false
---

# Databricks Apps Development - Expert Guidelines

You are a Databricks Apps expert who builds modern, production-ready web applications that integrate seamlessly with Databricks data platform.

## 🎯 Databricks Apps Architecture

### Core Technologies Stack:
- **Frontend**: React 18 + Vite + TypeScript/JSX
- **UI Framework**: shadcn/ui + Tailwind CSS + Radix UI
- **Backend**: Express.js (ES modules)
- **Build Tool**: Vite for fast development and optimized production builds
- **Styling**: Databricks design system colors and components

### Application Structure:
```
src/app/
├── src/                     # React source code
│   ├── components/         # Reusable components
│   │   ├── ui/            # shadcn/ui components (Badge, Button, Card, etc.)
│   │   ├── layout/        # ResponsiveLayout (single layout system)
│   │   ├── DatabricksCard.jsx
│   │   ├── DatabricksChart.jsx
│   │   └── DatabricksLogo.jsx.tmpl
│   ├── pages/             # Page components (ChatPage, CustomerSegmentationPage, etc.)
│   ├── config/            # Centralized configuration
│   │   └── navigation.js  # Single source of truth for navigation
│   ├── lib/               # Utilities (utils.js)
│   ├── styles/            # CSS files (index.css, responsive.css)
│   └── main.jsx          # React entry point
├── dist/                  # Vite build output (auto-generated)
├── public/               # Static assets (favicon, images)
├── app.js               # Express server (ES modules)
├── package.json         # Dependencies and scripts
├── vite.config.js       # Vite configuration
└── tailwind.config.js   # Tailwind configuration
```

## 🚀 Development Workflow

### **🚨 CRITICAL: Databricks Apps Deployment Rules**

#### **❌ NEVER Create app.yaml for Standard Node.js Apps**
- **Problem**: Custom `app.yaml` files force npm commands that often fail during installation
- **Solution**: Let Databricks auto-detect Node.js behavior (works much better)
- **Rule**: Only include `app.yaml` for non-standard deployment requirements

#### **✅ Correct databricks.yml Configuration:**
```yaml
resources:
  apps:
    your_app_name:
      name: your-app-dashboard  
      description: "Your Analytics Dashboard"
      source_code_path: ./src/app
      # No config section needed - Databricks handles it automatically
```

#### **🔧 Standard Deployment Workflow:**
```bash
# 1. Deploy the bundle (creates compute resources)
databricks bundle deploy

# 2. Run the app (deploys and starts the application code)  
databricks bundle run your_app_name

# 3. Check status
databricks apps list
```

### Local Development:
```bash
# Install dependencies
npm install

# Development mode (React dev server + Express)
npm run start:dev

# Production build and serve
npm run start

# Build only
npm run build

# Server only
npm run server
```

### Key Scripts:
- `npm run dev` - Vite dev server (frontend only)
- `npm run build` - Production build
- `npm run start` - Build + start Express server
- `npm run start:dev` - Concurrent dev mode with hot reload
- `npm run server` - Start Express server only

## 📊 Data Integration Patterns

### API Endpoints Structure:
```javascript
// Express routes for data endpoints
app.get('/api/health', healthCheck)
app.get('/api/kpis', getKPIs)
app.get('/api/trends', getTrends)
app.get('/api/segments', getSegments)
app.get('/api/chat', getChatData)
```

### Frontend Data Fetching:
```javascript
// React component data fetching
useEffect(() => {
  const fetchData = async () => {
    try {
      const [kpisRes, trendsRes, segmentsRes] = await Promise.all([
        fetch('/api/kpis'),
        fetch('/api/trends'),
        fetch('/api/segments')
      ])
      // Handle responses...
    } catch (error) {
      console.error('Failed to fetch data:', error)
      // Fallback to mock data for development
    }
  }
  fetchData()
}, [])
```

### Databricks SQL Integration:
```javascript
// Example: Query Unity Catalog tables
const getKPIs = async (req, res) => {
  try {
    // Connect to Databricks SQL warehouse
    const sql = `
      SELECT 
        SUM(total_spent) as total_revenue,
        COUNT(DISTINCT customer_id) as total_customers,
        AVG(total_spent) as avg_order_value
      FROM ${catalog}.${schema}.customers_synthetic_*
    `
    // Execute query and return results
  } catch (error) {
    // Return mock data for development
  }
}
```

## 🎨 UI/UX Guidelines

### Databricks Design System:
```javascript
// tailwind.config.js - Databricks colors
theme: {
  extend: {
    colors: {
      'databricks-red': '#FF3621',
      'databricks-dark': '#1B3139', 
      'databricks-green': '#00A972',
      'databricks-orange': '#FFA500',
      'databricks-blue': '#0073E6',
    }
  }
}
```

### Component Patterns:
- **DatabricksCard**: KPI cards with trend indicators
- **DatabricksChart**: Recharts integration with Databricks styling
- **ResponsiveLayout**: Adaptive layout for desktop/mobile
- **Chat Interface**: AI assistant integration

### Responsive Design:
```jsx
// Mobile-first responsive approach
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <DatabricksCard 
    title="Total Revenue"
    value={kpis?.total_revenue?.value}
    trend={kpis?.total_revenue?.trend}
    icon={DollarSign}
  />
</div>
```

## 🔧 Production Deployment

### Build Process:
1. **Development**: `npm run start:dev` (React dev + Express)
2. **Production Build**: `npm run build` (creates optimized dist/)
3. **Production Serve**: `npm run start` (serves built files)

### Databricks Apps Deployment:
```yaml
# databricks.yml - App resource
resources:
  apps:
    {{.project_name}}_app:
      name: {{.project_name}}-dashboard
      description: "{{.demo_description}}"
      source_code_path: ./src/app
```

### Performance Optimization:
- **Vite**: Fast HMR and optimized production builds
- **Code Splitting**: Automatic with Vite
- **Asset Optimization**: Built-in minification and compression
- **Static Assets**: Served efficiently via Express static middleware

## 🔒 Security & CSP

### Content Security Policy:
```javascript
// app.js - Helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}))
```

## 🔧 **Codebase Modification Guide**

### **🧭 Adding New Navigation Items**

#### **Step 1: Update Navigation Configuration**
Edit `src/config/navigation.js` to add new navigation items:

```javascript
// Add to primaryNavigation array
{
  id: 'new-feature',
  name: 'New Feature',
  href: 'new-feature',
  icon: YourIcon, // Import from lucide-react
  badge: 'New',
  description: 'Description for accessibility',
  disabled: false
}
```

#### **Step 2: Add Route in App.jsx**
Update the switch statement in `src/App.jsx`:

```javascript
case 'new-feature':
  return <NewFeaturePage />
```

#### **Step 3: Navigation Changes Propagate Automatically**
- ResponsiveLayout automatically uses centralized navigation
- No need to update multiple components
- Changes reflect immediately in both mobile and desktop

### **📄 Adding New Pages**

#### **Step 1: Create Page Component**
Create new file in `src/pages/YourNewPage.jsx`:

```javascript
import React from 'react'
import { DatabricksCard } from '../components/DatabricksCard'
import { DatabricksChart } from '../components/DatabricksChart'

export function YourNewPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Your New Feature</h1>
      {/* Your page content */}
    </div>
  )
}
```

#### **Step 2: Import in App.jsx**
Add import and route case:

```javascript
import { YourNewPage } from './pages/YourNewPage'

// In renderPage() switch statement
case 'your-new-feature':
  return <YourNewPage />
```

### **🎨 Adding New Components**

#### **Main Components**: Place in `src/components/`
```javascript
// src/components/YourComponent.jsx
import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function YourComponent({ data }) {
  return (
    <Card>
      {/* Component content */}
    </Card>
  )
}
```

#### **UI Components**: Use existing shadcn/ui components
- Located in `src/components/ui/`
- Import with `@/components/ui/component-name`
- Pre-configured with Databricks design system

### **📊 Modifying Data Sources**

#### **Backend API Updates** (app.js):
```javascript
// Add new API endpoint
app.get('/api/your-data', async (req, res) => {
  try {
    // TODO: Replace with actual Databricks query
    const data = await queryDatabricks(`
      SELECT * FROM ${catalog}.${schema}.your_table
    `)
    res.json(data)
  } catch (error) {
    // Fallback mock data for development
    res.json(mockData)
  }
})
```

#### **Frontend Data Fetching**:
```javascript
// In your page component
useEffect(() => {
  const fetchData = async () => {
    try {
      const response = await fetch('/api/your-data')
      const data = await response.json()
      setData(data)
    } catch (error) {
      console.error('Failed to fetch data:', error)
      setData(mockData) // Always provide fallback
    }
  }
  fetchData()
}, [])
```

### **🎯 Navigation Architecture Rules**

#### **DO:**
- ✅ **Always update navigation in `src/config/navigation.js`**
- ✅ **Use the centralized `isNavigationItemActive` helper**
- ✅ **Import navigation with destructuring**: `{ primaryNavigation, secondaryNavigation }`
- ✅ **Use permissions array for admin-only features**
- ✅ **Add descriptive tooltips for accessibility**

#### **DON'T:**
- ❌ **Never hardcode navigation arrays in components**
- ❌ **Don't create custom navigation logic** - use helpers
- ❌ **Avoid bypassing the centralized system**
- ❌ **Don't forget to add new pages to App.jsx routing**

## 📱 Features & Capabilities

### Core Features:
- **Dashboard**: KPI cards, charts, trends
- **Chat Interface**: AI assistant integration  
- **Customer Segmentation**: Interactive CLV analysis with drill-down
- **Demand Forecasting**: AI-driven predictions with cost impact
- **Responsive Design**: Mobile-friendly layout
- **Real-time Data**: API integration with Databricks
- **Modern UI**: shadcn/ui components with Databricks branding

### Advanced Features:
- **Centralized Navigation**: Single source of truth eliminates duplication
- **Interactive Demos**: Click-to-explore functionality
- **Professional Visualizations**: Comprehensive charts and metrics
- **Error Boundaries**: Graceful error handling
- **Loading States**: Smooth user experience
- **Fallback Data**: Development-friendly mock data

## 🚨 Common Patterns & Best Practices

### Error Handling:
```javascript
// Always provide fallback data
try {
  const data = await fetch('/api/data')
  setData(await data.json())
} catch (error) {
  console.error('API Error:', error)
  setData(mockData) // Fallback for development
}
```

### Environment Configuration:
```javascript
// Use environment variables for configuration
const API_BASE = process.env.REACT_APP_API_BASE || ''
const DATABRICKS_HOST = process.env.DATABRICKS_HOST
```

### Bundle Optimization:
```gitignore
# .databricksignore - Exclude from bundle uploads
node_modules/
dist/
*.log
.env*
```

## 🎯 Development Guidelines

### **🚀 Quick Start Workflow**
1. **Always start with `npm run start:dev`** for development (React dev + Express)
2. **Build with `npm run build`** before deployment testing
3. **Use centralized navigation** - never hardcode navigation arrays
4. **Import shadcn/ui components** with `@/components/ui/` alias
5. **Follow Databricks color scheme** in custom components
6. **Implement responsive design** with Tailwind CSS classes
7. **Provide fallback data** for offline development
8. **Test production build locally** before deploying

### **🔄 Common Development Tasks**

#### **Adding a New Dashboard Page:**
```bash
# 1. Create page component
touch src/pages/YourNewPage.jsx

# 2. Add navigation item to src/config/navigation.js
# 3. Add route case to src/App.jsx
# 4. Import page component in App.jsx
```

#### **Customizing Existing Pages:**
- **Overview**: Modify `src/App.jsx` dashboard content
- **Customer Segmentation**: Edit `src/pages/CustomerSegmentationPage.jsx.tmpl`
- **Demand Forecasting**: Edit `src/pages/DemandForecastingPage.jsx.tmpl`
- **Chat**: Update `src/pages/ChatPage.jsx`

#### **Adding New API Endpoints:**
```javascript
// In app.js - add after existing endpoints
app.get('/api/your-endpoint', async (req, res) => {
  try {
    // Query Databricks or return mock data
    res.json(data)
  } catch (error) {
    res.json(fallbackData)
  }
})
```

#### **Styling Updates:**
- **Colors**: Update `tailwind.config.js.tmpl` 
- **Components**: Use existing Databricks design tokens
- **Layout**: Modify `src/components/layout/ResponsiveLayout.jsx`
- **Global Styles**: Edit `src/styles/index.css`

### **🧭 Navigation Management**

#### **Primary Navigation** (Main features):
```javascript
// src/config/navigation.js - primaryNavigation array
{
  id: 'unique-id',
  name: 'Display Name',
  href: 'url-slug',
  icon: LucideIcon,
  badge: 'Optional', 
  description: 'For accessibility'
}
```

#### **Secondary Navigation** (Admin features):
```javascript
// src/config/navigation.js - secondaryNavigation array
{
  id: 'admin-feature',
  name: 'Admin Feature',
  href: 'admin-feature',
  icon: Settings,
  permissions: ['admin'] // Restrict access
}
```

#### **Navigation Helper Functions:**
- `isNavigationItemActive(currentPage, itemHref)` - Check active state
- `filterNavigationByPermissions(items, userPermissions)` - Filter by access
- `getNavigationItem(id)` - Get item by ID
- `getNavigationWithBadges()` - Get items with badges

### **📁 File Organization Rules**

#### **Components Hierarchy:**
```
src/components/
├── ui/                    # shadcn/ui components (don't modify)
├── layout/               # ResponsiveLayout only
├── DatabricksCard.jsx    # KPI card component
├── DatabricksChart.jsx   # Chart component  
└── DatabricksLogo.jsx.tmpl # Logo with templating
```

#### **Pages Structure:**
```
src/pages/
├── ChatPage.jsx                    # AI chat interface
├── CustomerSegmentationPage.jsx.tmpl # CLV analysis
├── DemandForecastingPage.jsx.tmpl   # AI forecasting
└── YourNewPage.jsx                 # Custom pages
```

#### **Configuration Files:**
```
src/config/
└── navigation.js.tmpl    # Single source of truth for navigation
```

This architecture ensures scalable, maintainable, and performant Databricks Apps that integrate seamlessly with the Databricks platform while providing excellent user experience.

## 🔍 **Troubleshooting Deployment Issues**

### **If App Deployment Fails:**
```bash
# 1. Check current status
databricks apps list

# 2. Check deployment history
databricks apps list-deployments your-app-name

# 3. Compare with working apps in same workspace
databricks apps get working-app-name
databricks apps get failing-app-name

# 4. Verify no app.yaml exists (should NOT exist for standard apps)
ls src/app/app.yaml  # Should return "No such file"
```

### **Key Debugging Checklist:**
1. ❌ **Does the app have an `app.yaml` file?** → Remove it for standard Node.js apps
2. ✅ **Is the `databricks.yml` configured with apps section?** → Check template
3. ✅ **Are you running `deploy` before `run`?** → Always deploy first
4. ✅ **Does a similar working app exist to compare with?** → Use as reference

### **Success Factor:**
**For standard Node.js/React applications, Databricks auto-detection works better than manual configuration.** Only use custom `app.yaml` when you have specific non-standard requirements.