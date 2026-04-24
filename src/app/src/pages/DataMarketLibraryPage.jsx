import React, { useState, useEffect, useCallback } from 'react'
import { Search, Plus, BarChart3, FileText, Database, BookmarkCheck, Edit3, Check, X, Upload, Users, ExternalLink, Link2, Shield } from 'lucide-react'
import { usePersona } from '../context/PersonaContext'

const DataMarket_BLUE = '#003865'

const tagColors = {
  Budget: 'bg-blue-100 text-blue-800', Financial: 'bg-green-100 text-green-800',
  'ERP System': 'bg-purple-100 text-purple-800', Payroll: 'bg-orange-100 text-orange-800',
  HR: 'bg-pink-100 text-pink-800', 'Property Tax': 'bg-amber-100 text-amber-800',
  Revenue: 'bg-teal-100 text-teal-800', HRIS: 'bg-indigo-100 text-indigo-800',
  Demographics: 'bg-rose-100 text-rose-800', Audit: 'bg-red-100 text-red-800',
  'Health Services': 'bg-emerald-100 text-emerald-800',
  'Power BI': 'bg-yellow-100 text-yellow-800',
  'Public Safety': 'bg-slate-100 text-slate-800',
}

const statusConfig = {
  Published: 'bg-emerald-100 text-emerald-800',
  Approved: 'bg-emerald-100 text-emerald-800',
  Pending: 'bg-amber-100 text-amber-800',
  Denied: 'bg-red-100 text-red-800',
  Revoked: 'bg-orange-100 text-orange-800',
  Rejected: 'bg-red-100 text-red-800',
}

const roleColors = {
  analyst: 'bg-blue-100 text-blue-800',
  manager: 'bg-emerald-100 text-emerald-800',
  steward: 'bg-purple-100 text-purple-800',
}

