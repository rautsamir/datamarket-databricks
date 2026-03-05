import React, { useState } from 'react'
import { DollarSign, TrendingDown, TrendingUp, AlertCircle, PieChart } from 'lucide-react'
import { DatabricksCard } from '../components/DatabricksCard'
import { DatabricksChart } from '../components/DatabricksChart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const budgetByDept = [
  { department: 'Health Services', original: 6000000000, actual: 3650000000, variance: -5.8 },
  { department: 'Sheriff', original: 3600000000, actual: 2230000000, variance: -3.1 },
  { department: 'Public Social Services', original: 2800000000, actual: 1650000000, variance: -4.6 },
  { department: 'Mental Health', original: 2200000000, actual: 1380000000, variance: -2.3 },
  { department: 'Children & Family Svcs', original: 1900000000, actual: 1170000000, variance: -1.6 },
  { department: 'Fire', original: 1800000000, actual: 980000000, variance: 2.2 },
  { department: 'Public Works', original: 1500000000, actual: 820000000, variance: -3.3 },
  { department: 'Probation', original: 1100000000, actual: 650000000, variance: -4.5 },
  { department: 'Internal Services', original: 850000000, actual: 520000000, variance: 1.2 }
]

const budgetByCategory = [
  { category: 'Salaries & Benefits', amount: 19500000000 },
  { category: 'Services & Supplies', amount: 6000000000 },
  { category: 'Capital Projects', amount: 2400000000 },
  { category: 'Operating Supplies', amount: 1500000000 },
  { category: 'Other Charges', amount: 560000000 }
]

const varianceTrend = [
  { month: 'Jul', variance: -1.2 },
  { month: 'Aug', variance: -1.8 },
  { month: 'Sep', variance: -2.1 },
  { month: 'Oct', variance: -2.5 },
  { month: 'Nov', variance: -3.0 },
  { month: 'Dec', variance: -2.8 },
  { month: 'Jan', variance: -3.2 },
  { month: 'Feb', variance: -3.5 },
  { month: 'Mar', variance: -3.1 },
  { month: 'Apr', variance: -2.9 },
  { month: 'May', variance: -3.4 },
  { month: 'Jun', variance: -3.8 }
]

const selectedDeptFilter = ['All', ...budgetByDept.map(d => d.department)]

export function BudgetFinancePage() {
  const [filter, setFilter] = useState('All')

  const filtered = filter === 'All' ? budgetByDept : budgetByDept.filter(d => d.department === filter)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Budget & Finance</h2>
        <p className="text-gray-500 mt-1">FY2024-25 departmental budget allocations, expenditure tracking, and variance analysis</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DatabricksCard title="Total Budget" value="$29.96B" trend={{ direction: 'up', value: '+4.2% YoY' }} icon={DollarSign} variant="accent" />
        <DatabricksCard title="Total Expenditure" value="$13.05B" trend={{ direction: 'up', value: '43.5% spent' }} icon={TrendingUp} variant="success" />
        <DatabricksCard title="Avg Variance" value="-3.1%" trend={{ direction: 'down', value: 'Under budget' }} icon={TrendingDown} variant="warning" />
        <DatabricksCard title="Over-budget Depts" value="2" trend={{ direction: 'up', value: 'Fire, Internal Svcs' }} icon={AlertCircle} variant="info" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DatabricksChart
          type="bar"
          data={budgetByDept.map(d => ({ dept: d.department.length > 15 ? d.department.slice(0, 15) + '...' : d.department, actual: d.actual }))}
          xKey="dept"
          yKeys={['actual']}
          title="Actual Expenditure by Department"
          subtitle="FY2024-25 year-to-date spending"
          height={320}
        />
        <DatabricksChart
          type="bar"
          data={budgetByCategory}
          xKey="category"
          yKeys={['amount']}
          title="Budget by Category"
          subtitle="County-wide budget allocation"
          height={320}
        />
      </div>

      <DatabricksChart
        type="line"
        data={varianceTrend}
        xKey="month"
        yKeys={['variance']}
        title="Budget Variance Trend"
        subtitle="Monthly cumulative variance (%) — negative = under budget"
        height={260}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Department Budget Details</CardTitle>
          <CardDescription>Original budget vs. actual expenditure with variance analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Department</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Original Budget</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Actual Expenditure</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">% Spent</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Variance</th>
                </tr>
              </thead>
              <tbody>
                {budgetByDept.map((d, i) => {
                  const pctSpent = ((d.actual / d.original) * 100).toFixed(1)
                  return (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{d.department}</td>
                      <td className="py-3 px-4 text-right font-mono">${(d.original / 1e9).toFixed(2)}B</td>
                      <td className="py-3 px-4 text-right font-mono">${(d.actual / 1e9).toFixed(2)}B</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(pctSpent, 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{pctSpent}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge className={d.variance > 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}>
                          {d.variance > 0 ? '+' : ''}{d.variance}%
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <PieChart className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Embedded AI/BI Dashboard</h4>
            <p className="text-sm text-blue-700 mt-1">
              This page is also available as a native Databricks AI/BI Dashboard with drill-through capabilities, 
              scheduled email delivery, and embedded credentials for secure sharing.
            </p>
            <a href="https://adb-3438839487639471.11.azuredatabricks.net/sql/dashboardsv3/01f11210160c1964ba70f998f8be5a1f" 
               target="_blank" rel="noopener noreferrer"
               className="text-sm font-medium text-blue-600 hover:text-blue-800 mt-2 inline-block">
              Open in Databricks Dashboard →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
