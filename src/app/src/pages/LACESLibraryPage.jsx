import React, { useState } from 'react'
import { Search, Plus, BarChart3, FileText, Database, BookmarkCheck } from 'lucide-react'
import { usePersona } from '../context/PersonaContext'

const DataMarket_BLUE = '#003865'

const tagColors = {
  Budget: 'bg-blue-100 text-blue-800', Financial: 'bg-green-100 text-green-800',
  eCAPS: 'bg-purple-100 text-purple-800', Payroll: 'bg-orange-100 text-orange-800',
  HR: 'bg-pink-100 text-pink-800', 'Property Tax': 'bg-amber-100 text-amber-800',
  Revenue: 'bg-teal-100 text-teal-800', eHR: 'bg-indigo-100 text-indigo-800',
  Demographics: 'bg-rose-100 text-rose-800', Audit: 'bg-red-100 text-red-800',
  'Health Services': 'bg-emerald-100 text-emerald-800',
}

const myItems = [
  { id: 1, name: 'Budget Expenditure Report', tags: ['Budget', 'eCAPS'], type: 'Dashboard', source: 'eCAPS', refreshFrequency: 'Daily', owner: 'james.park', lastUpdated: '02/11/2025', status: 'Approved' },
  { id: 2, name: 'Employee Metrics Dashboard', tags: ['eHR'], type: 'Dashboard', source: 'eHR', refreshFrequency: 'Weekly', owner: 'sarah.kim', lastUpdated: '02/11/2025', status: 'Approved' },
  { id: 3, name: 'Property Tax Report 2024', tags: ['Property Tax'], type: 'Report', source: 'Property Tax', refreshFrequency: 'Weekly', owner: 'robert.lee', lastUpdated: '02/11/2025', status: 'Approved' },
  { id: 4, name: 'Census 2023 Dataset', tags: ['Demographics'], type: 'Dataset', source: 'Demographics', refreshFrequency: 'Annual', owner: 'diana.torres', lastUpdated: '02/11/2025', status: 'Pending' },
  { id: 5, name: 'Payroll Dashboard', tags: ['Payroll', 'eHR'], type: 'Dashboard', source: 'eHR', refreshFrequency: 'Daily', owner: 'james.park', lastUpdated: '02/11/2025', status: 'Approved' },
  { id: 6, name: 'Essential Service Usage Report', tags: ['Health Services'], type: 'Report', source: 'Health Services', refreshFrequency: 'Monthly', owner: 'angela.wright', lastUpdated: '02/11/2025', status: 'Pending' },
  { id: 7, name: 'DnA Datahub Budget Expense Dashboard', tags: ['Budget', 'Financial', 'eCAPS'], type: 'Dashboard', source: 'eCAPS', refreshFrequency: 'Daily', owner: 'john.doe', lastUpdated: '02/11/2025', status: 'Approved' },
  { id: 8, name: 'Audit Finding Tracker', tags: ['Audit'], type: 'Report', source: 'Audit', refreshFrequency: 'Weekly', owner: 'david.nguyen', lastUpdated: '02/11/2025', status: 'Approved' },
]

const statusConfig = {
  Approved: 'bg-emerald-100 text-emerald-800',
  Pending: 'bg-amber-100 text-amber-800',
  Denied: 'bg-red-100 text-red-800',
}

export function DataMarketLibraryPage({ onNavigate, onOpenProduct }) {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('Data Product')
  const { myRequests, persona } = usePersona()

  // Merge static approved items (based on persona) with dynamic request-based items
  const approvedFromPersona = myItems.filter(item =>
    persona.approvedProducts === 'all' || (Array.isArray(persona.approvedProducts) && persona.approvedProducts.includes(item.id))
  ).map(item => ({ ...item, status: 'Approved' }))

  const fromRequests = myRequests.map(r => {
    const base = myItems.find(i => i.id === r.productId) || { id: r.productId, name: r.productName, tags: [], type: 'Dashboard', source: '-', refreshFrequency: '-', owner: '-', lastUpdated: '-' }
    return { ...base, status: r.status }
  })

  // Deduplicate: prefer request status over persona default
  const requestProductIds = new Set(fromRequests.map(r => r.id))
  const mergedItems = [
    ...approvedFromPersona.filter(i => !requestProductIds.has(i.id)),
    ...fromRequests
  ]

  const filtered = mergedItems.filter(item =>
    !search || item.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Library</h1>
          <p className="text-sm text-gray-500 mt-1">Your saved and requested data products</p>
        </div>
        <button
          onClick={() => onNavigate('register')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: DataMarket_BLUE }}
        >
          <Plus className="h-4 w-4" /> Register Product
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {['Data Product', 'Request'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
              {tab === 'Data Product' ? mergedItems.filter(i => i.status === 'Approved').length : mergedItems.filter(i => i.status === 'Pending').length}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search"
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Name</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Tags</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Data Source Type</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Refresh Frequency</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Data Source Owner</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Last Updated</th>
                <th className="text-center py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">My Library</th>
                <th className="text-center py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Request</th>
              </tr>
            </thead>
            <tbody>
              {filtered
                .filter(item => activeTab === 'Data Product' ? item.status === 'Approved' : ['Pending', 'Denied'].includes(item.status))
                .map((item, i) => {
                  const Icon = { Dashboard: BarChart3, Report: FileText, Dataset: Database }[item.type] || Database
                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onOpenProduct(item)}
                          className="flex items-center gap-2.5 hover:text-blue-700 transition-colors text-left"
                        >
                          <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: '#E8F0F7' }}>
                            <Icon className="h-3.5 w-3.5" style={{ color: DataMarket_BLUE }} />
                          </div>
                          <span className="font-medium text-gray-900 text-xs">{item.name}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {item.tags.map(tag => (
                            <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tagColors[tag] || 'bg-gray-100 text-gray-700'}`}>{tag}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600">{item.type}</td>
                      <td className="py-3 px-4 text-xs text-gray-600">{item.refreshFrequency}</td>
                      <td className="py-3 px-4 text-xs text-gray-600">{item.owner}</td>
                      <td className="py-3 px-4 text-xs text-gray-600">{item.lastUpdated}</td>
                      <td className="py-3 px-4 text-center">
                        <BookmarkCheck className="h-4 w-4 mx-auto" style={{ color: DataMarket_BLUE }} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusConfig[item.status]}`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
        {filtered.filter(item => activeTab === 'Data Product' ? item.status === 'Approved' : ['Pending', 'Denied'].includes(item.status)).length === 0 && (
          <div className="py-16 text-center text-gray-400">
            <BookmarkCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No items found.</p>
          </div>
        )}
      </div>
    </div>
  )
}
