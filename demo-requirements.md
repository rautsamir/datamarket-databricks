# lac_dna_portal - Demo Requirements & AI Instructions

## 🎯 Demo Overview
**Project:** lac_dna_portal
**Industry:** finance
**Complexity:** advanced
**Data Scale:** medium

## 📋 Detailed Requirements
LA County Auditor-Controller DNA Data Portal - A Databricks-native data marketplace replacing Accenture Aspire. The portal enables authenticated County employees to discover and browse enterprise data products (vendors, budgets, payments, internal billing, fraud detection) registered in Unity Catalog. Features include: data product catalog with metadata browsing and search, embedded AI/BI dashboards for financial analytics, Genie Spaces for natural language data exploration, AI-generated metadata descriptions, semantic search over vectorized metadata, document repository for data dictionaries and training materials, access request workflows, and role-based access controls via Entra ID. The portal serves 15+ County departments across Finance, Procurement, HR, and Operations domains with Gold layer data products from the DNA platform.

## 🎨 Design Requirements
- Professional Databricks branding and design system
- Modern, executive-ready dashboard interface  
- Interactive visualizations with drill-down capabilities
- Responsive design optimized for presentations
- Real-time data updates and live metrics

## 📊 Data & Analytics Requirements
- Industry-appropriate synthetic data for finance
- Realistic business scenarios and edge cases
- Scalable data generation (medium volume)
- Time-series data for trend analysis
- Demographic and behavioral segmentation




## 🔄 OLTP Requirements  
- Real-time transaction processing with Lakebase
- Live dashboard updates from operational data
- CRUD operations for interactive demos
- Data synchronization between OLTP and analytical stores

## 🤖 AI/LLM Requirements
- Conversational analytics interface
- RAG-enabled question answering about data
- Natural language query capabilities
- Predictive analytics and forecasting
- Automated insights and recommendations


## 🚀 Success Criteria
- **Professional Impact:** Executive-ready presentation quality
- **Business Value:** Clear ROI and actionable insights  
- **Technical Excellence:** Showcases Databricks platform capabilities
- **User Experience:** Intuitive, engaging, and interactive
- **Deployment:** 5-minute setup and deployment process

---

## 🤖 AI IMPLEMENTATION INSTRUCTIONS

**CURSOR AI: READ THIS SECTION FOR IMPLEMENTATION GUIDANCE**

### 🎯 Primary Directive
Implement the demo requirements above using the Databricks Demo Factory template structure. Focus on creating a professional, presentation-ready solution that showcases Databricks capabilities.

### 🏗️ Implementation Strategy

#### 1. Data Generation (Start Here)
- **File:** `src/lac_dna_portal/main.py`
- **Action:** Enhance with finance-specific synthetic data
- **Scale:** Generate medium volume of realistic data
- **Quality:** Ensure referential integrity and business logic

#### 2. API Development
- **File:** `src/app/app.js` (generated from `app.js.tmpl`)
- **Action:** Add industry-specific API endpoints
- **Patterns:** Follow REST conventions, implement proper error handling
- **Data:** Connect to Unity Catalog tables for dashboard consumption

#### 3. Dashboard Components
- **Directory:** `src/app/src/components/`
- **Action:** Build React components using Databricks design system
- **Components:** KPI cards, charts, tables, filters, interactive elements
- **Styling:** Use Tailwind CSS with Databricks brand colors
- **Note:** Both `src/app/components/` (template components) and `src/app/src/components/` (React components) exist

#### 4. Main Dashboard
- **File:** `src/app/src/App.jsx`
- **Action:** Create comprehensive React dashboard layout
- **Features:** Header with branding, KPI grid, visualizations, navigation
- **Interactions:** Filters, drill-downs, real-time updates


#### 5. OLTP Integration
- **Action:** Add Lakebase PostgreSQL integration
- **Features:** Real-time data operations, live dashboard updates
- **Patterns:** Connection pooling, transaction management, sync processes



#### 6. LLM Agent Integration
- **Action:** Integrate Mosaic AI Agent Framework
- **Features:** Conversational interface, RAG capabilities, NL queries
- **Implementation:** Chat component, agent API endpoints, context management


### 🎨 Design Guidelines
- Use `DatabricksCard` components for KPIs
- Use `DatabricksChart` components for visualizations
- Follow Databricks color palette: `#FF3621`, `#1B3139`, `#00A972`
- Implement professional typography with Inter font
- Create responsive layouts with proper spacing

### 📊 Industry-Specific Patterns






**Finance Focus:**
- Portfolio performance and risk
- Customer analytics and lifetime value
- Fraud detection and prevention
- Regulatory compliance and reporting


### 🔧 Technical Standards
- **Error Handling:** Implement comprehensive error boundaries
- **Loading States:** Add skeleton loaders for all async operations
- **Performance:** Optimize bundle size and load times
- **Accessibility:** Use semantic HTML and ARIA labels
- **Security:** Implement proper authentication patterns

### 💡 Enhancement Suggestions
Based on the requirements, consider adding:
- Geographic visualizations for location-based data
- Predictive analytics dashboards
- Anomaly detection alerts
- Export capabilities for reports
- Mobile-responsive design optimizations

### 🚀 Development Approach
1. **Start with MVP:** Basic dashboard with core functionality
2. **Iterate incrementally:** Add features based on complexity level
3. **Test thoroughly:** Ensure all components work smoothly
4. **Optimize performance:** Fast load times and smooth interactions
5. **Polish presentation:** Professional appearance and user experience

Remember: This demo represents Databricks' capabilities to potential customers. Every detail matters for creating a compelling, professional presentation that drives business value. 