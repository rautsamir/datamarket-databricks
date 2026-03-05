---
description: React styling rules for implementing Databricks design system with Tailwind CSS and shadcn/ui
globs: src/app/**/*.{jsx,tsx,js,ts,css}, **/*.{jsx,tsx}
alwaysApply: false
---

# React Styling - Databricks Design System

You are a React, Tailwind CSS, and shadcn/ui expert who implements the Databricks design system consistently with modern UI components.

## 🧩 Modern UI Stack

### Component Libraries:
- **shadcn/ui**: Headless components built on Radix UI
- **Radix UI**: Accessible primitives for complex interactions
- **Lucide React**: Consistent icon system
- **Tailwind CSS**: Utility-first styling with Databricks design tokens

### Key shadcn/ui Components:
```jsx
// Core UI components available
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink } from '@/components/ui/navigation-menu'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
```

### Component Styling Approach:
```jsx
// Combine shadcn/ui with Databricks theming
<Button className="bg-databricks-red hover:bg-databricks-red/90">
  Primary Action
</Button>

<Card className="border-databricks-red/10 bg-white/50 backdrop-blur-sm">
  <CardHeader>
    <CardTitle className="text-databricks-dark">Dashboard KPI</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-2xl font-bold text-databricks-red">$2.4M</p>
  </CardContent>
</Card>
```

## 🎨 Databricks Design Tokens

### Colors:
```css
/* Primary Colors */
--databricks-red: #FF3621;
--databricks-dark: #1B3139;
--databricks-green: #00A972;
--databricks-orange: #FFA500;
--databricks-blue: #0073E6;

/* Chart Colors */
--chart-1: #FF3621;
--chart-2: #00A972;
--chart-3: #0073E6;
--chart-4: #FFA500;
--chart-5: #8B5CF6;
--chart-6: #06B6D4;

/* UI Colors */
--background: #FFFFFF;
--foreground: #1B3139;
--muted: #F8F9FA;
--muted-foreground: #6C757D;
--border: #E9ECEF;
--input: #FFFFFF;
--ring: #FF3621;
```

### Typography:
```css
/* Font Family */
font-family: 'Inter', system-ui, sans-serif;

/* Font Sizes */
--display-1: 3.5rem;
--display-2: 3rem;
--h1: 2.5rem;
--h2: 2rem;
--h3: 1.5rem;
--body-lg: 1.125rem;
--body: 1rem;
--body-sm: 0.875rem;
--caption: 0.75rem;
```

### Spacing & Layout:
```css
/* Grid System */
--spacing-1: 0.25rem;  /* 4px */
--spacing-2: 0.5rem;   /* 8px */
--spacing-3: 0.75rem;  /* 12px */
--spacing-4: 1rem;     /* 16px */
--spacing-6: 1.5rem;   /* 24px */
--spacing-8: 2rem;     /* 32px */
--spacing-12: 3rem;    /* 48px */
--spacing-16: 4rem;    /* 64px */

/* Border Radius */
--radius-databricks: 8px;
```

## 🧩 Component Patterns

### Card Components:
```jsx
// DatabricksCard - For KPIs and metrics
<DatabricksCard
  title="Total Revenue"
  value="$2.4M"
      trend={ { direction: 'up', value: '+12%' } }
  icon={DollarSignIcon}
  className="bg-white shadow-lg border-0"
/>

// Standard Card - For content sections
<Card className="bg-white border border-gray-200 rounded-databricks shadow-sm">
  <CardHeader className="pb-3">
    <CardTitle className="text-h3 font-semibold text-databricks-dark">
      Section Title
    </CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### Button Components:
```jsx
// Primary Button
<Button className="bg-databricks-red hover:bg-red-700 text-white font-medium rounded-databricks px-6 py-2">
  Primary Action
</Button>

// Secondary Button
<Button variant="outline" className="border-databricks-dark text-databricks-dark hover:bg-gray-50 rounded-databricks px-6 py-2">
  Secondary Action
</Button>

// Ghost Button
<Button variant="ghost" className="text-databricks-dark hover:bg-gray-100 rounded-databricks px-4 py-2">
  Ghost Action
</Button>
```

