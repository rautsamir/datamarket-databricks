import React from 'react'
import { ShieldAlert, Users, AlertTriangle, DollarSign } from 'lucide-react'
import { DatabricksCard } from '../components/DatabricksCard'
import { DatabricksChart } from '../components/DatabricksChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const flaggedPayments = [
  { vendor: 'GreenBuild Construction', department: 'Public Works', amount: '$485,000', date: '2024-11-15', reason: 'Amount exceeds 3x historical average' },
  { vendor: 'Pacific Health Services', department: 'Health Services', amount: '$1,250,000', date: '2024-10-22', reason: 'Duplicate invoice detected' },
  { vendor: 'LA Digital Solutions', department: 'Internal Services', amount: '$178,000', date: '2024-09-30', reason: 'PO Box address mismatch' },
  { vendor: 'Metro Security Services', department: 'Sheriff', amount: '$892,000', date: '2024-08-18', reason: 'Payment outside contract period' },
  { vendor: 'Sunshine Consulting', department: 'CEO', amount: '$245,000', date: '2024-07-05', reason: 'Vendor registered < 30 days before payment' }
]

const riskDistribution = [
  { risk: 'Low (0-0.25)', count: 4 },
  { risk: 'Medium (0.25-0.50)', count: 3 },
  { risk: 'High (0.50-0.75)', count: 2 },
  { risk: 'Critical (0.75+)', count: 1 }
]

const paymentsByDept = [
  { dept: 'Health Services', payments: 2850000 },
  { dept: 'Public Works', payments: 1950000 },
  { dept: 'Sheriff', payments: 1650000 },
  { dept: 'Internal Services', payments: 980000 },
  { dept: 'CEO', payments: 750000 },
  { dept: 'Fire', payments: 620000 },
  { dept: 'Treasurer', payments: 480000 },
  { dept: 'Assessor', payments: 320000 }
]

export function VendorAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Vendor Analytics</h2>
        <p className="text-gray-500 mt-1">Payment tracking, risk scoring, and fraud detection across all County vendors</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DatabricksCard title="Total Vendors" value="10" trend={{ direction: 'up', value: '+2 YTD' }} icon={Users} variant="accent" />
        <DatabricksCard title="LSBE Vendors" value="6" trend={{ direction: 'up', value: '60%' }} icon={Users} variant="success" />
        <DatabricksCard title="Prop A Vendors" value="4" trend={{ direction: 'up', value: '40%' }} icon={Users} variant="warning" />
        <DatabricksCard title="Flagged Payments" value="5" trend={{ direction: 'up', value: 'Requires review' }} icon={AlertTriangle} variant="info" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <DatabricksChart
          type="bar"
          data={paymentsByDept}
          xKey="dept"
          yKeys={['payments']}
          title="Vendor Payments by Department"
          subtitle="YTD payment volume"
          height={300}
        />
        <DatabricksChart
          type="bar"
          data={riskDistribution}
          xKey="risk"
          yKeys={['count']}
          title="Vendor Risk Score Distribution"
          subtitle="Distribution of AI-generated risk scores"
          height={300}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            Flagged Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Vendor</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Department</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Flag Reason</th>
                </tr>
              </thead>
              <tbody>
                {flaggedPayments.map((p, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{p.vendor}</td>
                    <td className="py-3 px-4 text-gray-600">{p.department}</td>
                    <td className="py-3 px-4 text-right font-mono">{p.amount}</td>
                    <td className="py-3 px-4 text-gray-600">{p.date}</td>
                    <td className="py-3 px-4">
                      <Badge variant="destructive" className="text-xs font-normal">
                        {p.reason}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
