import React, { useState } from 'react'
import { KeyRound, Clock, CheckCircle2, XCircle, Plus, Database, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const myRequests = [
  { id: 'AR-001', product: 'Employee Payroll & Benefits', requested: '2024-12-18', status: 'Approved', approver: 'Sarah Kim', dept: 'CEO', accessLevel: 'Read' },
  { id: 'AR-002', product: 'Fraud Detection Risk Indicators', requested: '2024-12-20', status: 'Pending', approver: 'David Nguyen', dept: 'Auditor-Controller', accessLevel: 'Read' },
  { id: 'AR-003', product: 'Property Tax Revenue', requested: '2024-12-22', status: 'Pending', approver: 'Robert Lee', dept: 'Treasurer-Tax Collector', accessLevel: 'Read' },
  { id: 'AR-004', product: 'Contract Management', requested: '2024-11-15', status: 'Denied', approver: 'Diana Torres', dept: 'Internal Services', accessLevel: 'Write', reason: 'Insufficient business justification' },
  { id: 'AR-005', product: 'Vendor Master Data', requested: '2024-11-01', status: 'Approved', approver: 'Maria Chen', dept: 'Auditor-Controller', accessLevel: 'Read' }
]

const availableProducts = [
  { name: 'Budget & Expenditure Analytics', classification: 'Internal', owner: 'James Park' },
  { name: 'Internal Billing & Cost Allocation', classification: 'Internal', owner: 'James Park' },
  { name: 'Voter Registration & Elections', classification: 'Public', owner: 'Michael Chang' },
  { name: 'Department Performance Metrics', classification: 'Internal', owner: 'Angela Wright' }
]

const statusConfig = {
  Approved: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-800', iconColor: 'text-emerald-500' },
  Pending: { icon: Clock, color: 'bg-amber-100 text-amber-800', iconColor: 'text-amber-500' },
  Denied: { icon: XCircle, color: 'bg-red-100 text-red-800', iconColor: 'text-red-500' }
}

export function AccessRequestsPage() {
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Access Requests</h2>
          <p className="text-gray-500 mt-1">Request and manage access to data products via Unity Catalog RBAC</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} style={{ backgroundColor: '#003366' }}>
          <Plus className="h-4 w-4 mr-2" />
          New Request
        </Button>
      </div>

      {showForm && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-lg">New Access Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Data Product</label>
              <select className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Choose a data product...</option>
                {availableProducts.map((p, i) => (
                  <option key={i} value={p.name}>{p.name} ({p.classification})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access Level</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="radio" name="access" defaultChecked className="text-blue-600" />
                  <span className="text-sm">Read Only</span>
                </label>
                <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="radio" name="access" className="text-blue-600" />
                  <span className="text-sm">Read + Write</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Justification</label>
              <textarea
                rows={3}
                placeholder="Explain why you need access to this data product..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <Button style={{ backgroundColor: '#003366' }}>Submit Request</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold text-amber-900">{myRequests.filter(r => r.status === 'Pending').length}</p>
              <p className="text-xs text-amber-700">Pending Requests</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold text-emerald-900">{myRequests.filter(r => r.status === 'Approved').length}</p>
              <p className="text-xs text-emerald-700">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-900">{myRequests.filter(r => r.status === 'Denied').length}</p>
              <p className="text-xs text-red-700">Denied</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">My Access Requests</CardTitle>
          <CardDescription>Track the status of your data product access requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Request ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Data Product</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Access Level</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Requested</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Approver</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map(r => {
                  const config = statusConfig[r.status]
                  const StatusIcon = config.icon
                  return (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-xs">{r.id}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Database className="h-3.5 w-3.5 text-gray-400" />
                          <span className="font-medium">{r.product}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs flex items-center gap-1 w-fit">
                          <Shield className="h-3 w-3" />
                          {r.accessLevel}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{r.requested}</td>
                      <td className="py-3 px-4 text-gray-600">{r.approver}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge className={`${config.color} flex items-center gap-1 w-fit mx-auto`}>
                          <StatusIcon className={`h-3 w-3 ${config.iconColor}`} />
                          {r.status}
                        </Badge>
                        {r.reason && <p className="text-[10px] text-red-500 mt-1">{r.reason}</p>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-gray-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-900 text-sm">How Access Control Works</h4>
              <p className="text-xs text-gray-600 mt-1">
                Access requests are routed to the data product owner and IT Security for approval. 
                Once approved, permissions are granted via Unity Catalog Role-Based Access Control (RBAC), 
                integrated with County Entra ID for authentication. All access is audited and logged.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
