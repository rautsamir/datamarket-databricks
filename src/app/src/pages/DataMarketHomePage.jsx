import React, { useState } from 'react'
import { Search, ArrowRight, Clock, Sparkles, BarChart3, FileText, Database, TrendingUp } from 'lucide-react'
import { usePersona } from '../context/PersonaContext'

const DataMarket_BLUE = '#003865'

const featuredProducts = [
  {
    id: 1,
    name: 'Payroll Dashboard',
    tags: ['Payroll', 'HR'],
    type: 'Dashboard',
    description: 'County-wide payroll expenditure, headcount trends, and compensation analytics across all departments and bargaining units.',
    source: 'eHR',
    refreshFrequency: 'Daily',
    owner: 'James Park'
  },
  {
    id: 2,
    name: 'DnA Datahub Budget Expense Dashboard',
    tags: ['Budget', 'Financial', 'eCAPS'],
    type: 'Dashboard',
    description: 'Comprehensive budget allocation, expenditure tracking, and variance analysis for FY2024-25 across all departments.',
    source: 'eCAPS',
    refreshFrequency: 'Daily',
    owner: 'john.doe'
  },
  {
    id: 3,
    name: 'Property Tax Report 2024',
    tags: ['Property Tax', 'Revenue'],
    type: 'Report',
    description: 'Annual property tax assessment, collection rates, delinquency analysis, and revenue projections for Your Organization.',
    source: 'Property Tax',
    refreshFrequency: 'Weekly',
    owner: 'Robert Lee'
  }
]

const recentlyAccessed = [
  { name: 'Budget Expenditure Report', type: 'Dashboard', accessed: '2 hours ago', tags: ['Budget'] },
  { name: 'Employee Metrics Dashboard', type: 'Dashboard', accessed: 'Yesterday', tags: ['eHR'] },
  { name: 'Census 2023 Dataset', type: 'Dataset', accessed: '3 days ago', tags: ['Demographics'] }
]

const tagColors = {
  Budget: 'bg-blue-100 text-blue-800',
  Financial: 'bg-green-100 text-green-800',
  eCAPS: 'bg-purple-100 text-purple-800',
  Payroll: 'bg-orange-100 text-orange-800',
  HR: 'bg-pink-100 text-pink-800',
  'Property Tax': 'bg-amber-100 text-amber-800',
  Revenue: 'bg-teal-100 text-teal-800',
  eHR: 'bg-indigo-100 text-indigo-800',
  Demographics: 'bg-rose-100 text-rose-800',
}

const typeIcons = { Dashboard: BarChart3, Report: FileText, Dataset: Database }

export function DataMarketHomePage({ onNavigate, onOpenProduct }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [aiMode, setAiMode] = useState(false)
  const { persona } = usePersona()

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      onNavigate('catalog', { search: searchQuery })
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-12">
      {/* Hero Search */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium mb-2">
          <Sparkles className="h-3.5 w-3.5" />
          AI-Powered Data Discovery
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
          Hi {persona.name},
        </h1>
        <p className="text-xl text-gray-500">What would you like to know?</p>

        <div className="max-w-2xl mx-auto mt-6">
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setAiMode(false)}
              className={`text-sm px-3 py-1.5 rounded-full transition-colors ${!aiMode ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              style={!aiMode ? { backgroundColor: DataMarket_BLUE } : {}}
            >
              Search
            </button>
            <button
              onClick={() => setAiMode(true)}
              className={`text-sm px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${aiMode ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              style={aiMode ? { backgroundColor: DataMarket_BLUE } : {}}
            >
              <Sparkles className="h-3 w-3" /> Ask AI
            </button>
          </div>

          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={aiMode ? 'Ask a question about enterprise data...' : 'Search data products, dashboards, reports...'}
              className="w-full pl-12 pr-14 py-4 text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 shadow-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ borderColor: searchQuery ? DataMarket_BLUE : undefined }}
            />
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-white"
              style={{ backgroundColor: DataMarket_BLUE }}
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            {['Budget by department', 'Vendor fraud flags', 'Payroll by unit', 'Property tax revenue'].map(s => (
              <button
                key={s}
                onClick={() => { setSearchQuery(s); setAiMode(true) }}
                className="text-xs text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Featured */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-gray-900">Featured</h2>
          <button
            onClick={() => onNavigate('catalog')}
            className="text-sm font-medium flex items-center gap-1 hover:gap-2 transition-all"
            style={{ color: DataMarket_BLUE }}
          >
            View All <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredProducts.map(product => {
            const Icon = typeIcons[product.type] || BarChart3
            return (
              <button
                key={product.id}
                onClick={() => onOpenProduct(product)}
                className="text-left bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#E8F0F7' }}>
                    <Icon className="h-5 w-5" style={{ color: DataMarket_BLUE }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-blue-700 transition-colors">{product.name}</h3>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {product.tags.map(tag => (
                        <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tagColors[tag] || 'bg-gray-100 text-gray-700'}`}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">{product.description}</p>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                  <span>{product.source}</span>
                  <span>↻ {product.refreshFrequency}</span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Recently Accessed */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recently Accessed</h2>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {recentlyAccessed.map((item, i) => {
            const Icon = typeIcons[item.type] || BarChart3
            return (
              <button
                key={i}
                onClick={() => onNavigate('catalog')}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left group"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#E8F0F7' }}>
                  <Icon className="h-4 w-4" style={{ color: DataMarket_BLUE }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">{item.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.tags.map(t => (
                      <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tagColors[t] || 'bg-gray-100 text-gray-600'}`}>{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
                  <Clock className="h-3.5 w-3.5" />
                  {item.accessed}
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
