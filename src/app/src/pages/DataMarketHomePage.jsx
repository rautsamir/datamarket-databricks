import React, { useState } from 'react'
import { Search, ArrowRight, Clock, Sparkles, BarChart3, FileText, Database, Lock } from 'lucide-react'
import { usePersona } from '../context/PersonaContext'

// Heuristic: treat input as a natural-language question if it looks conversational
function isNaturalLanguage(q) {
  if (!q || q.trim().split(/\s+/).length < 3) return false
  return /^(show|find|what|which|how|give|get|list|compare|who|why|tell|analyze|summarize|break|top|total|average|trend|where)\b/i.test(q.trim()) ||
    /\b(by department|by team|over time|last year|this year|vs |versus|trend|breakdown|summary|analysis|compared to)\b/i.test(q)
}

const DataMarket_BLUE = '#003865'

const featuredProducts = [
  {
    id: 7,
    ref: 'DP-007',
    name: 'Payroll Dashboard',
    tags: ['Payroll', 'HR'],
    type: 'Dashboard',
    description: 'Organization-wide payroll expenditure, headcount trends, and compensation analytics across all departments and bargaining units.',
    source: 'HRIS',
    refreshFrequency: 'Daily',
    owner: 'James Park'
  },
  {
    id: 1,
    ref: 'DP-001',
    name: 'Budget Expenditure Report',
    tags: ['Budget', 'ERP'],
    type: 'Dashboard',
    description: 'Departmental budget allocations and year-to-date expenditures with variance analysis across all departments.',
    source: 'ERP',
    refreshFrequency: 'Daily',
    owner: 'James Park'
  },
  {
    id: 2,
    ref: 'DP-002',
    name: 'Employee Metrics Dashboard',
    tags: ['HRIS', 'HR'],
    type: 'Dashboard',
    description: 'Headcount, turnover rates, overtime trends, and compensation metrics segmented by department and bargaining unit.',
    source: 'HRIS',
    refreshFrequency: 'Weekly',
    owner: 'Sarah Kim',
    restricted: true
  }
]

const recentlyAccessed = [
  { name: 'Budget Expenditure Report', ref: 'DP-001', type: 'Dashboard', accessed: '2 hours ago', tags: ['Budget'] },
  { name: 'Payroll Dashboard', ref: 'DP-007', type: 'Dashboard', accessed: 'Yesterday', tags: ['Payroll', 'HR'] },
  { name: 'Property Tax Report 2024', ref: 'DP-003', type: 'Report', accessed: '3 days ago', tags: ['Property Tax'] }
]

const tagColors = {
  Budget: 'bg-blue-100 text-blue-800',
  Financial: 'bg-green-100 text-green-800',
  'ERP System': 'bg-purple-100 text-purple-800',
  Payroll: 'bg-orange-100 text-orange-800',
  HR: 'bg-pink-100 text-pink-800',
  'Property Tax': 'bg-amber-100 text-amber-800',
  Revenue: 'bg-teal-100 text-teal-800',
  HRIS: 'bg-indigo-100 text-indigo-800',
  Demographics: 'bg-rose-100 text-rose-800',
}

const typeIcons = { Dashboard: BarChart3, Report: FileText, Dataset: Database }

export function DataMarketHomePage({ onNavigate, onOpenProduct }) {
  const [searchQuery, setSearchQuery] = useState('')
  const { persona, hasAccess } = usePersona()

  const isAI = isNaturalLanguage(searchQuery)

  const handleSearch = (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    if (isAI) {
      onNavigate('ai-explorer', { question: searchQuery })
    } else {
      onNavigate('catalog', { search: searchQuery })
    }
  }

  const launchChip = (text) => {
    onNavigate('ai-explorer', { question: text })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-12">
      {/* Hero Search */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
          Hi {persona.name},
        </h1>
        <p className="text-xl text-gray-500">Search for data or ask a question in plain English.</p>

        <div className="max-w-2xl mx-auto mt-6">
          <form onSubmit={handleSearch} className="relative">
            {isAI
              ? <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-500" />
              : <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            }
            <input
              type="text"
              placeholder="Search products or ask: show me headcount by department..."
              className="w-full pl-12 pr-36 py-4 text-base border-2 rounded-xl focus:outline-none shadow-sm transition-colors"
              style={{ borderColor: isAI ? '#3B82F6' : (searchQuery ? DataMarket_BLUE : '#E5E7EB') }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {/* Live mode badge */}
            <span className={`absolute right-14 top-1/2 -translate-y-1/2 text-[10px] font-semibold px-2 py-1 rounded-full transition-all ${
              isAI ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
            }`}>
              {isAI ? '✦ Ask AI' : 'Search'}
            </span>
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-white"
              style={{ backgroundColor: isAI ? '#3B82F6' : DataMarket_BLUE }}
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Suggestion chips — always AI queries */}
          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            {[
              { label: '✦ Budget by department', q: 'Show me budget by department' },
              { label: '✦ Headcount by department', q: 'Headcount by department' },
              { label: '✦ Vendor fraud flags', q: 'Show me vendor fraud flags' },
              { label: '✦ Property tax revenue', q: 'Show me property tax revenue' },
            ].map(({ label, q }) => (
              <button
                key={q}
                onClick={() => launchChip(q)}
                className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-full transition-colors border border-blue-100"
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Type a short keyword to search the catalog · Ask a full question to explore with AI</p>
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
            const isLocked = product.restricted && !hasAccess(product.ref)
            return (
              <button
                key={product.id}
                onClick={() => onOpenProduct(product)}
                className={`text-left bg-white rounded-xl border p-5 hover:shadow-md transition-all group ${isLocked ? 'border-amber-200 hover:border-amber-300' : 'border-gray-200 hover:border-blue-300'}`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: isLocked ? '#FEF3C7' : '#E8F0F7' }}>
                    <Icon className="h-5 w-5" style={{ color: isLocked ? '#D97706' : DataMarket_BLUE }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-blue-700 transition-colors">{product.name}</h3>
                      {isLocked && <Lock className="h-3 w-3 text-amber-500 shrink-0" />}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {product.tags.map(tag => (
                        <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tagColors[tag] || 'bg-gray-100 text-gray-700'}`}>{tag}</span>
                      ))}
                      {isLocked && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Request Access</span>}
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
