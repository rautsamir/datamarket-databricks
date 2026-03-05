import React, { useState } from 'react'
import { DatabricksCard } from '../components/DatabricksCard'
import { DatabricksChart } from '../components/DatabricksChart'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  DollarSign, 
  Package, 
  Zap,
  Brain,
  BarChart3,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react'

export function DemandForecastingPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('12months')

  // AI Forecasting Impact Metrics
  const aiImpactMetrics = {
    accuracy_improvement: { value: '42%', trend: { direction: 'up', value: '+42%' }, baseline: '20-50%' },
    cost_reduction: { value: '18%', trend: { direction: 'up', value: '+18%' }, baseline: '15%' },
    efficiency_gain: { value: '58%', trend: { direction: 'up', value: '+58%' }, baseline: '65%' },
    forecast_error: { value: '12%', trend: { direction: 'down', value: '-28%' }, baseline: '40%' }
  }

  // Demand Forecast vs Actual Data (showing AI accuracy)
  const forecastAccuracyData = [
    { month: 'Jan', traditional: 75, ai_forecast: 92, actual: 89 },
    { month: 'Feb', traditional: 68, ai_forecast: 91, actual: 88 },
    { month: 'Mar', traditional: 72, ai_forecast: 95, actual: 94 },
    { month: 'Apr', traditional: 70, ai_forecast: 89, actual: 87 },
    { month: 'May', traditional: 65, ai_forecast: 93, actual: 91 },
    { month: 'Jun', traditional: 78, ai_forecast: 96, actual: 95 },
    { month: 'Jul', traditional: 73, ai_forecast: 94, actual: 92 },
    { month: 'Aug', traditional: 69, ai_forecast: 91, actual: 90 },
    { month: 'Sep', traditional: 74, ai_forecast: 97, actual: 96 },
    { month: 'Oct', traditional: 71, ai_forecast: 93, actual: 94 },
    { month: 'Nov', traditional: 76, ai_forecast: 98, actual: 97 },
    { month: 'Dec', traditional: 82, ai_forecast: 96, actual: 95 }
  ]

  // Regional Demand Patterns
  const regionalDemandData = [
    { region: 'Northeast', demand: 2400, accuracy: 96, stores: 890 },
    { region: 'Southeast', demand: 2800, accuracy: 94, stores: 1200 },
    { region: 'Midwest', demand: 2200, accuracy: 98, stores: 950 },
    { region: 'Southwest', demand: 2600, accuracy: 92, stores: 1100 },
    { region: 'West', demand: 3200, accuracy: 95, stores: 1350 }
  ]

  // Cost Impact Analysis
  const costImpactData = [
    { category: 'Inventory Costs', traditional: 450000, ai_optimized: 369000, savings: 81000 },
    { category: 'Stockout Losses', traditional: 125000, ai_optimized: 52000, savings: 73000 },
    { category: 'Overstock Costs', traditional: 89000, ai_optimized: 31000, savings: 58000 },
    { category: 'Logistics', traditional: 210000, ai_optimized: 189000, savings: 21000 }
  ]

  // Future Demand Predictions
  const futureDemandData = [
    { month: 'Jan 2025', predicted: 3200, confidence_low: 2880, confidence_high: 3520 },
    { month: 'Feb 2025', predicted: 2980, confidence_low: 2682, confidence_high: 3278 },
    { month: 'Mar 2025', predicted: 3450, confidence_low: 3105, confidence_high: 3795 },
    { month: 'Apr 2025', predicted: 3680, confidence_low: 3312, confidence_high: 4048 },
    { month: 'May 2025', predicted: 3920, confidence_low: 3528, confidence_high: 4312 },
    { month: 'Jun 2025', predicted: 4100, confidence_low: 3690, confidence_high: 4510 }
  ]

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  const formatNumber = (value) => {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M'
    } else if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K'
    }
    return value.toString()
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Brain className="h-7 w-7 mr-3 text-blue-600" />
              AI-Driven Demand Forecasting
              <Badge className="ml-3 bg-blue-100 text-blue-800">AI-Powered</Badge>
            </h1>
            <p className="text-gray-600 mt-1">Advanced machine learning models for demand prediction and inventory optimization</p>
          </div>
          <div className="flex items-center space-x-3">
            <select 
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="6months">Last 6 months</option>
              <option value="12months">Last 12 months</option>
              <option value="24months">Last 24 months</option>
            </select>
            <Button variant="outline" size="sm">
              <Zap className="h-4 w-4 mr-2" />
              Run Forecast
            </Button>
          </div>
        </div>
      </div>

      {/* AI Impact Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DatabricksCard
          title="Accuracy Improvement"
          value={aiImpactMetrics.accuracy_improvement.value}
          trend={aiImpactMetrics.accuracy_improvement.trend}
          subtitle="vs traditional methods"
          icon={Target}
          className="border-l-4 border-l-green-500"
        >
          <div className="mt-2 text-xs text-gray-600">
            Baseline: {aiImpactMetrics.accuracy_improvement.baseline}
          </div>
        </DatabricksCard>

        <DatabricksCard
          title="Cost Reduction"
          value={aiImpactMetrics.cost_reduction.value}
          trend={aiImpactMetrics.cost_reduction.trend}
          subtitle="in operational costs"
          icon={DollarSign}
          className="border-l-4 border-l-blue-500"
        >
          <div className="mt-2 text-xs text-gray-600">
            Annual savings: $233K
          </div>
        </DatabricksCard>

        <DatabricksCard
          title="Efficiency Gain"
          value={aiImpactMetrics.efficiency_gain.value}
          trend={aiImpactMetrics.efficiency_gain.trend}
          subtitle="in inventory turnover"
          icon={Package}
          className="border-l-4 border-l-purple-500"
        >
          <div className="mt-2 text-xs text-gray-600">
            Faster inventory cycles
          </div>
        </DatabricksCard>

        <DatabricksCard
          title="Forecast Error"
          value={aiImpactMetrics.forecast_error.value}
          trend={aiImpactMetrics.forecast_error.trend}
          subtitle="mean absolute error"
          icon={AlertTriangle}
          className="border-l-4 border-l-red-500"
        >
          <div className="mt-2 text-xs text-gray-600">
            Industry standard: 40%
          </div>
        </DatabricksCard>
      </div>

      {/* Forecast Accuracy Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DatabricksCard title="Forecast Accuracy: Traditional vs AI vs Actual" className="col-span-1">
          <div className="mb-4">
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-400 rounded mr-2"></div>
                <span>Traditional</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
                <span>AI Forecast</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                <span>Actual</span>
              </div>
            </div>
          </div>
          <DatabricksChart
            type="line"
            data={forecastAccuracyData}
            xAxisKey="month"
            yAxisKey="traditional"
            additionalLines={[
              { key: 'ai_forecast', color: '#3b82f6' },
              { key: 'actual', color: '#10b981' }
            ]}
            height={300}
          />
        </DatabricksCard>

        <DatabricksCard title="Regional Demand Performance" className="col-span-1">
          <DatabricksChart
            type="bar"
            data={regionalDemandData}
            xAxisKey="region"
            yAxisKey="demand"
            height={300}
          />
          <div className="mt-4 grid grid-cols-2 gap-4">
            {regionalDemandData.map((region) => (
              <div key={region.region} className="flex justify-between text-sm">
                <span className="text-gray-600">{region.region}:</span>
                <span className="font-medium">{region.accuracy}% accurate</span>
              </div>
            ))}
          </div>
        </DatabricksCard>
      </div>

      {/* Cost Impact Analysis */}
      <DatabricksCard title="Cost Impact Analysis - AI Optimization">
        <div className="space-y-4">
          {costImpactData.map((item) => (
            <div key={item.category} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{item.category}</h4>
                <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                  <span>Traditional: {formatCurrency(item.traditional)}</span>
                  <span>→</span>
                  <span>AI-Optimized: {formatCurrency(item.ai_optimized)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-600">
                  {formatCurrency(item.savings)}
                </div>
                <div className="text-sm text-gray-600">saved</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 p-4 bg-green-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle2 className="h-5 w-5 text-green-600 mr-2" />
              <span className="font-medium text-green-900">Total Annual Savings</span>
            </div>
            <span className="text-2xl font-bold text-green-600">
              {formatCurrency(costImpactData.reduce((sum, item) => sum + item.savings, 0))}
            </span>
          </div>
        </div>
      </DatabricksCard>

      {/* Future Demand Predictions */}
      <DatabricksCard title="Future Demand Predictions (Next 6 Months)">
        <div className="mb-4">
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
              <span>Predicted Demand</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-200 rounded mr-2"></div>
              <span>Confidence Interval</span>
            </div>
          </div>
        </div>
        <DatabricksChart
          type="line"
          data={futureDemandData}
          xAxisKey="month"
          yAxisKey="predicted"
          additionalLines={[
            { key: 'confidence_low', color: '#dbeafe', strokeDasharray: '3,3' },
            { key: 'confidence_high', color: '#dbeafe', strokeDasharray: '3,3' }
          ]}
          height={300}
        />
      </DatabricksCard>

      {/* AI Model Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Brain className="h-5 w-5 mr-2 text-blue-600" />
          AI Model Insights & Recommendations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <BarChart3 className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Model Performance</p>
                <p className="text-sm text-gray-600">
                  Deep learning model with 92% average accuracy, trained on 3 years of historical data including seasonality, promotions, and external factors.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Key Success Factors</p>
                <p className="text-sm text-gray-600">
                  Integration of weather data, economic indicators, and social media sentiment has improved forecast accuracy by 15%.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Package className="h-5 w-5 text-purple-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Inventory Optimization</p>
                <p className="text-sm text-gray-600">
                  AI recommends safety stock reduction of 25% while maintaining 99.5% service level across all product categories.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Zap className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Next Actions</p>
                <p className="text-sm text-gray-600">
                  Implement dynamic pricing strategies and expand model to include supplier constraints and lead time variations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}