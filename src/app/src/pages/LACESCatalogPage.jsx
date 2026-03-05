import React, { useState } from 'react'
import { Search, SlidersHorizontal, BarChart3, FileText, Database, ChevronLeft, ChevronRight } from 'lucide-react'

const LACES_BLUE = '#003865'

const categories = ['All', 'Property Tax', 'Audit', 'Accounting', 'eCAPS', 'Demographics', 'GIS', 'Health Services', 'Public Safety', 'eHR', 'Payroll', 'Budget']
const types = ['All', 'Dashboard', 'Dataset', 'Report']

const allProducts = [
  { id: 1, name: 'Budget Expenditure Report', category: 'Budget', type: 'Dashboard', source: 'eCAPS', description: 'Departmental budget allocations and year-to-date expenditures with variance analysis across all County divisions.', refreshFrequency: 'Daily', owner: 'james.park', lastUpdated: '02/11/2025', tags: ['Budget', 'eCAPS'] },
  { id: 2, name: 'Employee Metrics Dashboard', category: 'eHR', type: 'Dashboard', source: 'eHR', description: 'Headcount, turnover rates, overtime trends, and compensation metrics segmented by department and bargaining unit.', refreshFrequency: 'Weekly', owner: 'sarah.kim', lastUpdated: '02/11/2025', tags: ['eHR', 'HR'] },
  { id: 3, name: 'Property Tax Report 2024', category: 'Property Tax', type: 'Report', source: 'Property Tax', description: 'Annual property tax assessments, collection rates, delinquency analysis, and revenue projections for FY2024.', refreshFrequency: 'Weekly', owner: 'robert.lee', lastUpdated: '02/11/2025', tags: ['Property Tax', 'Revenue'] },
  { id: 4, name: 'Census 2023 Dataset', category: 'Demographics', type: 'Dataset', source: 'Demographics', description: 'LA County population demographics by census tract including age, income, household size, and language.', refreshFrequency: 'Annual', owner: 'diana.torres', lastUpdated: '02/11/2025', tags: ['Demographics'] },
  { id: 5, name: 'Service Ticket Tracking Report', category: 'Accounting', type: 'Report', source: 'IT', description: 'Internal IT service requests, resolution times, SLA compliance, and department utilization metrics.', refreshFrequency: 'Daily', owner: 'michael.chang', lastUpdated: '02/11/2025', tags: ['IT'] },
  { id: 6, name: 'Essential Service Usage Report', category: 'Health Services', type: 'Report', source: 'Health Services', description: 'Utilization rates for essential County services including health clinics, mental health centers, and social services.', refreshFrequency: 'Monthly', owner: 'angela.wright', lastUpdated: '02/11/2025', tags: ['Health Services'] },
  { id: 7, name: 'Payroll Dashboard', category: 'Payroll', type: 'Dashboard', source: 'eHR', description: 'County-wide payroll expenditures, overtime costs, benefits allocation, and headcount by department.', refreshFrequency: 'Daily', owner: 'james.park', lastUpdated: '02/11/2025', tags: ['Payroll', 'eHR'] },
  { id: 8, name: 'Property Tax Dashboard', category: 'Property Tax', type: 'Dashboard', source: 'Property Tax', description: 'Real-time property tax collection status, delinquency rates, and revenue tracking against annual targets.', refreshFrequency: 'Daily', owner: 'robert.lee', lastUpdated: '02/11/2025', tags: ['Property Tax'] },
  { id: 9, name: 'Population by Age 2020 Dataset', category: 'Demographics', type: 'Dataset', source: 'Demographics', description: 'Age-stratified population data from the 2020 Census, segmented by supervisorial district and community.', refreshFrequency: 'Annual', owner: 'diana.torres', lastUpdated: '02/11/2025', tags: ['Demographics'] },
  { id: 10, name: 'DnA Datahub Budget Expense Dashboard', category: 'Budget', type: 'Dashboard', source: 'eCAPS', description: 'Comprehensive budget allocation, expenditure tracking, and variance analysis for FY2024-25.', refreshFrequency: 'Daily', owner: 'john.doe', lastUpdated: '02/11/2025', tags: ['Budget', 'Financial', 'eCAPS'] },
  { id: 11, name: 'Audit Finding Tracker', category: 'Audit', type: 'Report', source: 'Audit', description: 'Open and resolved audit findings by department, risk level, and remediation timeline.', refreshFrequency: 'Weekly', owner: 'david.nguyen', lastUpdated: '02/11/2025', tags: ['Audit'] },
  { id: 12, name: 'GIS Infrastructure Map', category: 'GIS', type: 'Dataset', source: 'GIS', description: 'Geospatial data for County infrastructure including roads, utilities, facilities, and service boundaries.', refreshFrequency: 'Monthly', owner: 'john.doe', lastUpdated: '02/11/2025', tags: ['GIS'] },
]

