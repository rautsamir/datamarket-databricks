import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Users, FolderOpen, ShieldCheck, Settings, Package, Clock, ChevronDown, Database, FileUp, FilePlus } from 'lucide-react'
import { usePersona } from '../context/PersonaContext'
import { ImportUCModal } from '../components/ImportUCModal'
import { ImportFileModal } from '../components/ImportFileModal'
import { useAppConfig } from '../context/AppConfigContext'
import { AdminSettingsPanel } from './admin/AdminSettingsPanel'
import { AdminUsersTab } from './admin/AdminUsersTab'
import { AdminProductsTab } from './admin/AdminProductsTab'
import { AdminApprovalsTab } from './admin/AdminApprovalsTab'
import { AnalystMyDataView } from './admin/AnalystMyDataView'
import { DataMarket_BLUE } from './admin/adminConstants'

// ─── "Add products" menu: every way a product gets into the catalog ────────────
function AddProductsMenu({ onImportUC, onImportFile, onRegister }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open])

  const items = [
    { icon: Database, label: 'Import from Unity Catalog', desc: 'Pick tables to publish as products', onClick: onImportUC },
    { icon: FileUp,   label: 'Import from a file',        desc: 'Power BI, Tableau, Looker or any link, from CSV or JSON', onClick: onImportFile },
    { icon: FilePlus, label: 'Register one product',      desc: 'Fill in a form', onClick: onRegister },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
        style={{ backgroundColor: DataMarket_BLUE }}
      >
        <Plus className="h-4 w-4" /> Add products <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-30">
          {items.map(({ icon: Icon, label, desc, onClick }) => (
            <button
              key={label}
              role="menuitem"
              onClick={() => { setOpen(false); onClick() }}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-start gap-3"
            >
              <Icon className="h-4 w-4 mt-0.5 text-gray-500 shrink-0" />
              <span>
                <span className="block text-sm font-medium text-gray-900">{label}</span>
                <span className="block text-xs text-gray-500">{desc}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Library Page ─────────────────────────────────────────────────────────
export function DataMarketLibraryPage({ onNavigate, onOpenProduct, initialTab }) {
  const { myRequests, persona, pendingRequests, isAdmin, apiAvailable, products: catalogProducts } = usePersona()
  const { databricksHost } = useAppConfig()
  const isSteward = isAdmin
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState(initialTab || (isSteward ? 'Data Products' : 'Data Product'))

  const [allProducts, setAllProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productsError, setProductsError] = useState(null)
  const [editingRef, setEditingRef] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [showFileImport, setShowFileImport] = useState(false)
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

  const syncFromUC = async () => {
    setSyncing(true); setSyncResult(null)
    try {
      const r = await fetch('/api/portal/admin/sync-uc-metadata', { method: 'POST' })
      setSyncResult(await r.json())
      loadAllProducts()
      setTimeout(() => setSyncResult(null), 5000)
    } catch (e) { setSyncResult({ error: e.message }) }
    finally { setSyncing(false) }
  }

  const tabCounts = isSteward
    ? { 'Data Products': allProducts.length, 'Manage Approvals': pendingApprovalCount || null, 'Users': null, 'Settings': null }
    : { 'Data Product': analystItems.filter(i => i.status === 'Approved').length, 'Request': analystItems.length }

  const tabConfig = isSteward
    ? [
        { id: 'Data Products',    icon: Package,       label: 'Data Products',    desc: 'All registered products',         activeColor: 'bg-blue-600 text-white border-blue-600',     countColor: 'bg-blue-500 text-white' },
        { id: 'Manage Approvals', icon: ShieldCheck,   label: 'Manage Approvals', desc: 'Review access requests',          activeColor: 'bg-amber-500 text-white border-amber-500',   countColor: 'bg-red-500 text-white' },
        { id: 'Users',            icon: Users,         label: 'Users',            desc: 'Manage user roles',               activeColor: 'bg-purple-600 text-white border-purple-600', countColor: 'bg-purple-500 text-white' },
        { id: 'Settings',         icon: Settings,      label: 'Settings',         desc: 'Configure portal',                activeColor: 'bg-gray-700 text-white border-gray-700',     countColor: 'bg-gray-500 text-white' },
        { id: 'My Data',          icon: FolderOpen,    label: 'My Data',          desc: 'Your personal access & products', activeColor: 'bg-emerald-600 text-white border-emerald-600', countColor: 'bg-emerald-500 text-white' },
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
            {isSteward ? 'Add and curate products, review access requests, and manage users and settings' : 'Your saved and requested data products'}
          </p>
        </div>
        {isSteward ? (
          <AddProductsMenu
            onImportUC={() => setShowImport(true)}
            onImportFile={() => setShowFileImport(true)}
            onRegister={() => onNavigate('register')}
          />
        ) : (
          <button
            onClick={() => onNavigate('register')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: DataMarket_BLUE }}
          >
            <Plus className="h-4 w-4" /> Register Product
          </button>
        )}
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
      {activeTab === 'Users' && isSteward && <AdminUsersTab />}
      {activeTab === 'Settings' && isSteward && <AdminSettingsPanel />}
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
          syncing={syncing}
          onSync={syncFromUC}
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
      {showFileImport && (
        <ImportFileModal
          onClose={() => setShowFileImport(false)}
          onImported={loadAllProducts}
          onViewProducts={() => { setShowFileImport(false); setActiveTab('Data Products') }}
        />
      )}
    </div>
  )
}
