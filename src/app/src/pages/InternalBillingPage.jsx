import React from 'react'
import { ArrowLeftRight, AlertTriangle, Building2, TrendingUp } from 'lucide-react'
import { DatabricksCard } from '../components/DatabricksCard'
import { DatabricksChart } from '../components/DatabricksChart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const billingByService = [
  { service: 'IT Infrastructure', amount: 4500000 },
  { service: 'Fleet Management', amount: 3200000 },
  { service: 'Facilities Maint.', amount: 2800000 },
  { service: 'Legal Services', amount: 1900000 },
  { service: 'HR Services', amount: 1500000 },
  { service: 'Print Services', amount: 800000 },
  { service: 'Mail Services', amount: 600000 },
  { service: 'Security', amount: 450000 }
]

const billingTrend = [
  { month: 'Jul', billing: 1200000 },
  { month: 'Aug', billing: 1350000 },
  { month: 'Sep', billing: 1180000 },
  { month: 'Oct', billing: 1420000 },
  { month: 'Nov', billing: 1290000 },
  { month: 'Dec', billing: 980000 },
  { month: 'Jan', billing: 1380000 },
  { month: 'Feb', billing: 1450000 },
  { month: 'Mar', billing: 1520000 },
  { month: 'Apr', billing: 1310000 },
  { month: 'May', billing: 1480000 },
  { month: 'Jun', billing: 1190000 }
]

const anomalies = [
  { id: 1, source: 'Internal Services', target: 'Mental Health', amount: '$245,000', service: 'IT Infrastructure', date: '2024-11-05', type: 'Unusual amount spike', severity: 'High' },
  { id: 2, source: 'Public Works', target: 'Fire', amount: '$180,000', service: 'Fleet Management', date: '2024-10-18', type: 'Off-cycle billing', severity: 'Medium' },
  { id: 3, source: 'Internal Services', target: 'Sheriff', amount: '$92,000', service: 'Facilities Maintenance', date: '2024-09-22', type: 'Duplicate charge detected', severity: 'High' },
  { id: 4, source: 'CEO', target: 'Probation', amount: '$67,000', service: 'Legal Services', date: '2024-08-15', type: 'New service type', severity: 'Low' },
  { id: 5, source: 'Internal Services', target: 'Health Services', amount: '$315,000', service: 'IT Infrastructure', date: '2024-12-01', type: 'Amount exceeds 2x historical avg', severity: 'High' }
]

const topFlows = [
  { source: 'Internal Services', target: 'Health Services', total: '$4.2M', count: 48 },
  { source: 'Internal Services', target: 'Sheriff', total: '$3.8M', count: 36 },
  { source: 'Public Works', target: 'Fire', total: '$2.1M', count: 24 },
  { source: 'CEO', target: 'Public Social Services', total: '$1.5M', count: 18 },
  { source: 'Internal Services', target: 'Mental Health', total: '$1.2M', count: 15 }
]

const severityColors = {
  High: 'bg-red-100 text-red-800',
  Medium: 'bg-amber-100 text-amber-800',
  Low: 'bg-blue-100 text-blue-800'
}

export function InternalBillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Internal Billing</h2>
        <p className="text-gray-500 mt-1">Inter-departmental service charges, cost allocation, and AI-powered anomaly detection</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DatabricksCard title="Total Billing YTD" value="$15.75M" trend={{ direction: 'up', value: '+8% vs prior' }} icon={ArrowLeftRight} variant="accent" />
        <DatabricksCard title="Anomalies Detected" value="5" trend={{ direction: 'up', value: '3 high severity' }} icon={AlertTriangle} variant="warning" />
        <DatabricksCard title="Departments Involved" value="12" trend={{ direction: 'up', value: '80% coverage' }} icon={Building2} variant="success" />
        <DatabricksCard title="Avg Monthly Billing" value="$1.31M" trend={{ direction: 'up', value: '+5% trend' }} icon={TrendingUp} variant="info" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DatabricksChart
          type="bar"
          data={billingByService}
          xKey="service"
          yKeys={['amount']}
          title="Billing by Service Type"
          subtitle="YTD inter-departmental charges"
          height={320}
        />
        <DatabricksChart
          type="line"
          data={billingTrend}
          xKey="month"
          yKeys={['billing']}
          title="Monthly Billing Trend"
          subtitle="FY2024-25 billing volume"
          height={320}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            AI-Detected Anomalies
          </CardTitle>
          <CardDescription>Machine learning model identifies billing patterns that deviate from historical norms</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Source Dept</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Target Dept</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Service</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Anomaly Type</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">Severity</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map(a => (
                  <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{a.source}</td>
                    <td className="py-3 px-4 text-gray-600">{a.target}</td>
                    <td className="py-3 px-4 text-gray-600">{a.service}</td>
                    <td className="py-3 px-4 text-right font-mono">{a.amount}</td>
                    <td className="py-3 px-4 text-gray-600">{a.date}</td>
                    <td className="py-3 px-4 text-gray-600 text-xs">{a.type}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge className={severityColors[a.severity]}>{a.severity}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Billing Flows</CardTitle>
          <CardDescription>Highest-volume inter-departmental billing relationships</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topFlows.map((flow, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-300">#{i + 1}</span>
                  <div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{flow.source}</span>
                      <ArrowLeftRight className="h-3 w-3 text-gray-400" />
                      <span className="font-medium">{flow.target}</span>
                    </div>
                    <p className="text-xs text-gray-500">{flow.count} transactions</p>
                  </div>
                </div>
                <span className="font-semibold text-gray-900">{flow.total}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
