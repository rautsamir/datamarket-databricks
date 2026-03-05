# retail1 - Databricks Demo Dashboard

A modern React dashboard application built for Databricks deployment with real-time analytics and beautiful visualizations.

## 🚀 Quick Start

### Prerequisites
- Node.js 18.0.0 or higher
- npm or yarn

### Installation
```bash
npm install
```

### Development
```bash
# Start both React dev server (port 3001) and Express API server (port 3000)
npm run start:dev

# Or run separately:
npm run dev        # React dev server only
npm run server:dev # Express API server only
```

### Production
```bash
# Build and start for production
npm run start

# Or build separately
npm run build
npm run server
```

## 📊 Features

- **Real-time KPI Dashboard**: Revenue, customers, orders, and conversion metrics
- **Interactive Charts**: Line, area, and bar charts using Recharts
- **Databricks Branding**: Custom color palette and styling
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **API Integration**: RESTful endpoints for data fetching
- **Express Backend**: Serves both API and static React app

## 🏗️ Architecture

```
retail1/
├── src/                    # React source code
│   ├── components/         # Reusable React components
│   ├── App.jsx            # Main React application
│   ├── main.jsx           # React entry point
│   └── index.css          # Global styles with Tailwind
├── public/                # Static assets
├── dist/                  # Built React app (generated)
├── app.js                 # Express server
├── vite.config.js         # Vite configuration
└── tailwind.config.js     # Tailwind CSS configuration
```

## 🎯 API Endpoints

- `GET /api/health` - Health check
- `GET /api/kpis` - Key performance indicators
- `GET /api/trends` - Time series data for charts
- `GET /api/segments` - Customer segment data
- `POST /api/transactions` - Create new transaction
- `GET /api/transactions/recent` - Recent transactions

## 🎨 Databricks Design System

### Colors
- **Primary Red**: `#FF3621` (databricks-red)
- **Dark**: `#1B3139` (databricks-dark)
- **Green**: `#00A972` (databricks-green)
- **Orange**: `#FFA500` (databricks-orange)
- **Blue**: `#0073E6` (databricks-blue)

### Components
- `DatabricksCard` - KPI metric cards
- `DatabricksChart` - Responsive charts with Databricks theming

## 🔧 Configuration

### Environment Variables
```bash
PORT=3000                  # Express server port
NODE_ENV=production       # Environment mode
```

### Vite Development
- React dev server runs on port 3001
- API calls are proxied to Express server on port 3000

## 📦 Deployment

For Databricks Apps deployment:

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Start the server**:
   ```bash
   npm run start
   ```

3. **Environment**: Ensure all dependencies are installed and `dist/` directory contains the built React app.

## 🔍 Troubleshooting

### Common Issues

1. **"Recharts is not defined"**: Fixed - now using proper ES6 imports
2. **"ForwardRef" errors**: Fixed - using consistent React versions
3. **Favicon 404**: Fixed - added custom Databricks favicon
4. **CDN loading issues**: Fixed - migrated to Vite build system

### Development Tips
- Use `npm run start:dev` for hot reloading during development
- Check browser console for any remaining errors
- API endpoints return mock data by default - replace with actual Databricks queries

## 🚀 Next Steps

1. **Connect to Databricks**: Replace mock data with actual Databricks SQL queries
2. **Add Authentication**: Implement user authentication and authorization
3. **Real-time Updates**: Add WebSocket or Server-Sent Events for live data
4. **More Charts**: Extend with additional visualization types
5. **Error Handling**: Improve error boundaries and user feedback

## 📋 Scripts Reference

```bash
npm run dev         # Start Vite dev server (port 3001)
npm run build       # Build React app for production
npm run preview     # Preview production build locally
npm run start       # Build and start production server
npm run start:dev   # Start both dev server and API server
npm run start:prod  # Build and start production server
npm run server      # Start Express server only
npm run server:dev  # Start Express server with nodemon
```