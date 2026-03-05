# Cursor AI Usage Guide

This guide explains how to effectively use Cursor AI with the Databricks Demo Factory Template.

## 🚀 Quick Start

1. **Initialize Template**: Use `databricks bundle init` with the template
2. **Read Requirements**: Always start by reading `demo-requirements.md`
3. **Ask AI**: Describe your demo needs in natural language
4. **Iterate**: Refine based on AI suggestions and feedback

## 📝 Writing Effective Requirements

### Good Requirements Example:
```
"A retail analytics dashboard showing customer segmentation, sales trends, and inventory management. Include real-time transaction processing, customer lifetime value analysis, and predictive analytics for demand forecasting. Use modern charts and KPIs with drill-down capabilities. Focus on executive presentation quality."
```

### Key Elements:
- **Industry context** (retail, finance, supply chain)
- **Specific features** (real-time, predictive, drill-down)
- **Visual elements** (charts, KPIs, dashboards)
- **Business value** (customer insights, forecasting, optimization)
- **Presentation quality** (executive-ready, professional)

## 🤖 Interacting with Cursor AI

### Initial Setup:
```
"Read the demo-requirements.md file and implement a professional dashboard based on the requirements. Start with data generation and build the complete solution."
```

### Specific Requests:
```
"Enhance the data generation to include more realistic customer segments and add geographic data for location-based analytics."
```

```
"Add a new chart component showing product performance by category with interactive filtering capabilities."
```

```
"Implement real-time transaction processing with WebSocket updates for live dashboard updates."
```

### Refinement Requests:
```
"Improve the visual design to be more executive-ready with better color schemes and typography."
```

```
"Add error handling and loading states to all API endpoints and dashboard components."
```

## 🎯 Best Practices

### 1. Be Specific
- **Good**: "Add customer lifetime value analysis with cohort charts"
- **Bad**: "Make it better"

### 2. Provide Context
- **Good**: "This is for a retail executive presentation, so focus on revenue impact and customer insights"
- **Bad**: "Create a dashboard"

### 3. Iterate Incrementally
- Start with core functionality
- Add features one at a time
- Test each addition before moving on

### 4. Use Industry Language
- Retail: customers, products, transactions, segments
- Finance: accounts, transactions, risk, compliance
- Supply Chain: suppliers, shipments, inventory, logistics

## 🔧 Customization Examples

### Adding New Data Sources:
```
"Add a new data table for store locations with geographic coordinates and performance metrics. Include store manager information and regional sales targets."
```

### Enhancing Visualizations:
```
"Create a geographic heat map showing sales performance by region. Add drill-down capabilities to show store-level details when clicking on regions."
```

### Adding Advanced Features:
```
"Implement a conversational AI interface that can answer questions about the data. Use natural language processing to understand queries about sales trends, customer behavior, and inventory levels."
```

## 🚀 Deployment Workflow

### 1. Template Initialization
```bash
databricks bundle init https://github.com/briancline-db/sa-demo-template.git
```

### 2. Requirements Definition
- Edit `demo-requirements.md` with your specific needs
- Be detailed and specific about requirements

### 3. AI Implementation
- Ask Cursor AI to read requirements and implement
- Provide feedback and refinement requests
- Test functionality as you go

### 4. Deployment
```bash
databricks bundle deploy
```

## 💡 Pro Tips

### For Complex Demos:
1. **Break down requirements** into phases
2. **Start with MVP** and enhance incrementally
3. **Test each component** before adding complexity
4. **Focus on business value** over technical complexity

### For Executive Presentations:
1. **Emphasize visual impact** and professional design
2. **Include clear business metrics** and KPIs
3. **Add interactive elements** for engagement
4. **Ensure fast loading** and smooth interactions

### For Technical Demos:
1. **Showcase Databricks capabilities** clearly
2. **Include real-time features** and live data
3. **Demonstrate scalability** and performance
4. **Highlight integration** with other systems

## 🎨 Design Guidelines

### Databricks Branding:
- Use Databricks red (`#FF3621`) for primary actions
- Use dark gray (`#1B3139`) for text and headers
- Use green (`#00A972`) for positive trends
- Use Inter font family throughout

### Component Patterns:
- Use `DatabricksCard` for KPIs and metrics
- Use `DatabricksChart` for all visualizations
- Maintain consistent spacing (8px grid)
- Use rounded corners (`rounded-databricks`)

### Responsive Design:
- Mobile-first approach
- Flexible grid layouts
- Touch-friendly interactions
- Fast loading on all devices

## 🔍 Troubleshooting

### Common Issues:

**AI not understanding requirements:**
- Be more specific about industry and use cases
- Provide concrete examples of desired features
- Reference existing components and patterns

**Template not initializing:**
- Ensure you have the latest Databricks CLI
- Check your workspace permissions
- Verify the template URL is correct

**Deployment failures:**
- Check workspace connectivity
- Verify resource permissions
- Review bundle configuration

### Getting Help:
1. **Read the documentation** in `docs/` folder
2. **Check the Cursor rules** in `.cursor/rules/`
3. **Review examples** in the template files
4. **Ask specific questions** to Cursor AI

Remember: The goal is to create professional, presentation-ready demos that showcase Databricks capabilities and drive business value. Focus on quality, performance, and user experience. 