import React, { useState, useEffect } from 'react'
import {
  BarChart3, FileText, Database, Lock, ExternalLink, Sparkles,
  RefreshCw, CheckCircle, ArrowRight, LayoutDashboard, TrendingUp,
  PieChart, Activity, AlertCircle, Filter
} from 'lucide-react'
import { usePersona } from '../context/PersonaContext'

const DataMarket_BLUE = '#003865'

// Insight categories with their associated data domains
const INSIGHT_CATEGORIES = ['All', 'Budget', 'HRIS', 'Payroll', 'Property Tax', 'Demographics', 'Other']

// Domain → colour palette
const domainColors = {
  Budget:       { bg: 'bg-blue-50',   border: 'border-blue-200',   icon: 'text-blue-600',   badge: 'bg-blue-100 text-blue-700' },
  HRIS:         { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700' },
  Payroll:      { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-600', badge: 'bg-orange-100 text-orange-700' },
  'Property Tax':{ bg: 'bg-amber-50', border: 'border-amber-200',  icon: 'text-amber-600',  badge: 'bg-amber-100 text-amber-700' },
  Demographics: { bg: 'bg-rose-50',   border: 'border-rose-200',   icon: 'text-rose-600',   badge: 'bg-rose-100 text-rose-700' },
  Other:        { bg: 'bg-gray-50',   border: 'border-gray-200',   icon: 'text-gray-600',   badge: 'bg-gray-100 text-gray-700' },
}

const typeIcons = { Dashboard: LayoutDashboard, Report: FileText, Dataset: Database }

// Insight-flavoured descriptions per product to make this page feel purposeful
const insightMeta = {
  'DP-001': {
    headline: 'Where is budget being spent?',
    kpis: ['$12.4B total budget', '5 departments over 90% utilization', '↑ 3.2% vs last FY'],
    chartHint: 'bar'
  },
  'DP-002': {
    headline: 'Workforce health at a glance',
    kpis: ['4,821 total headcount', '6.4% turnover rate', '12% overtime spike in Q3'],
    chartHint: 'line'
  },
  'DP-003': {
    headline: 'Revenue from property assessments',
    kpis: ['$2.1B assessed 2024', '98.2% collection rate', '+5.8% YoY growth'],
    chartHint: 'bar'
  },
  'DP-004': {
    headline: 'Population trends & demographics',
    kpis: ['3.96M total population', '14 districts tracked', 'Age 25-44 largest cohort'],
    chartHint: 'pie'
  },
  'DP-005': {
    headline: 'Service delivery performance',
    kpis: ['18,420 tickets YTD', '87% SLA compliance', '↓ 4.1% open tickets'],
    chartHint: 'line'
  },
  'DP-006': {
    headline: 'Essential service utilization',
    kpis: ['6 core service lines', '92% capacity used', '↑ 8% demand vs last year'],
    chartHint: 'bar'
  },
  'DP-007': {
    headline: 'Compensation & payroll trends',
    kpis: ['$680M total payroll', '3 bargaining units', '↑ 2.1% avg comp growth'],
    chartHint: 'bar'
  },
  'DP-008': {
    headline: 'Property tax collection overview',
    kpis: ['$4.3B collected YTD', '99.1% accuracy rate', '120 districts'],
    chartHint: 'bar'
  },
  'DP-009': {
    headline: 'Population age distribution 2020',
    kpis: ['Census 2020 data', 'By age band & district', 'Planning-grade dataset'],
    chartHint: 'pie'
  },
  'DP-010': {
    headline: 'Enterprise-wide budget analytics',
    kpis: ['All departments', 'Multi-year comparisons', 'Live variance tracking'],
    chartHint: 'bar'
  },
  'DP-011': {
    headline: 'Audit findings & compliance',
    kpis: ['48 open findings', '12 critical items', '↓ 18% from prior audit'],
    chartHint: 'line'
  },
  'DP-012': {
    headline: 'Infrastructure location data',
    kpis: ['GIS-grade accuracy', '7 infrastructure types', 'Updated quarterly'],
    chartHint: 'pie'
  },
}

// Mini sparkline SVG for visual decoration (not real data, just demo polish)
function MiniChart({ type, color = '#3B82F6' }) {
  if (type === 'bar') {
    const bars = [40, 65, 50, 80, 55, 75, 90]
    return (
      <svg viewBox="0 0 56 28" className="w-14 h-7 opacity-60">
        {bars.map((h, i) => (
          <rect key={i} x={i * 8} y={28 - h * 0.28} width={5} height={h * 0.28} rx={1} fill={color} />
        ))}
      </svg>
    )
  }
  if (type === 'line') {
    return (
      <svg viewBox="0 0 56 28" className="w-14 h-7 opacity-60">
        <polyline points="0,22 8,18 16,20 24,12 32,14 40,8 48,10 56,4" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 28 28" className="w-7 h-7 opacity-60">
      <circle cx="14" cy="14" r="12" fill="none" stroke={color} strokeWidth="3" strokeDasharray="25 50" />
      <circle cx="14" cy="14" r="12" fill="none" stroke={color} strokeWidth="3" strokeDasharray="15 60" strokeDashoffset="-25" opacity="0.5" />
    </svg>
  )
}

export function DataMarketInsightsPage({ onNavigate, onOpenProduct }) {
  const { persona, hasAccess } = usePersona()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')

  useEffect(() => {
    fetch('/api/portal/products')
      .then(r => r.json())
      .then(data => {
        const items = Array.isArray(data) ? data : (data.products || [])
        setProducts(items.filter(p => p.status === 'Published' || !p.status))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Normalize product from API
  const norm = (p) => ({
    ref:             p.product_ref || p.ref,
    name:            p.display_name || p.name,
    type:            p.type || 'Dashboard',
    domain:          p.domain || 'Other',
    tags:            Array.isArray(p.tags) ? p.tags : (p.tags ? p.tags.replace(/[{}]/g, '').split(',') : []),
    productUrl:      p.product_url || p.productUrl || null,
    refreshFreq:     p.refresh_frequency || p.refreshFrequency || 'Weekly',
    lastRefreshed:   p.last_refreshed || p.lastRefreshed || null,
    owner:           p.owner_name || p.owner || '',
    description:     p.description || '',
  })

  const accessible = products.filter(p => hasAccess(norm(p).ref)).map(norm)
  const restricted = products.filter(p => !hasAccess(norm(p).ref)).map(norm)

  const filterByCategory = (list) =>
    activeCategory === 'All' ? list : list.filter(p => p.domain === activeCategory || p.tags.includes(activeCategory))

  const visibleAccessible = filterByCategory(accessible)
  const visibleRestricted = filterByCategory(restricted)

  const openCTA = (product) => {
    if (product.productUrl) {
      window.open(product.productUrl, '_blank', 'noopener')
    } else {
      onOpenProduct(product)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-10">

      {/* Page hero */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insights</h1>
          <p className="text-sm text-gray-500 mt-1">
            Dashboards &amp; reports you have access to — ready to explore.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('discover')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Database className="h-3.5 w-3.5" /> Browse All Data
          </button>
          <button
            onClick={() => onNavigate('ask-ai')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white transition-colors"
            style={{ backgroundColor: DataMarket_BLUE }}
          >
            <Sparkles className="h-3.5 w-3.5" /> Ask AI
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Accessible to you', value: accessible.length, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Awaiting access', value: restricted.length, icon: Lock, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Dashboards', value: products.filter(p => p.type === 'Dashboard').length, icon: LayoutDashboard, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Datasets & Reports', value: products.filter(p => p.type !== 'Dashboard').length, icon: Database, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${stat.bg}`}>
                <stat.icon className={`h-4.5 w-4.5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        {INSIGHT_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              activeCategory === cat
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading insights…</span>
        </div>
      )}

      {/* ── ACCESSIBLE SECTION ──────────────────────────────────────── */}
      {!loading && visibleAccessible.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            Your Insights ({visibleAccessible.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {visibleAccessible.map(product => {
              const meta = insightMeta[product.ref] || {}
              const colors = domainColors[product.domain] || domainColors.Other
              const Icon = typeIcons[product.type] || LayoutDashboard
              const chartType = meta.chartHint || 'bar'

              return (
                <div
                  key={product.ref}
                  className={`bg-white rounded-xl border ${colors.border} shadow-sm hover:shadow-md transition-all group flex flex-col overflow-hidden`}
                >
                  {/* Card header band */}
                  <div className={`${colors.bg} px-4 pt-4 pb-3`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white/70`}>
                          <Icon className={`h-4 w-4 ${colors.icon}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-1">{product.name}</p>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colors.badge}`}>{product.domain}</span>
                        </div>
                      </div>
                      <MiniChart type={chartType} color={colors.icon.replace('text-', '').includes('blue') ? '#3B82F6' : colors.icon.includes('indigo') ? '#6366F1' : colors.icon.includes('orange') ? '#F97316' : colors.icon.includes('amber') ? '#D97706' : colors.icon.includes('rose') ? '#F43F5E' : '#6B7280'} />
                    </div>
                    {meta.headline && (
                      <p className="text-xs text-gray-500 mt-2 italic">"{meta.headline}"</p>
                    )}
                  </div>

                  {/* KPI chips */}
                  {meta.kpis && (
                    <div className="px-4 py-2.5 flex flex-wrap gap-1.5 border-b border-gray-100">
                      {meta.kpis.map((kpi, i) => (
                        <span key={i} className="text-[11px] text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded font-medium">
                          {kpi}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer row */}
                  <div className="mt-auto px-4 py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                      <RefreshCw className="h-3 w-3" />
                      {product.refreshFreq}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenProduct(product)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => openCTA(product)}
                        className="flex items-center gap-1 text-xs font-medium text-white px-3 py-1.5 rounded-lg transition-colors hover:opacity-90"
                        style={{ backgroundColor: DataMarket_BLUE }}
                      >
                        {product.productUrl ? <ExternalLink className="h-3 w-3" /> : <BarChart3 className="h-3 w-3" />}
                        {product.type === 'Dashboard' ? 'Open Dashboard' : product.type === 'Report' ? 'Open Report' : 'View Data'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── RESTRICTED SECTION ──────────────────────────────────────── */}
      {!loading && visibleRestricted.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-500" />
            More Insights — Request Access ({visibleRestricted.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleRestricted.map(product => {
              const meta = insightMeta[product.ref] || {}
              const Icon = typeIcons[product.type] || LayoutDashboard
              return (
                <div
                  key={product.ref}
                  className="bg-white rounded-xl border border-dashed border-gray-300 p-4 flex items-start gap-3 hover:border-amber-300 hover:bg-amber-50/30 transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                    <Lock className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 leading-tight">{product.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{product.domain} · {product.type}</p>
                    {meta.headline && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1 italic">"{meta.headline}"</p>
                    )}
                    <button
                      onClick={() => onOpenProduct(product)}
                      className="mt-2 text-xs font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1 transition-colors"
                    >
                      Request Access <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!loading && visibleAccessible.length === 0 && visibleRestricted.length === 0 && (
        <div className="text-center py-20 text-gray-400 space-y-3">
          <LayoutDashboard className="h-12 w-12 mx-auto opacity-30" />
          <p className="text-sm">No insights found for this category.</p>
          <button onClick={() => setActiveCategory('All')} className="text-xs text-blue-600 hover:underline">
            Clear filter
          </button>
        </div>
      )}

      {/* Promo bar */}
      {!loading && (
        <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <Sparkles className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Want to explore with natural language?</p>
              <p className="text-xs text-gray-500">Ask a question in plain English and let the AI do the work.</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('ask-ai')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white shrink-0 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: DataMarket_BLUE }}
          >
            <Sparkles className="h-4 w-4" /> Open Ask AI
          </button>
        </div>
      )}
    </div>
  )
}
