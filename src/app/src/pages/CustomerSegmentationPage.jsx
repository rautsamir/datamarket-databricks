import React, { useState } from 'react'
import { DatabricksCard } from '../components/DatabricksCard'
import { DatabricksChart } from '../components/DatabricksChart'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  ShoppingCart,
  Heart,
  Target,
  Award,
  ArrowRight,
  Filter,
  Eye
} from 'lucide-react'

export function CustomerSegmentationPage() {
  const [selectedSegment, setSelectedSegment] = useState(null)
  const [timeRange, setTimeRange] = useState('12months')

  // Customer Segments with CLV data
  const customerSegments = [
    {
      id: 'platinum',
      name: 'Platinum',
      customers: 334,
      revenue: 267000,
      clv: 2400,
      growth: 15,
      color: '#8b5cf6',
      description: 'VIP customers with highest lifetime value',
      traits: ['High frequency', 'Premium products', 'Brand loyal']
    },
    {
      id: 'gold', 
      name: 'Gold',
      customers: 1200,
      revenue: 480000,
      clv: 850,
      growth: 8,
      color: '#f59e0b',
      description: 'Regular high-value customers',
      traits: ['Consistent purchases', 'Quality focused', 'Price sensitive']
    },
    {
      id: 'silver',
      name: 'Silver',
      customers: 5200,
      revenue: 1040000,
      clv: 420,
      growth: 5,
      color: '#6b7280',
      description: 'Moderate value customers with potential',
      traits: ['Seasonal buyers', 'Deal seekers', 'Growing engagement']
    },
    {
      id: 'bronze',
      name: 'Bronze',
      customers: 8500,
      revenue: 850000,
      clv: 180,
      growth: -2,
      color: '#cd7f32',
      description: 'Entry-level customers with room for growth',
      traits: ['Price conscious', 'Infrequent buyers', 'Basic products']
    }
  ]

  // Detailed segment analysis data
  const segmentDetails = {
    platinum: {
      behavior: {
        avgOrderValue: 320,
        purchaseFrequency: 8.5,
        retentionRate: 94,
        churnRate: 6,
        referralRate: 45
      },
      demographics: {
        avgAge: 42,
        primaryLocation: 'Urban',
        preferredChannel: 'Online'
      },
      preferences: {
        topCategories: ['Electronics', 'Home & Garden', 'Fashion'],
        seasonality: 'Holiday focused',
        communicationPref: 'Email + SMS'
      }
    },
    gold: {
      behavior: {
        avgOrderValue: 185,
        purchaseFrequency: 5.2,
        retentionRate: 78,
        churnRate: 22,
        referralRate: 28
      },
      demographics: {
        avgAge: 38,
        primaryLocation: 'Suburban',
        preferredChannel: 'Mobile App'
      },
      preferences: {
        topCategories: ['Fashion', 'Electronics', 'Health'],
        seasonality: 'Year-round',
        communicationPref: 'Email'
      }
    },
    silver: {
      behavior: {
        avgOrderValue: 95,
        purchaseFrequency: 3.1,
        retentionRate: 62,
        churnRate: 38,
        referralRate: 15
      },
      demographics: {
        avgAge: 34,
        primaryLocation: 'Mixed',
        preferredChannel: 'Website'
      },
      preferences: {
        topCategories: ['Fashion', 'Home', 'Sports'],
        seasonality: 'Sale-driven',
        communicationPref: 'Email'
      }
    },
    bronze: {
      behavior: {
        avgOrderValue: 45,
        purchaseFrequency: 1.8,
        retentionRate: 35,
        churnRate: 65,
        referralRate: 8
      },
      demographics: {
        avgAge: 29,
        primaryLocation: 'Rural/Urban mix',
        preferredChannel: 'Mobile Web'
      },
      preferences: {
        topCategories: ['Fashion', 'Electronics', 'Books'],
        seasonality: 'Deal-dependent',
        communicationPref: 'Push notifications'
      }
    }
  }

  // Monthly CLV trends
  const clvTrends = [
    { month: 'Jan', platinum: 2200, gold: 800, silver: 380, bronze: 160 },
    { month: 'Feb', platinum: 2250, gold: 820, silver: 390, bronze: 165 },
    { month: 'Mar', platinum: 2300, gold: 835, silver: 400, bronze: 170 },
    { month: 'Apr', platinum: 2350, gold: 845, silver: 405, bronze: 175 },
    { month: 'May', platinum: 2380, gold: 850, silver: 415, bronze: 178 },
    { month: 'Jun', platinum: 2400, gold: 850, silver: 420, bronze: 180 }
  ]

  // Engagement metrics
  const engagementData = [
    { segment: 'Platinum', emailOpen: 68, clickThrough: 12, conversion: 8.5 },
    { segment: 'Gold', emailOpen: 52, clickThrough: 8, conversion: 5.2 },
    { segment: 'Silver', emailOpen: 38, clickThrough: 5, conversion: 3.1 },
    { segment: 'Bronze', emailOpen: 25, clickThrough: 3, conversion: 1.8 }
  ]

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  const formatNumber = (value) => {
    if (value >= 1000) {
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
            <h1 className="text-2xl font-bold text-gray-900">Customer Segmentation & CLV Analysis</h1>
            <p className="text-gray-600 mt-1">Analyze customer segments and lifetime value patterns</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              Last 12 months
            </Button>
          </div>
        </div>
      </div>

      {/* Customer Segments Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {customerSegments.map((segment) => (
          <DatabricksCard
            key={segment.id}
            title={segment.name}
            value={formatNumber(segment.customers)}
            subtitle="customers"
            trend={{
              direction: segment.growth >= 0 ? 'up' : 'down',
              value: `${Math.abs(segment.growth)}%`
            }}
            className={`cursor-pointer transition-all hover:scale-105 ${
              selectedSegment === segment.id 
                ? 'ring-2 ring-offset-2' 
                : ''
            }`}
            style={{
              borderLeft: `4px solid ${segment.color}`,
              ...(selectedSegment === segment.id && {
                '--tw-ring-color': segment.color
              })
            }}
            onClick={() => setSelectedSegment(selectedSegment === segment.id ? null : segment.id)}
          >
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Revenue:</span>
                <span className="font-medium">{formatCurrency(segment.revenue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Avg CLV:</span>
                <span className="font-medium" style={{ color: segment.color }}>
                  {formatCurrency(segment.clv)}
                </span>
              </div>
              <p className="text-xs text-gray-500">{segment.description}</p>
              
              {/* Traits */}
              <div className="flex flex-wrap gap-1 mt-2">
                {segment.traits.map((trait, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {trait}
                  </Badge>
                ))}
              </div>
              
              {selectedSegment === segment.id && (
                <Button size="sm" className="w-full mt-3" style={{ backgroundColor: segment.color }}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
              )}
            </div>
          </DatabricksCard>
        ))}
      </div>

      {/* Detailed Segment Analysis */}
      {selectedSegment && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {customerSegments.find(s => s.id === selectedSegment)?.name} Segment Analysis
            </h2>
            <Button variant="outline" onClick={() => setSelectedSegment(null)}>
              Close Details
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Behavioral Metrics */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 flex items-center">
                <ShoppingCart className="h-5 w-5 mr-2" />
                Behavioral Metrics
              </h3>
              {Object.entries(segmentDetails[selectedSegment].behavior).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-sm text-gray-600 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                  </span>
                  <span className="text-sm font-medium">
                    {key.includes('Rate') || key.includes('Frequency') ? 
                      `${value}${key.includes('Rate') ? '%' : '/month'}` : 
                      formatCurrency(value)
                    }
                  </span>
                </div>
              ))}
            </div>

            {/* Demographics */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Demographics
              </h3>
              {Object.entries(segmentDetails[selectedSegment].demographics).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-sm text-gray-600 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                  </span>
                  <span className="text-sm font-medium">
                    {key === 'avgAge' ? `${value} years` : value}
                  </span>
                </div>
              ))}
            </div>

            {/* Preferences */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 flex items-center">
                <Heart className="h-5 w-5 mr-2" />
                Preferences
              </h3>
              {Object.entries(segmentDetails[selectedSegment].preferences).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <span className="text-sm text-gray-600 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                  </span>
                  {Array.isArray(value) ? (
                    <div className="flex flex-wrap gap-1">
                      {value.map((item, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm font-medium block">{value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CLV Trends Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DatabricksCard title="Customer Lifetime Value Trends" className="col-span-1">
          <DatabricksChart
            type="line"
            data={clvTrends}
            xAxisKey="month"
            yAxisKey="platinum"
            additionalLines={[
              { key: 'gold', color: '#f59e0b' },
              { key: 'silver', color: '#6b7280' },
              { key: 'bronze', color: '#cd7f32' }
            ]}
            height={300}
          />
        </DatabricksCard>

        <DatabricksCard title="Engagement Metrics by Segment" className="col-span-1">
          <DatabricksChart
            type="bar"
            data={engagementData}
            xAxisKey="segment"
            yAxisKey="emailOpen"
            additionalBars={[
              { key: 'clickThrough', color: '#3b82f6' },
              { key: 'conversion', color: '#10b981' }
            ]}
            height={300}
          />
        </DatabricksCard>
      </div>

      {/* Key Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Target className="h-5 w-5 mr-2 text-blue-600" />
          Key Insights & Recommendations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <Award className="h-5 w-5 text-purple-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Platinum Segment Excellence</p>
                <p className="text-sm text-gray-600">
                  94% retention rate and 45% referral rate. Focus on VIP experiences and exclusive offerings.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Silver Segment Opportunity</p>
                <p className="text-sm text-gray-600">
                  Large customer base (5.2K) with growth potential. Implement loyalty programs and personalized offers.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <TrendingDown className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Bronze Segment Challenge</p>
                <p className="text-sm text-gray-600">
                  High churn rate (65%). Focus on onboarding experience and value demonstration.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <ArrowRight className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Next Steps</p>
                <p className="text-sm text-gray-600">
                  Implement segment-specific marketing campaigns and track CLV improvement metrics.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}