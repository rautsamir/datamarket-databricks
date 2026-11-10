import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Upload, Users, FolderOpen, ShieldCheck, Settings, Package, Clock, RotateCcw, RefreshCw } from 'lucide-react'
import { usePersona } from '../context/PersonaContext'
import { ImportUCModal } from '../components/ImportUCModal'
import { useAppConfig } from '../context/AppConfigContext'
import { AdminSettingsPanel, AdminDemoControlsPanel } from './admin/AdminSettingsPanel'
import { AdminUsersTab } from './admin/AdminUsersTab'
import { AdminProductsTab } from './admin/AdminProductsTab'
import { AdminImportPanel } from './admin/AdminImportPanel'
import { AdminApprovalsTab } from './admin/AdminApprovalsTab'
import { AnalystMyDataView } from './admin/AnalystMyDataView'
import { DataMarket_BLUE } from './admin/adminConstants'

// ─── Main Library Page ─────────────────────────────────────────────────────────
export function DataMarketLibraryPage({ onNavigate, onOpenProduct, initialTab }) {
  const { myRequests, persona, pendingRequests, isAdmin, apiAvailable, products: catalogProducts } = usePersona()
  const { demoMode, databricksHost } = useAppConfig()
  const isSteward = isAdmin
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState(initialTab || (isSteward ? 'Data Products' : 'Data Product'))

  const [allProducts, setAllProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productsError, setProductsError] = useState(null)
  const [editingRef, setEditingRef] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  const loadAllProducts = useCallback(() => {
    setLoadingProducts(true)
    setProductsError(null)
    fetch('/api/portal/products?includeAll=true')
      .then(r => r.json())
      .then(rows => {
        if (Array.isArray(rows)) {
          setAllProducts(rows)
        } else {
          console.error('[DataProducts] API error:', rows)
          setProductsError(rows?.error || 'Unknown error loading products')
        }
      })
      .catch(err => {
        console.error('[DataProducts] Fetch error:', err)
        setProductsError(err.message)
      })
      .finally(() => setLoadingProducts(false))
  }, [])

  // Re-fetch when the API becomes available (SSO resolved) or admin status confirmed
  useEffect(() => {
    if (apiAvailable) loadAllProducts()
  }, [apiAvailable, isAdmin, loadAllProducts])

  const filteredProducts = allProducts.filter(p =>
    !search || (p.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.domain || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.product_ref || '').toLowerCase().includes(search.toLowerCase())
  )

  // Analyst view: one row per request, enriched from the live catalog
  const productByRef = new Map((catalogProducts || []).map(p => [p.product_ref, p]))
  const analystItems = myRequests.map(r => {
    const ref = r.product_ref || r.productRef || ''
    const p = productByRef.get(ref) || {}
    const tags = Array.isArray(p.tags) ? p.tags
      : typeof p.tags === 'string' ? p.tags.replace(/[{}"]/g, '').split(',').map(t => t.trim()).filter(Boolean)
      : []
    return {
      id: ref, product_ref: ref, ref,
      name: p.display_name || r.product_name || r.productName || ref,
      description: p.description, tags,
      type: p.type || r.product_type || 'Dataset',
      source: p.source_system || r.domain || '-',
      refreshFrequency: p.refresh_frequency || '-',
      owner: p.owner_email || '-',
      uc_full_name: p.uc_full_name || null, ucFullName: p.uc_full_name || null,
      classification: p.classification,
      lastRefreshed: p.last_refreshed || null,
      status: r.status, requestId: r.id, expiresAt: r.expires_at || r.expiresAt,
      reason: r.business_reason || r.reason
    }
  })

  const filteredAnalyst = analystItems.filter(item =>
    !search || item.name.toLowerCase().includes(search.toLowerCase())
  )

  const pendingApprovalCount = pendingRequests?.length || 0

  const tabCounts = isSteward
    ? { 'Data Products': allProducts.length, 'Manage Approvals': pendingApprovalCount || null, 'Users': null, 'Settings': null }
    : { 'Data Product': analystItems.filter(i => i.status === 'Approved').length, 'Request': analystItems.length }

  const tabConfig = isSteward
    ? [
        { id: 'Data Products',    icon: Package,       label: 'Data Products',    desc: 'All registered products',         activeColor: 'bg-blue-600 text-white border-blue-600',     countColor: 'bg-blue-500 text-white' },
        { id: 'Manage Approvals', icon: ShieldCheck,   label: 'Manage Approvals', desc: 'Review access requests',          activeColor: 'bg-amber-500 text-white border-amber-500',   countColor: 'bg-red-500 text-white' },
        { id: 'Import',           icon: Upload,        label: 'Import',           desc: 'Add many from a file',            activeColor: 'bg-teal-600 text-white border-teal-600',     countColor: 'bg-teal-500 text-white' },
        { id: 'Users',            icon: Users,         label: 'Users',            desc: 'Manage user roles',               activeColor: 'bg-purple-600 text-white border-purple-600', countColor: 'bg-purple-500 text-white' },
        { id: 'Settings',         icon: Settings,      label: 'Settings',         desc: 'Configure portal',                activeColor: 'bg-gray-700 text-white border-gray-700',     countColor: 'bg-gray-500 text-white' },
        { id: 'My Data',          icon: FolderOpen,    label: 'My Data',          desc: 'Your personal access & products', activeColor: 'bg-emerald-600 text-white border-emerald-600', countColor: 'bg-emerald-500 text-white' },
        ...(demoMode ? [{ id: 'Demo Controls', icon: RotateCcw, label: 'Demo Controls', desc: 'Reset or reload demo data', activeColor: 'bg-rose-600 text-white border-rose-600', countColor: 'bg-rose-500 text-white' }] : []),
      ]
    : [
        { id: 'Data Product', icon: FolderOpen, label: 'My Products',  desc: 'Data you have access to',  activeColor: 'bg-emerald-600 text-white border-emerald-600', countColor: 'bg-emerald-500 text-white' },
        { id: 'Request',      icon: Clock,      label: 'My Requests',  desc: 'Pending & past requests',  activeColor: 'bg-blue-600 text-white border-blue-600',      countColor: 'bg-blue-500 text-white' },
      ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isSteward ? 'Manage your data products' : 'My Data'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isSteward ? 'Review submissions and access requests, import from Unity Catalog, and manage users and settings' : 'Your saved and requested data products'}
          </p>
        </div>
        <div className="flex gap-2">
          {isSteward && (
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border-2 border-dashed border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-700 transition-colors"
            >
              <Upload className="h-4 w-4" /> Import from UC
            </button>
          )}
          {isSteward && (
            <button
              onClick={async () => {
                setSyncing(true); setSyncResult(null)
                try {
                  const r = await fetch('/api/portal/admin/sync-uc-metadata', { method: 'POST' })
                  const d = await r.json()
                  setSyncResult(d)
                  loadAllProducts()
                  setTimeout(() => setSyncResult(null), 5000)
                } catch (e) { setSyncResult({ error: e.message }) }
                finally { setSyncing(false) }
              }}
              disabled={syncing}
              title="Re-sync last_refreshed dates and mark removed tables Unavailable"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync from UC'}
            </button>
          )}
          <button
            onClick={() => onNavigate('register')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: DataMarket_BLUE }}
          >
            <Plus className="h-4 w-4" /> Register Product
          </button>
        </div>
      </div>

      {/* ── Pill Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabConfig.map(tab => {
          const count = tabCounts[tab.id]
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                isActive
                  ? `${tab.activeColor} shadow-sm`
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'opacity-90' : 'opacity-60'}`} />
              <span>{tab.label}</span>
              {count != null && (
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                  isActive ? tab.countColor : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Admin Tabs ────────────────────────────────────────────────────────── */}
      {activeTab === 'Import' && isSteward && (
        <AdminImportPanel onImported={loadAllProducts} onViewProducts={() => setActiveTab('Data Products')} />
      )}
      {activeTab === 'Users' && isSteward && <AdminUsersTab />}
      {activeTab === 'Settings' && isSteward && <AdminSettingsPanel />}
      {activeTab === 'Demo Controls' && isSteward && demoMode && <AdminDemoControlsPanel />}
      {activeTab === 'Manage Approvals' && isSteward && (
        <AdminApprovalsTab onSwitchToSettings={() => setActiveTab('Settings')} />
      )}
      {activeTab === 'Data Products' && isSteward && (
        <AdminProductsTab
          allProducts={allProducts}
          filteredProducts={filteredProducts}
          loadingProducts={loadingProducts}
          productsError={productsError}
          syncResult={syncResult}
          editingRef={editingRef}
          setEditingRef={setEditingRef}
          loadAllProducts={loadAllProducts}
          search={search}
          setSearch={setSearch}
          onNavigate={onNavigate}
          fromRequests={analystItems}
          persona={persona}
          activeTab={activeTab}
        />
      )}

      {/* ── Analyst / My Data View ────────────────────────────────────────────── */}
      {(!isSteward || activeTab === 'My Data') && (activeTab === 'Data Product' || activeTab === 'Request' || activeTab === 'My Data') && (
        <AnalystMyDataView
          filteredAnalyst={filteredAnalyst}
          activeTab={activeTab}
          search={search}
          setSearch={setSearch}
          onOpenProduct={onOpenProduct}
          databricksHost={databricksHost}
        />
      )}

      {showImport && (
        <ImportUCModal onClose={() => setShowImport(false)} onImported={loadAllProducts} />
      )}
    </div>
  )
}