// ─── Import from UC Modal ──────────────────────────────────────────────────────
function ImportUCModal({ onClose, onImported }) {
  const [tables, setTables] = useState([])
  const [registered, setRegistered] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    fetch('/api/portal/admin/uc-tables')
      .then(r => r.json())
      .then(d => {
        setTables(d.tables || [])
        setRegistered(d.registered || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleSelect = (fullName) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(fullName) ? next.delete(fullName) : next.add(fullName)
      return next
    })
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const toImport = tables.filter(t => selected.has(t.full_name))
      const r = await fetch('/api/portal/admin/import-uc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: toImport })
      })
      const data = await r.json()
      setResult(data)
      if (data.imported > 0) onImported()
    } catch (e) {
      setResult({ error: e.message })
    }
    setImporting(false)
  }

  if (result) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {result.imported} Table{result.imported !== 1 ? 's' : ''} Imported
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            Data products created from Unity Catalog and published to the marketplace.
          </p>
          <button onClick={onClose} className="w-full py-2.5 rounded-lg text-white font-medium" style={{ backgroundColor: DataMarket_BLUE }}>
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Upload className="h-5 w-5" style={{ color: DataMarket_BLUE }} />
              Import from Unity Catalog
            </h3>
            <p className="text-xs text-gray-500 mt-1">Select UC tables to register as data products</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5 text-gray-500" /></button>
        </div>

        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Discovering UC tables...</div>
          ) : tables.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Database className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">All available UC tables are already registered.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500">{tables.length} table{tables.length !== 1 ? 's' : ''} available</span>
                <button
                  onClick={() => setSelected(selected.size === tables.length ? new Set() : new Set(tables.map(t => t.full_name)))}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {selected.size === tables.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              {tables.map(t => (
                <label key={t.full_name} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selected.has(t.full_name) ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={selected.has(t.full_name)}
                    onChange={() => toggleSelect(t.full_name)}
                    className="shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 font-mono">{t.table_name}</p>
                    <p className="text-xs text-gray-400 truncate">{t.full_name}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">{t.schema_name}</span>
                </label>
              ))}
            </div>
          )}

          {registered.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2">Already registered ({registered.length})</p>
              <div className="flex flex-wrap gap-1">
                {registered.map(r => (
                  <span key={r} className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 font-mono">{r.split('.').pop()}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-3 flex gap-3 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={selected.size === 0 || importing}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: DataMarket_BLUE }}
          >
            {importing ? 'Importing...' : `Import ${selected.size} Table${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Inline Edit Row for Product ───────────────────────────────────────────────
function ProductEditRow({ product, onSave, onCancel }) {
  const [form, setForm] = useState({
    uc_full_name: product.uc_full_name || '',
    source_type: product.source_type || 'Databricks',
    refresh_frequency: product.refresh_frequency || 'Daily',
    domain: product.domain || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/portal/products/${product.product_ref}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      onSave()
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  return (
    <tr className="bg-blue-50/50 border-b border-blue-200">
      <td className="py-2 px-4 text-xs font-mono text-gray-500">{product.product_ref}</td>
      <td className="py-2 px-4 text-xs font-medium text-gray-900">{product.display_name}</td>
      <td className="py-2 px-4">
        <input value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })}
          className="w-full px-2 py-1 border border-blue-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
      </td>
      <td className="py-2 px-4">
        <select value={form.source_type} onChange={e => setForm({ ...form, source_type: e.target.value })}
          className="px-2 py-1 border border-blue-200 rounded text-xs focus:outline-none">
          <option>Databricks</option>
          <option>Power BI</option>
        </select>
      </td>
      <td className="py-2 px-4">
        <input value={form.uc_full_name} onChange={e => setForm({ ...form, uc_full_name: e.target.value })}
          placeholder="catalog.schema.table"
          className="w-full px-2 py-1 border border-blue-200 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400" />
      </td>
      <td className="py-2 px-4">
        <select value={form.refresh_frequency} onChange={e => setForm({ ...form, refresh_frequency: e.target.value })}
          className="px-2 py-1 border border-blue-200 rounded text-xs focus:outline-none">
          <option>Daily</option>
          <option>Weekly</option>
          <option>Monthly</option>
          <option>Annual</option>
        </select>
      </td>
      <td className="py-2 px-4">
        <div className="flex gap-1">
          <button onClick={handleSave} disabled={saving} className="p-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200"><Check className="h-3.5 w-3.5" /></button>
          <button onClick={onCancel} className="p-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200"><X className="h-3.5 w-3.5" /></button>
        </div>
      </td>
    </tr>
  )
}

// ─── Users Tab (Steward Only) ──────────────────────────────────────────────────
function UsersPanel() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [search, setSearch] = useState('')

  const loadUsers = useCallback(() => {
    fetch('/api/portal/admin/users')
      .then(r => r.json())
      .then(rows => { if (Array.isArray(rows)) setUsers(rows) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const startEdit = (user) => {
    setEditingId(user.user_id)
    setEditForm({ role: user.role || 'analyst', department: user.department || '' })
  }

  const saveEdit = async (userId) => {
    try {
      await fetch(`/api/portal/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })
      setEditingId(null)
      loadUsers()
    } catch (e) { console.error(e) }
  }

  const filtered = users.filter(u =>
    !search || u.display_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" placeholder="Search users" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Name</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Email</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Role</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Department</th>
                <th className="text-center py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400 text-sm">Loading users...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400 text-sm">No users found.</td></tr>
              )}
              {filtered.map(user => {
                const isEditing = editingId === user.user_id
                return (
                  <tr key={user.user_id} className={`border-b border-gray-100 ${isEditing ? 'bg-blue-50/50' : 'hover:bg-gray-50'} transition-colors`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ backgroundColor: user.role === 'steward' ? '#8B5CF6' : user.role === 'manager' ? '#10B981' : '#3B82F6' }}>
                          {(user.display_name || user.email).split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900 text-xs">{user.display_name || user.email}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">{user.email}</td>
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                          className="px-2 py-1 border border-blue-200 rounded text-xs focus:outline-none">
                          <option value="analyst">Analyst</option>
                          <option value="manager">Manager</option>
                          <option value="steward">Steward</option>
                        </select>
                      ) : (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${roleColors[user.role] || 'bg-gray-100 text-gray-700'}`}>
                          {user.role || 'analyst'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <input value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                          className="w-full px-2 py-1 border border-blue-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      ) : (
                        <span className="text-xs text-gray-600">{user.department || '-'}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isEditing ? (
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => saveEdit(user.user_id)} className="p-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200"><Check className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(user)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Main Library Page ─────────────────────────────────────────────────────────
export function DataMarketLibraryPage({ onNavigate, onOpenProduct }) {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('Data Product')
  const { myRequests, persona, currentPersona } = usePersona()
  const isSteward = currentPersona === 'admin'

  const [allProducts, setAllProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [editingRef, setEditingRef] = useState(null)
  const [showImport, setShowImport] = useState(false)

  const loadAllProducts = useCallback(() => {
    if (!isSteward) return
    setLoadingProducts(true)
    fetch('/api/portal/products?includeAll=true')
      .then(r => r.json())
      .then(rows => { if (Array.isArray(rows)) setAllProducts(rows) })
      .catch(() => {})
      .finally(() => setLoadingProducts(false))
  }, [isSteward])

  useEffect(() => { loadAllProducts() }, [loadAllProducts])

  const filteredProducts = allProducts.filter(p =>
    !search || (p.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.domain || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.product_ref || '').toLowerCase().includes(search.toLowerCase())
  )

  // Analyst view data
  const myItems = [
    { id: 1, product_ref: 'DP-001', name: 'Budget Expenditure Report', tags: ['Budget', 'ERP'], type: 'Dashboard', source: 'ERP', refreshFrequency: 'Daily', owner: 'james.park', lastUpdated: '02/11/2025', status: 'Approved' },
    { id: 2, product_ref: 'DP-002', name: 'Employee Metrics Dashboard', tags: ['HRIS'], type: 'Dashboard', source: 'HRIS', refreshFrequency: 'Weekly', owner: 'sarah.kim', lastUpdated: '02/11/2025', status: 'Approved' },
    { id: 7, product_ref: 'DP-007', name: 'Payroll Dashboard', tags: ['Payroll', 'HRIS'], type: 'Dashboard', source: 'HRIS', refreshFrequency: 'Daily', owner: 'james.park', lastUpdated: '02/11/2025', status: 'Approved' },
  ]

  const fromRequests = myRequests.map(r => {
    const ref = r.product_ref || r.productRef || ''
    return {
      id: ref, product_ref: ref,
      name: r.product_name || r.productName || ref,
      tags: [], type: r.product_type || 'Dashboard', source: r.domain || '-',
      refreshFrequency: '-', owner: '-',
      lastUpdated: r.requested_at ? new Date(r.requested_at).toLocaleDateString() : '-',
      status: r.status, requestId: r.id, expiresAt: r.expires_at || r.expiresAt
    }
  })

  const requestRefs = new Set(fromRequests.map(r => r.product_ref))
  const analystItems = [
    ...myItems.filter(i => !requestRefs.has(i.product_ref)),
    ...fromRequests
  ]

  const filteredAnalyst = analystItems.filter(item =>
    !search || item.name.toLowerCase().includes(search.toLowerCase())
  )

  const tabs = isSteward
    ? ['Data Products', 'Requests', 'Users']
    : ['Data Product', 'Request']

  const tabCounts = isSteward
    ? { 'Data Products': allProducts.length, 'Requests': fromRequests.length, 'Users': null }
    : { 'Data Product': analystItems.filter(i => i.status === 'Approved').length, 'Request': fromRequests.length }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isSteward ? 'Product Management' : 'My Library'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isSteward ? 'Manage data products, onboard from UC, and configure user roles' : 'Your saved and requested data products'}
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
          <button
            onClick={() => onNavigate('register')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: DataMarket_BLUE }}
          >
            <Plus className="h-4 w-4" /> Register Product
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
              activeTab === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'Users' && <Users className="h-3.5 w-3.5" />}
            {tab}
            {tabCounts[tab] != null && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                {tabCounts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Users Tab (Steward) ───────────────────────────────────────────────── */}
      {activeTab === 'Users' && isSteward && <UsersPanel />}

      {/* ── Steward: All Products ─────────────────────────────────────────────── */}
      {((activeTab === 'Data Products' && isSteward) || (activeTab === 'Requests' && isSteward)) && (
        <>
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search products" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {activeTab === 'Data Products' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Ref</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Domain</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Source</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">UC Table</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Frequency</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide w-20">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingProducts && (
                      <tr><td colSpan={8} className="py-12 text-center text-gray-400 text-sm">Loading products...</td></tr>
                    )}
                    {filteredProducts.map(p => {
                      if (editingRef === p.product_ref) {
                        return <ProductEditRow key={p.product_ref} product={p} onSave={() => { setEditingRef(null); loadAllProducts() }} onCancel={() => setEditingRef(null)} />
                      }
                      const st = p.source_type || 'Databricks'
                      const status = p.status || 'Published'
                      return (
                        <tr key={p.product_ref} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 text-xs font-mono text-gray-400">{p.product_ref}</td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-gray-900 text-xs">{p.display_name}</span>
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-600">{p.domain || '-'}</td>
                          <td className="py-3 px-4">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              st === 'Power BI' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                              {st === 'Power BI' ? '📊' : '⚡'} {st}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {p.uc_full_name ? (
                              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                                <Link2 className="h-2.5 w-2.5" /> {p.uc_full_name.split('.').pop()}
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400">Not linked</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-500">{p.refresh_frequency || '-'}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusConfig[status] || 'bg-gray-100 text-gray-700'}`}>
                              {status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button onClick={() => setEditingRef(p.product_ref)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {!loadingProducts && filteredProducts.length === 0 && (
                <div className="py-16 text-center text-gray-400">
                  <Database className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No products found.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Requests' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Product</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Requester</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Reason</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fromRequests.length === 0 && (
                      <tr><td colSpan={4} className="py-12 text-center text-gray-400 text-sm">No requests yet.</td></tr>
                    )}
                    {fromRequests.map(r => (
                      <tr key={r.requestId || r.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-xs font-medium text-gray-900">{r.name}</td>
                        <td className="py-3 px-4 text-xs text-gray-500">{persona.email}</td>
                        <td className="py-3 px-4 text-xs text-gray-500 max-w-xs truncate">{r.reason || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusConfig[r.status] || 'bg-gray-100 text-gray-700'}`}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Analyst View ──────────────────────────────────────────────────────── */}
      {!isSteward && (activeTab === 'Data Product' || activeTab === 'Request') && (
        <>
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Tags</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Frequency</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Owner</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAnalyst
                    .filter(item => activeTab === 'Data Product' ? item.status === 'Approved' : true)
                    .map(item => {
                      const Icon = { Dashboard: BarChart3, Report: FileText, Dataset: Database }[item.type] || Database
                      return (
                        <tr key={item.product_ref || item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4">
                            <button onClick={() => onOpenProduct(item)} className="flex items-center gap-2.5 hover:text-blue-700 transition-colors text-left">
                              <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: '#E8F0F7' }}>
                                <Icon className="h-3.5 w-3.5" style={{ color: DataMarket_BLUE }} />
                              </div>
                              <span className="font-medium text-gray-900 text-xs">{item.name}</span>
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {(item.tags || []).map(tag => (
                                <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tagColors[tag] || 'bg-gray-100 text-gray-700'}`}>{tag}</span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-600">{item.type}</td>
                          <td className="py-3 px-4 text-xs text-gray-600">{item.refreshFrequency}</td>
                          <td className="py-3 px-4 text-xs text-gray-600">{item.owner}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusConfig[item.status] || 'bg-gray-100 text-gray-700'}`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
            {filteredAnalyst.filter(item => activeTab === 'Data Product' ? item.status === 'Approved' : true).length === 0 && (
              <div className="py-16 text-center text-gray-400">
                <BookmarkCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No items found.</p>
              </div>
            )}
          </div>
        </>
      )}

      {showImport && (
        <ImportUCModal onClose={() => setShowImport(false)} onImported={loadAllProducts} />
      )}
    </div>
  )
}