const tagColors = {
  Budget: 'bg-blue-100 text-blue-800', Financial: 'bg-green-100 text-green-800',
  eCAPS: 'bg-purple-100 text-purple-800', Payroll: 'bg-orange-100 text-orange-800',
  HR: 'bg-pink-100 text-pink-800', 'Property Tax': 'bg-amber-100 text-amber-800',
  Revenue: 'bg-teal-100 text-teal-800', eHR: 'bg-indigo-100 text-indigo-800',
  Demographics: 'bg-rose-100 text-rose-800', Audit: 'bg-red-100 text-red-800',
  IT: 'bg-gray-100 text-gray-800', GIS: 'bg-cyan-100 text-cyan-800',
  'Health Services': 'bg-emerald-100 text-emerald-800',
}

const typeIcons = { Dashboard: BarChart3, Report: FileText, Dataset: Database }
const PAGE_SIZE = 6

export function LACESCatalogPage({ onOpenProduct, initialSearch = '' }) {
  const [search, setSearch] = useState(initialSearch)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedType, setSelectedType] = useState('All')
  const [sortBy, setSortBy] = useState('Most Recent')
  const [page, setPage] = useState(1)

  const filtered = allProducts.filter(p => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.tags.some(t => t.toLowerCase().includes(search.toLowerCase())) || p.description.toLowerCase().includes(search.toLowerCase())
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory
    const matchesType = selectedType === 'All' || p.type === selectedType
    return matchesSearch && matchesCat && matchesType
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Catalog</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} data products available</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Sort By</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none"
            >
              <option>Most Recent</option>
              <option>Name A-Z</option>
              <option>Name Z-A</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Filters */}
        <aside className="w-52 shrink-0 hidden md:block">
          {/* Search */}
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>

          {/* Filter By Category */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <SlidersHorizontal className="h-3 w-3" /> Filter By
            </p>
            <div className="space-y-0.5">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => { setSelectedCategory(cat); setPage(1) }}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                    selectedCategory === cat
                      ? 'font-medium text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  style={selectedCategory === cat ? { backgroundColor: LACES_BLUE } : {}}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Type</p>
            <div className="flex flex-wrap gap-1.5">
              {types.map(t => (
                <button
                  key={t}
                  onClick={() => { setSelectedType(t); setPage(1) }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedType === t ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={selectedType === t ? { backgroundColor: LACES_BLUE } : {}}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Grid */}
        <div className="flex-1 min-w-0">
          {/* Mobile search */}
          <div className="relative mb-4 md:hidden">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>

          <div className="space-y-3">
            {paged.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <Database className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No data products match your filters.</p>
              </div>
            )}
            {paged.map(product => {
              const Icon = typeIcons[product.type] || BarChart3
              return (
                <button
                  key={product.id}
                  onClick={() => onOpenProduct(product)}
                  className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#E8F0F7' }}>
                      <Icon className="h-5 w-5" style={{ color: LACES_BLUE }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <h3 className="font-semibold text-gray-900 text-sm group-hover:text-blue-700 transition-colors">{product.name}</h3>
                        <div className="flex flex-wrap gap-1 shrink-0">
                          {product.tags.map(tag => (
                            <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tagColors[tag] || 'bg-gray-100 text-gray-700'}`}>{tag}</span>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span>↻ {product.refreshFrequency}</span>
                        <span>Owner: {product.owner}</span>
                        <span>Updated: {product.lastUpdated}</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 rounded text-sm font-medium transition-colors ${page === n ? 'text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  style={page === n ? { backgroundColor: LACES_BLUE } : {}}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
