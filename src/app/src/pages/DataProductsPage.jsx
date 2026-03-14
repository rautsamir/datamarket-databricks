import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, Database, Lock, Globe, Shield, RefreshCw, Layers, User } from 'lucide-react'

const dataProducts = [
  { id: 1, name: 'Vendor Master Data', description: 'Comprehensive vendor registry with compliance certification status and risk scoring', domain: 'Procurement', owner: 'Maria Chen', dept: 'Finance & Accounting', classification: 'Internal', source: 'ERP', refresh: 'Daily', tables: 5, rows: '45K', quality: 94, tags: ['vendor', 'procurement', 'risk'], status: 'Active' },
  { id: 2, name: 'Budget & Expenditure Analytics', description: 'Departmental budget allocations, actuals, encumbrances, and variance analysis', domain: 'Finance', owner: 'James Park', dept: 'Finance & Accounting', classification: 'Internal', source: 'ERP', refresh: 'Daily', tables: 8, rows: '2.5M', quality: 91, tags: ['budget', 'finance'], status: 'Active' },
  { id: 3, name: 'Employee Payroll & Benefits', description: 'Employee compensation, benefits, overtime tracking, and mileage reimbursements', domain: 'HR', owner: 'Sarah Kim', dept: 'CEO', classification: 'Confidential', source: 'HRIS', refresh: 'Weekly', tables: 12, rows: '8.5M', quality: 88, tags: ['payroll', 'HR'], status: 'Active' },
  { id: 4, name: 'Vendor Payment Transactions', description: 'All vendor payments with commodity codes, POs, and fraud detection indicators', domain: 'Procurement', owner: 'Maria Chen', dept: 'Finance & Accounting', classification: 'Internal', source: 'ERP', refresh: 'Daily', tables: 6, rows: '15M', quality: 92, tags: ['payments', 'fraud'], status: 'Active' },
  { id: 5, name: 'Internal Billing & Cost Allocation', description: 'Inter-departmental service charges and billing anomaly detection', domain: 'Finance', owner: 'James Park', dept: 'Finance & Accounting', classification: 'Internal', source: 'ERP', refresh: 'Monthly', tables: 4, rows: '350K', quality: 87, tags: ['billing', 'cost-allocation'], status: 'Active' },
  { id: 6, name: 'Property Tax Revenue', description: 'Property tax assessments, collections, delinquencies, and revenue forecasting', domain: 'Revenue', owner: 'Robert Lee', dept: 'Treasurer-Tax Collector', classification: 'Confidential', source: 'PTMS', refresh: 'Daily', tables: 7, rows: '3.2M', quality: 90, tags: ['property-tax', 'revenue'], status: 'Active' },
  { id: 7, name: 'Contract Management', description: 'Active contracts, amendments, compliance tracking, and expiration monitoring', domain: 'Procurement', owner: 'Diana Torres', dept: 'Internal Services', classification: 'Internal', source: 'eProcurement', refresh: 'Daily', tables: 9, rows: '125K', quality: 85, tags: ['contracts', 'compliance'], status: 'Active' },
  { id: 8, name: 'Fraud Detection Risk Indicators', description: 'AI/ML-generated fraud risk scores, anomaly flags, and investigation tracking', domain: 'Analytics', owner: 'David Nguyen', dept: 'Finance & Accounting', classification: 'Restricted', source: 'DNA Analytics', refresh: 'Daily', tables: 3, rows: '85K', quality: 93, tags: ['fraud', 'AI', 'risk'], status: 'Active' },
  { id: 9, name: 'Department Performance Metrics', description: 'KPIs, service delivery metrics, and operational benchmarks', domain: 'Operations', owner: 'Angela Wright', dept: 'CEO', classification: 'Internal', source: 'Multiple', refresh: 'Monthly', tables: 6, rows: '450K', quality: 82, tags: ['KPI', 'performance'], status: 'Active' },
  { id: 10, name: 'Voter Registration & Elections', description: 'Voter registration records, election results, and polling location analytics', domain: 'Elections', owner: 'Michael Chang', dept: 'Registrar-Recorder', classification: 'Public', source: 'VEMS', refresh: 'As-Needed', tables: 4, rows: '5.8M', quality: 89, tags: ['elections', 'voter'], status: 'Active' }
]

const domainColors = {
  Procurement: 'bg-blue-100 text-blue-800',
  Finance: 'bg-emerald-100 text-emerald-800',
  HR: 'bg-purple-100 text-purple-800',
  Revenue: 'bg-amber-100 text-amber-800',
  Analytics: 'bg-red-100 text-red-800',
  Operations: 'bg-gray-100 text-gray-800',
  Elections: 'bg-indigo-100 text-indigo-800'
}

const classificationIcons = {
  Public: Globe,
  Internal: Shield,
  Confidential: Lock,
  Restricted: Lock
}

const domains = ['All', ...new Set(dataProducts.map(p => p.domain))]

export function DataProductsPage() {
  const [search, setSearch] = useState('')
  const [selectedDomain, setSelectedDomain] = useState('All')

  const filtered = dataProducts.filter(p => {
    const matchesSearch = search === '' || 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchesDomain = selectedDomain === 'All' || p.domain === selectedDomain
    return matchesSearch && matchesDomain
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Data Product Catalog</h2>
        <p className="text-gray-500 mt-1">Discover, explore, and request access to enterprise data products across Your Organization</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search data products, tags, descriptions..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {domains.map(domain => (
          <button
            key={domain}
            onClick={() => setSelectedDomain(domain)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedDomain === domain
                ? 'bg-[#003366] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {domain} {domain !== 'All' && `(${dataProducts.filter(p => p.domain === domain).length})`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(product => {
          const ClassIcon = classificationIcons[product.classification] || Shield
          return (
            <Card key={product.id} className="hover:shadow-lg transition-shadow border border-gray-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-xs ${domainColors[product.domain] || 'bg-gray-100 text-gray-800'}`}>
                        {product.domain}
                      </Badge>
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <ClassIcon className="h-3 w-3" />
                        {product.classification}
                      </Badge>
                    </div>
                    <CardTitle className="text-base leading-tight">{product.name}</CardTitle>
                  </div>
                </div>
                <CardDescription className="text-xs mt-1 line-clamp-2">{product.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <User className="h-3 w-3" />
                    <span className="truncate">{product.owner}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <RefreshCw className="h-3 w-3" />
                    <span>{product.refresh}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Layers className="h-3 w-3" />
                    <span>{product.tables} tables</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Database className="h-3 w-3" />
                    <span>{product.rows} rows</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-500">Quality Score</span>
                    <span className={`font-semibold ${product.quality >= 90 ? 'text-emerald-600' : product.quality >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                      {product.quality}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${product.quality >= 90 ? 'bg-emerald-500' : product.quality >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${product.quality}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {product.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <Button size="sm" className="w-full text-xs" style={{ backgroundColor: '#003366' }}>
                  Request Access
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Database className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No data products found</h3>
          <p className="text-gray-500 mt-1">Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  )
}