### Form Components:
```jsx
// Input Fields
<Input 
  className="border-gray-300 rounded-databricks focus:ring-databricks-red focus:border-databricks-red"
  placeholder="Enter value..."
/>

// Select Dropdown
<Select>
  <SelectTrigger className="border-gray-300 rounded-databricks focus:ring-databricks-red focus:border-databricks-red">
    <SelectValue placeholder="Select option..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

## 📊 Chart Components

### DatabricksChart Usage:
```jsx
// Line Chart
<DatabricksChart
  type="line"
  data={chartData}
  xKey="month"
  yKeys={['revenue', 'customers']}
  title="Revenue Trends"
  height={400}
/>

// Bar Chart
<DatabricksChart
  type="bar"
  data={chartData}
  xKey="category"
  yKeys={['sales']}
  title="Sales by Category"
  height={300}
/>

// Area Chart
<DatabricksChart
  type="area"
  data={chartData}
  xKey="date"
  yKeys={['volume']}
  title="Volume Over Time"
  height={350}
/>
```

## 🎯 Layout Patterns

### Dashboard Layout:
```jsx
// Main Dashboard Structure
<div className="min-h-screen bg-gray-50">
  {/* Header */}
  <header className="bg-white border-b border-gray-200 px-6 py-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <img src="/databricks-logo.svg" alt="Databricks" className="h-8" />
        <h1 className="text-h2 font-semibold text-databricks-dark">
          {projectName} Dashboard
        </h1>
      </div>
      <div className="flex items-center space-x-4">
        {/* Navigation/Actions */}
      </div>
    </div>
  </header>

  {/* Main Content */}
  <main className="p-6">
    {/* KPI Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* KPI Cards */}
    </div>

    {/* Charts Grid */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chart Components */}
    </div>
  </main>
</div>
```

### Responsive Grid:
```jsx
// Responsive Grid System
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {/* Grid Items */}
</div>

// Flexible Layout
<div className="flex flex-col lg:flex-row gap-6">
  <div className="flex-1">
    {/* Main Content */}
  </div>
  <div className="w-full lg:w-80">
    {/* Sidebar */}
  </div>
</div>
```

## 🎨 Styling Best Practices

### CSS Classes:
- Use Tailwind utility classes for consistent spacing
- Apply Databricks colors using custom CSS variables
- Use `rounded-databricks` for consistent border radius
- Implement proper hover and focus states

### Component Structure:
```jsx
// Component with proper styling
const MyComponent = ({ title, data, className = "" }) => {
  return (
    <div className={`bg-white rounded-databricks shadow-lg p-6 ${className}`}>
      <h3 className="text-h3 font-semibold text-databricks-dark mb-4">
        {title}
      </h3>
      <div className="space-y-4">
        {/* Content */}
      </div>
    </div>
  );
};
```

### Loading States:
```jsx
// Skeleton Loader
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
</div>

// Loading Spinner
<div className="flex items-center justify-center p-8">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-databricks-red"></div>
</div>
```

### Error States:
```jsx
// Error Component
<div className="bg-red-50 border border-red-200 rounded-databricks p-4">
  <div className="flex items-center">
    <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
    <p className="text-red-800 font-medium">Error loading data</p>
  </div>
  <p className="text-red-600 text-sm mt-1">Please try again later</p>
</div>
```

## 🚀 Performance Tips

### Optimization:
- Use `React.memo()` for expensive components
- Implement lazy loading for charts
- Use `useMemo()` for expensive calculations
- Optimize bundle size with code splitting

### Accessibility:
- Add proper ARIA labels
- Ensure keyboard navigation
- Use semantic HTML elements
- Maintain proper color contrast ratios

Remember: Every component should look professional and polished, representing the high quality of Databricks products and services. 