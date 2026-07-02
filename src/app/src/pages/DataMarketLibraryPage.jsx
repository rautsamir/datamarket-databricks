import React, { useState, useEffect, useCallback } from 'react'
import { Search, Plus, BarChart3, FileText, Database, BookmarkCheck, Edit3, Check, X, Upload, Users, ExternalLink, Link2, Shield, Clock, Package, ClipboardList, FolderOpen, ShieldCheck, Settings, Save, Sparkles, RotateCcw, AlertTriangle, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react'
import { usePersona } from '../context/PersonaContext'
import { ImportUCModal } from '../components/ImportUCModal'
import { DataMarketAdminPage } from './DataMarketAdminPage'
import { useAppConfig } from '../context/AppConfigContext'

const DataMarket_BLUE = '#003865'

function CopyQueryButton({ query }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(query).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }}
      title={`Copy: ${query}`}
      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${copied ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
    >
      {copied ? <><Check className="h-3 w-3" /> Copied</> : <><ClipboardList className="h-3 w-3" /> Copy SQL</>}
    </button>
  )
}

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
  Draft: 'bg-amber-100 text-amber-700',
  Unavailable: 'bg-red-100 text-red-700',
  Denied: 'bg-red-100 text-red-800',
  Revoked: 'bg-orange-100 text-orange-800',
  Rejected: 'bg-red-100 text-red-800',
}

const roleColors = {
  analyst: 'bg-blue-100 text-blue-800',
  manager: 'bg-emerald-100 text-emerald-800',
  steward: 'bg-purple-100 text-purple-800',
}

// ImportUCModal is now a shared component at src/components/ImportUCModal.jsx

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

// ─── Settings Panel (Steward Only) ────────────────────────────────────────────
function DemoControlsPanel() {
  const [resetState, setResetState]   = useState('idle')   // idle | confirm | loading | done
  const [seedState,  setSeedState]    = useState('idle')   // idle | loading | done | error
  const [seedCounts, setSeedCounts]   = useState(null)

  const handleReset = async () => {
    setResetState('loading')
    try {
      await fetch('/api/portal/demo-reset', { method: 'POST' })
      setResetState('done')
      setTimeout(() => { setResetState('idle'); window.location.reload() }, 1500)
    } catch { setResetState('idle') }
  }

  const handleSeed = async () => {
    setSeedState('loading')
    try {
      const res = await fetch('/api/portal/demo-seed', { method: 'POST' })
      const data = await res.json()
      setSeedCounts(data.counts)
      setSeedState('done')
      setTimeout(() => { setSeedState('idle'); window.location.reload() }, 2000)
    } catch { setSeedState('error') }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-5">
        <h3 className="font-semibold text-rose-800 mb-1 flex items-center gap-2">
          <RotateCcw className="h-4 w-4" /> Reset Demo Data
        </h3>
        <p className="text-sm text-rose-700 mb-4">
          Clears all access requests, audit logs, and user library entries. Users and published products are preserved.
        </p>
        {resetState === 'idle' && (
          <button onClick={() => setResetState('confirm')}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700">
            Reset Demo Data
          </button>
        )}
        {resetState === 'confirm' && (
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span className="text-sm text-rose-700 font-medium">Are you sure? This cannot be undone.</span>
            <button onClick={handleReset} className="px-3 py-1.5 bg-rose-600 text-white rounded text-sm font-medium hover:bg-rose-700">Yes, reset</button>
            <button onClick={() => setResetState('idle')} className="px-3 py-1.5 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        )}
        {resetState === 'loading' && <span className="flex items-center gap-2 text-sm text-rose-600"><RotateCcw className="h-4 w-4 animate-spin" /> Clearing...</span>}
        {resetState === 'done'    && <span className="flex items-center gap-2 text-sm text-emerald-600 font-medium"><CheckCircle2 className="h-4 w-4" /> Reset complete</span>}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="font-semibold text-blue-800 mb-1 flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Load Demo Data
        </h3>
        <p className="text-sm text-blue-700 mb-4">
          Seeds 8 sample data products, 3 demo users, and 1 pending access request. Safe to run on an empty catalog — skips existing records.
        </p>
        {seedState === 'idle' && (
          <button onClick={handleSeed}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Load Demo Data
          </button>
        )}
        {seedState === 'loading' && <span className="flex items-center gap-2 text-sm text-blue-600"><RefreshCw className="h-4 w-4 animate-spin" /> Seeding...</span>}
        {seedState === 'done'    && <span className="flex items-center gap-2 text-sm text-emerald-600 font-medium"><CheckCircle2 className="h-4 w-4" /> {seedCounts ? `Loaded — ${seedCounts.products} products, ${seedCounts.users} users` : 'Loaded'}</span>}
        {seedState === 'error'   && <span className="text-sm text-red-600">Seed failed — check app logs.</span>}
      </div>

      <p className="text-xs text-gray-400">Demo Controls are only visible when <code className="font-mono bg-gray-100 px-1 rounded">DEMO_MODE=true</code>.</p>
    </div>
  )
}

function SettingsPanel() {
  const { appName, appSubtitle, appLogoUrl, sqlWarehouseId: cfgWarehouse, rfaEnabled, setupComplete, demoMode, refreshConfig,
          autoDiscoverEnabled, autoDiscoverPrefix, navLinks: configNavLinks, askAiEnabled: cfgAskAi, insightsEnabled: cfgInsights,
          featureRequestsEnabled: cfgFeatureRequests, contributeUrl: cfgContributeUrl,
          aboutText: configAboutText, contactName: configContactName,
          contactEmail: configContactEmail, contactNote: configContactNote,
          faqItems: configFaqItems, searchChips: configSearchChips } = useAppConfig()

  const DEFAULT_NAV_LINKS = [
    { label: 'About',   visible: true },
    { label: 'FAQ',     visible: true },
    { label: 'Contact', visible: true },
  ]
  const DEFAULT_FAQ = [
    { q: 'What is a data product?', a: 'A certified, documented dataset made available for discovery and access through this portal.' },
    { q: 'How do I request access?', a: 'Open a product from the Discover page and click "Request Access". A data steward will review your request.' },
    { q: 'How long does approval take?', a: 'Once approved, Unity Catalog permissions are granted immediately.' },
  ]

  const [form, setForm] = useState({
    app_name:        appName,
    app_subtitle:    appSubtitle,
    app_logo_url:    appLogoUrl || '',
    sql_warehouse_id:cfgWarehouse || '',
    rfa_enabled:     String(rfaEnabled),
    ask_ai_enabled:             String(cfgAskAi !== false),
    insights_enabled:           String(cfgInsights !== false),
    feature_requests_enabled:   String(cfgFeatureRequests === true),
    contribute_url:             cfgContributeUrl || '',
    auto_discover_enabled: String(autoDiscoverEnabled),
    auto_discover_prefix:  autoDiscoverPrefix || '',
    about_text:      configAboutText || '',
    contact_name:    configContactName || '',
    contact_email:   configContactEmail || '',
    contact_note:    configContactNote || '',
  })
  const [navLinks, setNavLinks] = useState(configNavLinks?.length ? configNavLinks : DEFAULT_NAV_LINKS)
  const [faqItems, setFaqItems] = useState(configFaqItems?.length ? configFaqItems : DEFAULT_FAQ)
  const [searchChips, setSearchChips] = useState(configSearchChips || [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    setForm({
      app_name:        appName,
      app_subtitle:    appSubtitle,
      app_logo_url:    appLogoUrl || '',
      sql_warehouse_id:cfgWarehouse || '',
      rfa_enabled:     String(rfaEnabled),
      ask_ai_enabled:             String(cfgAskAi !== false),
      insights_enabled:           String(cfgInsights !== false),
      feature_requests_enabled:   String(cfgFeatureRequests === true),
      contribute_url:             cfgContributeUrl || '',
      auto_discover_enabled: String(autoDiscoverEnabled),
      auto_discover_prefix:  autoDiscoverPrefix || '',
      about_text:      configAboutText || '',
      contact_name:    configContactName || '',
      contact_email:   configContactEmail || '',
      contact_note:    configContactNote || '',
    })
    setNavLinks(configNavLinks?.length ? configNavLinks : DEFAULT_NAV_LINKS)
    setFaqItems(configFaqItems?.length ? configFaqItems : DEFAULT_FAQ)
    setSearchChips(configSearchChips || [])
  }, [appName, appSubtitle, appLogoUrl, cfgWarehouse, rfaEnabled, cfgAskAi, cfgInsights, cfgFeatureRequests, cfgContributeUrl,
      autoDiscoverEnabled, autoDiscoverPrefix,
      configNavLinks, configAboutText, configContactName, configContactEmail, configContactNote, configFaqItems, configSearchChips])

  const handleSave = async () => {
    setSaving(true); setSaved(false); setError('')
    try {
      const r = await fetch('/api/portal/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          setup_complete: 'true',
          nav_links:    JSON.stringify(navLinks),
          faq_items:    JSON.stringify(faqItems),
          search_chips: JSON.stringify(searchChips),
        }),
      })
      if (!r.ok) throw new Error(await r.text())
      setSaved(true)
      refreshConfig()
      setTimeout(() => setSaved(false), 3000)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const field = (label, key, placeholder = '', hint = '') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )

  const toggle = (key, color = 'bg-blue-600') => (
    <button onClick={() => setForm(f => ({ ...f, [key]: f[key] === 'true' ? 'false' : 'true' }))}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${form[key] === 'true' ? color : 'bg-gray-200'}`}>
      <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow transition-transform ${form[key] === 'true' ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )

  return (
    <div className="max-w-2xl space-y-6 mt-4">
      {!setupComplete && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 flex gap-4">
          <Sparkles className="h-6 w-6 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-900 text-sm">Finish setting up your portal</p>
            <p className="text-blue-700 text-sm mt-1">
              Set your portal name and SQL Warehouse ID, then save. Changes take effect immediately — no redeploy needed.
            </p>
          </div>
        </div>
      )}

      {/* ── Branding & Layout ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Branding & Layout</h3>
        <div className="space-y-4">
          {field('Portal Name', 'app_name', 'DataMarket', 'Shown in the top navigation bar')}
          {field('Tagline', 'app_subtitle', 'Data Discovery & Access', 'Subtitle shown under the portal name')}
          {field('Logo URL', 'app_logo_url', '/your-logo.png', 'Path or full URL. Leave empty to hide.')}
        </div>
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Navigation visibility</p>
          {[
            { key: 'ask_ai_enabled',           label: 'Ask AI',        desc: 'Natural language catalog search (Databricks FMAPI)' },
            { key: 'insights_enabled',          label: 'Insights',      desc: 'Dashboard and data product insights gallery' },
            { key: 'feature_requests_enabled',  label: 'Requests',      desc: 'Data demand board — users submit & upvote data requests (off by default)' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              {toggle(key)}
            </div>
          ))}
          <p className="text-xs text-gray-400">Home, Discover, and My Data / Manage are always shown.</p>
        </div>
        <div className="border-t border-gray-100 pt-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Footer links</p>
          {navLinks.map((link, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <button onClick={() => setNavLinks(ls => ls.map((l, idx) => idx === i ? { ...l, visible: !l.visible } : l))}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${link.visible ? 'bg-blue-600' : 'bg-gray-300'}`}>
                <span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${link.visible ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
              <span className="text-sm font-medium text-gray-700 w-16">{link.label}</span>
              <span className="text-xs text-gray-400">in-app page · content editable in Page Content below</span>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Search chips</p>
            <button onClick={() => setSearchChips(c => [...c, { label: '', q: '' }])}
              className="text-xs text-blue-600 hover:underline">+ Add chip</button>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Shortcut buttons below the home search bar. Leave empty to auto-generate from your catalog domains.
          </p>
          {searchChips.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Auto-generating from catalog domains. Add chips above to override.</p>
          ) : (
            <div className="space-y-2">
              {searchChips.map((chip, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="text" value={chip.label} placeholder="Label (e.g. ✦ Fire data)"
                    onChange={e => setSearchChips(c => c.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                    className="w-40 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <input type="text" value={chip.q} placeholder="AI question (e.g. Show me fire incident data)"
                    onChange={e => setSearchChips(c => c.map((x, idx) => idx === i ? { ...x, q: e.target.value } : x))}
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <button onClick={() => setSearchChips(c => c.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-600 text-xs px-1.5 shrink-0">✕</button>
                </div>
              ))}
              <button onClick={() => setSearchChips([])}
                className="text-xs text-gray-400 hover:text-gray-600 underline mt-1">
                Clear all (revert to auto)
              </button>
            </div>
          )}
        </div>
      </div>
      {/* ── Integrations ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Integrations</h3>
        {field('SQL Warehouse ID', 'sql_warehouse_id', 'abc123...', 'Required to execute real GRANT / REVOKE in Unity Catalog on approval. Leave empty to log approvals only.')}
        <div className={`rounded-lg px-4 py-2.5 text-xs border flex items-center gap-2 ${form.sql_warehouse_id ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${form.sql_warehouse_id ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          {form.sql_warehouse_id
            ? <span className="text-emerald-700 font-medium">UC grants enabled — GRANT SELECT will execute on approval</span>
            : <span className="text-amber-700">UC grants disabled — approvals are logged but no UC permissions are set</span>
          }
        </div>
      </div>

      {/* ── Mode ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Mode</h3>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700">RFA Notifications</p>
            <p className="text-xs text-gray-400 mt-0.5">Send Databricks RFA access-request notifications when a user requests access.</p>
          </div>
          {toggle('rfa_enabled')}
        </div>
        {demoMode && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
            <strong>Demo Mode is active.</strong> SSO identity and real UC grants are disabled.
            Set <code className="font-mono bg-amber-100 px-1 rounded">DEMO_MODE=false</code> in app.yaml and redeploy to enable production mode.
          </div>
        )}
      </div>

      {/* ── Data Product Lifecycle ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Data Product Lifecycle</h3>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700">Auto-Discover New UC Tables</p>
            <p className="text-xs text-gray-400 mt-0.5">
              New tables matching the prefix below are automatically added as <span className="font-medium text-amber-600">Draft</span> each time the app starts for admin review — nothing goes live without approval.
            </p>
          </div>
          {toggle('auto_discover_enabled', 'bg-emerald-500')}
        </div>
        {field('Discovery Prefix', 'auto_discover_prefix', 'main.gold or main.gold.sales_', 'catalog.schema or catalog.schema.name_prefix to scan.')}
      </div>

      {/* ── Page Content ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Page Content</h3>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">About page</p>
          <textarea rows={3} value={form.about_text}
            onChange={e => setForm(f => ({ ...f, about_text: e.target.value }))}
            placeholder="Describe this portal in 2–3 sentences. Leave blank to show the default description."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Product feedback link <span className="text-gray-400 font-normal">(Loop 2 — optional)</span>
            </label>
            <input type="url" value={form.contribute_url}
              onChange={e => setForm(f => ({ ...f, contribute_url: e.target.value }))}
              placeholder="https://github.com/your-org/datamarket/issues/new"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <p className="text-[11px] text-gray-400 mt-1">Displayed on the About page as a "Suggest a feature" link. GitHub Issues, Slack channel, or any URL.</p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact page</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input type="text" value={form.contact_name} placeholder="Your name"
                onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={form.contact_email} placeholder="you@databricks.com"
                onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>
          <input type="text" value={form.contact_note} placeholder="Note — e.g. Slack: #data-platform · Response time: 1 business day"
            onChange={e => setForm(f => ({ ...f, contact_note: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">FAQ items</p>
            <button onClick={() => setFaqItems(f => [...f, { q: '', a: '' }])}
              className="text-xs text-blue-600 hover:underline">+ Add question</button>
          </div>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50">
                <div className="flex items-start gap-2">
                  <input type="text" value={item.q} placeholder="Question"
                    onChange={e => setFaqItems(f => f.map((x, idx) => idx === i ? { ...x, q: e.target.value } : x))}
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                  <button onClick={() => setFaqItems(f => f.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-600 text-xs px-2 py-1.5 shrink-0">✕</button>
                </div>
                <textarea rows={2} value={item.a} placeholder="Answer"
                  onChange={e => setFaqItems(f => f.map((x, idx) => idx === i ? { ...x, a: e.target.value } : x))}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-white" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pb-4">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: DataMarket_BLUE }}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span className="text-sm text-green-600 flex items-center gap-1"><Check className="h-4 w-4" /> Saved — changes are live</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  )
}

// ─── Users Tab (Steward Only) ──────────────────────────────────────────────────
function UsersPanel() {
  const [activeView, setActiveView] = useState('users') // 'users' | 'groups'

  return (
    <div>
      {/* Users / Groups toggle */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {[{ id: 'users', label: 'Users' }, { id: 'groups', label: 'Groups' }].map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeView === v.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {v.label}
          </button>
        ))}
      </div>
      {activeView === 'users' ? <UsersList /> : <GroupsList />}
    </div>
  )
}

function UsersList() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ email: '', display_name: '', role: 'analyst', department: '' })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  // ── SCIM search state ──────────────────────────────────────────────────────
  const [scimQuery, setScimQuery] = useState('')
  const [scimResults, setScimResults] = useState([])
  const [scimLoading, setScimLoading] = useState(false)
  const scimTimer = React.useRef(null)

  const loadUsers = useCallback(() => {
    fetch('/api/portal/admin/users')
      .then(r => r.json())
      .then(rows => { if (Array.isArray(rows)) setUsers(rows) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  // Debounced SCIM lookup
  const handleScimInput = (val) => {
    setScimQuery(val)
    setAddForm(f => ({ ...f, email: val, display_name: f.display_name }))
    clearTimeout(scimTimer.current)
    if (val.length < 2) { setScimResults([]); return }
    setScimLoading(true)
    scimTimer.current = setTimeout(() => {
      fetch(`/api/portal/admin/scim-search?q=${encodeURIComponent(val)}`)
        .then(r => r.json())
        .then(rows => setScimResults(Array.isArray(rows) ? rows : []))
        .catch(() => setScimResults([]))
        .finally(() => setScimLoading(false))
    }, 300)
  }

  const selectScimUser = (u) => {
    setAddForm(f => ({ ...f, email: u.email, display_name: u.display_name }))
    setScimQuery(u.display_name)
    setScimResults([])
  }

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

  const handleAddUser = async () => {
    if (!addForm.email.trim()) { setAddError('Email is required'); return }
    setAdding(true); setAddError('')
    try {
      const r = await fetch('/api/portal/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm)
      })
      if (!r.ok) { const d = await r.json(); setAddError(d.error || 'Failed to add user'); return }
      setShowAdd(false)
      setAddForm({ email: '', display_name: '', role: 'analyst', department: '' })
      setScimQuery('')
      setScimResults([])
      loadUsers()
    } catch (e) { setAddError(e.message) }
    finally { setAdding(false) }
  }

  const filtered = users.filter(u =>
    !search || u.display_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Search users" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button
          onClick={() => { setShowAdd(v => !v); setAddError(''); setScimQuery(''); setScimResults([]) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#003865' }}
        >
          <Plus className="h-4 w-4" /> Add User
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 p-4 bg-blue-50/60 border border-blue-100 rounded-xl">
          <p className="text-sm font-semibold text-gray-800 mb-1">Add / update a user</p>
          <p className="text-xs text-gray-500 mb-3">Search by name or email — picks from your Databricks workspace users</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">

            {/* SCIM search input */}
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                placeholder="Search workspace users (name or email) *"
                value={scimQuery}
                onChange={e => handleScimInput(e.target.value)}
                autoComplete="off"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {(scimLoading || scimResults.length > 0) && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 mt-1 overflow-hidden">
                  {scimLoading && (
                    <div className="px-4 py-3 text-xs text-gray-400">Searching workspace users...</div>
                  )}
                  {!scimLoading && scimResults.map((u, i) => (
                    <button
                      key={i}
                      onMouseDown={() => selectScimUser(u)}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex items-center gap-3 border-b border-gray-50 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {(u.display_name || u.email).split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{u.display_name}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </button>
                  ))}
                  {!scimLoading && scimResults.length === 0 && scimQuery.length >= 2 && (
                    <div className="px-4 py-3 text-xs text-gray-500">
                      No workspace users found — you can still enter an email manually below
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Manual email fallback (pre-filled from SCIM selection) */}
            <input
              placeholder="Email *"
              value={addForm.email}
              onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              placeholder="Display name"
              value={addForm.display_name}
              onChange={e => setAddForm(f => ({ ...f, display_name: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={addForm.role}
              onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="analyst">Analyst</option>
              <option value="manager">Manager</option>
              <option value="data_steward">Data Steward</option>
            </select>
            <input
              placeholder="Department"
              value={addForm.department}
              onChange={e => setAddForm(f => ({ ...f, department: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {addError && <p className="text-xs text-red-500 mb-2">{addError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAddUser}
              disabled={adding}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#003865' }}
            >
              {adding ? 'Saving...' : 'Save User'}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

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

// ─── Groups Panel ─────────────────────────────────────────────────────────────
function GroupsList() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ group_name: '', scim_id: '', role: 'analyst', department: '' })
  const [adding, setAdding] = useState(false)
  const [scimQuery, setScimQuery] = useState('')
  const [scimResults, setScimResults] = useState([])
  const [scimLoading, setScimLoading] = useState(false)
  const scimTimer = React.useRef(null)

  const loadGroups = useCallback(() => {
    fetch('/api/portal/admin/groups')
      .then(r => r.json())
      .then(rows => { if (Array.isArray(rows)) setGroups(rows) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadGroups() }, [loadGroups])

  const handleScimGroupInput = (val) => {
    setScimQuery(val)
    setAddForm(f => ({ ...f, group_name: val, scim_id: '' }))
    clearTimeout(scimTimer.current)
    if (val.length < 1) { setScimResults([]); return }
    setScimLoading(true)
    scimTimer.current = setTimeout(() => {
      fetch(`/api/portal/admin/scim-groups-search?q=${encodeURIComponent(val)}`)
        .then(r => r.json())
        .then(rows => setScimResults(Array.isArray(rows) ? rows : []))
        .catch(() => setScimResults([]))
        .finally(() => setScimLoading(false))
    }, 300)
  }

  const selectGroup = (g) => {
    setAddForm(f => ({ ...f, group_name: g.group_name, scim_id: g.scim_id }))
    setScimQuery(g.group_name)
    setScimResults([])
  }

  const handleAddGroup = async () => {
    if (!addForm.group_name.trim()) return
    setAdding(true)
    try {
      const r = await fetch('/api/portal/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm)
      })
      if (r.ok) {
        setShowAdd(false)
        setAddForm({ group_name: '', scim_id: '', role: 'analyst', department: '' })
        setScimQuery(''); setScimResults([])
        loadGroups()
      }
    } catch (_) {}
    finally { setAdding(false) }
  }

  const deleteGroup = async (id) => {
    if (!window.confirm('Remove this group?')) return
    await fetch(`/api/portal/admin/groups/${id}`, { method: 'DELETE' })
    loadGroups()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">Groups assigned a role here automatically grant that role to members on first login.</p>
        <button
          onClick={() => { setShowAdd(v => !v); setScimQuery(''); setScimResults([]) }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white shrink-0"
          style={{ backgroundColor: '#003865' }}
        >
          <Plus className="h-4 w-4" /> Add Group
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 p-4 bg-violet-50/60 border border-violet-100 rounded-xl">
          <p className="text-sm font-semibold text-gray-800 mb-1">Add a workspace group</p>
          <p className="text-xs text-gray-500 mb-3">Search your Databricks/Entra ID groups by name</p>

          {/* SCIM group search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              placeholder="Search workspace groups *"
              value={scimQuery}
              onChange={e => handleScimGroupInput(e.target.value)}
              autoComplete="off"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            {(scimLoading || scimResults.length > 0) && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 mt-1 overflow-hidden">
                {scimLoading && <div className="px-4 py-3 text-xs text-gray-400">Searching groups...</div>}
                {!scimLoading && scimResults.map((g, i) => (
                  <button key={i} onMouseDown={() => selectGroup(g)}
                    className="w-full text-left px-4 py-2.5 hover:bg-violet-50 flex items-center gap-3 border-b border-gray-50 last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{g.group_name}</p>
                      {g.member_count > 0 && <p className="text-xs text-gray-400">{g.member_count} member{g.member_count !== 1 ? 's' : ''}</p>}
                    </div>
                  </button>
                ))}
                {!scimLoading && scimResults.length === 0 && scimQuery.length >= 1 && (
                  <div className="px-4 py-3 text-xs text-gray-500">No groups found — you can still type a group name manually</div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <select value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
              <option value="analyst">Analyst</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin / Data Steward</option>
            </select>
            <input placeholder="Department (optional)" value={addForm.department}
              onChange={e => setAddForm(f => ({ ...f, department: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddGroup} disabled={adding || !addForm.group_name.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: '#003865' }}>
              {adding ? 'Saving...' : 'Save Group'}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Group Name</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Role Assigned</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Department</th>
              <th className="text-center py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide w-16">Remove</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="py-12 text-center text-gray-400 text-sm">Loading groups...</td></tr>}
            {!loading && groups.length === 0 && (
              <tr><td colSpan={4} className="py-10 text-center text-gray-400 text-sm">
                No groups configured. Add a group to automatically assign roles to its members.
              </td></tr>
            )}
            {groups.map(g => (
              <tr key={g.group_id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                      <Users className="h-3.5 w-3.5 text-violet-600" />
                    </div>
                    <span className="font-medium text-gray-900 text-xs">{g.group_name}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${roleColors[g.role] || 'bg-gray-100 text-gray-700'}`}>
                    {g.role}
                  </span>
                </td>
                <td className="py-3 px-4 text-xs text-gray-500">{g.department || '-'}</td>
                <td className="py-3 px-4 text-center">
                  <button onClick={() => deleteGroup(g.group_id)} className="p-1 rounded bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Library Page ─────────────────────────────────────────────────────────
export function DataMarketLibraryPage({ onNavigate, onOpenProduct, initialTab }) {
  const { myRequests, persona, currentPersona, pendingRequests, isAdmin, apiAvailable } = usePersona()
  const { demoMode, databricksHost, sqlWarehouseId } = useAppConfig()
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

  const pendingApprovalCount = pendingRequests?.length || 0

  const tabCounts = isSteward
    ? { 'Data Products': allProducts.length, 'Manage Approvals': pendingApprovalCount || null, 'Users': null, 'Settings': null }
    : { 'Data Product': analystItems.filter(i => i.status === 'Approved').length, 'Request': fromRequests.length }

  const tabConfig = isSteward
    ? [
        { id: 'Data Products',    icon: Package,       label: 'Data Products',    desc: 'All registered products',     activeColor: 'bg-blue-600 text-white border-blue-600',    countColor: 'bg-blue-500 text-white' },
        { id: 'Manage Approvals', icon: ShieldCheck,   label: 'Manage Approvals', desc: 'Review access requests',      activeColor: 'bg-amber-500 text-white border-amber-500',  countColor: 'bg-red-500 text-white' },
        { id: 'Users',            icon: Users,         label: 'Users',            desc: 'Manage user roles',           activeColor: 'bg-purple-600 text-white border-purple-600',countColor: 'bg-purple-500 text-white' },
        { id: 'Settings',         icon: Settings,      label: 'Settings',         desc: 'Configure portal',            activeColor: 'bg-gray-700 text-white border-gray-700',    countColor: 'bg-gray-500 text-white' },
        { id: 'My Data',          icon: FolderOpen,    label: 'My Data',          desc: 'Your personal access & products', activeColor: 'bg-emerald-600 text-white border-emerald-600', countColor: 'bg-emerald-500 text-white' },
        ...(demoMode ? [{ id: 'Demo Controls', icon: RotateCcw, label: 'Demo Controls', desc: 'Reset or reload demo data', activeColor: 'bg-rose-600 text-white border-rose-600', countColor: 'bg-rose-500 text-white' }] : []),
      ]
    : [
        { id: 'Data Product',     icon: FolderOpen,    label: 'My Products',      desc: 'Data you have access to',     activeColor: 'bg-emerald-600 text-white border-emerald-600', countColor: 'bg-emerald-500 text-white' },
        { id: 'Request',          icon: Clock,         label: 'My Requests',      desc: 'Pending & past requests',     activeColor: 'bg-blue-600 text-white border-blue-600',      countColor: 'bg-blue-500 text-white' },
      ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isSteward ? 'Product Management' : 'My Data'}
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

      {/* ── Users Tab (Steward) ───────────────────────────────────────────────── */}
      {activeTab === 'Users' && isSteward && <UsersPanel />}

      {/* ── Settings Tab (Steward) ────────────────────────────────────────────── */}
      {activeTab === 'Settings' && isSteward && <SettingsPanel />}

      {activeTab === 'Demo Controls' && isSteward && demoMode && <DemoControlsPanel />}

      {/* ── Manage Approvals Tab (Steward) — embeds the full admin approval UI ── */}
      {activeTab === 'Manage Approvals' && isSteward && (
        <>
          {!sqlWarehouseId && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">UC grants are disabled</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Approving a request will log it in the portal but <strong>will not set any Unity Catalog permissions</strong> — the user won't actually be able to query the table.
                  {' '}<button className="underline font-medium" onClick={() => setActiveTab('Settings')}>Set a SQL Warehouse ID in Settings</button> to activate real UC grants.
                </p>
              </div>
            </div>
          )}
          <DataMarketAdminPage embedded />
        </>
      )}

      {/* ── Steward: All Products ─────────────────────────────────────────────── */}
      {((activeTab === 'Data Products' && isSteward)) && (
        <>
          {/* Sync result toast */}
          {syncResult && !syncResult.error && (
            <div className="mb-3 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Sync complete — {syncResult.synced} refreshed, {syncResult.unavailable} marked unavailable
            </div>
          )}
          {syncResult?.error && (
            <div className="mb-3 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{syncResult.error}</div>
          )}
          {/* Draft products banner */}
          {allProducts.filter(p => p.status === 'Draft').length > 0 && (
            <div className="mb-3 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>{allProducts.filter(p => p.status === 'Draft').length} draft product{allProducts.filter(p => p.status === 'Draft').length > 1 ? 's' : ''}</strong> auto-discovered from UC — review below and Publish or Delete.
              </span>
            </div>
          )}
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
                    {productsError && !loadingProducts && (
                      <tr><td colSpan={8} className="py-6 text-center text-red-500 text-sm">Error: {productsError}</td></tr>
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
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => setEditingRef(p.product_ref)} title="Quick edit (technical fields)" className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => onNavigate('register', { editProduct: p })} title="Full edit (all fields)" className="p-1 rounded hover:bg-blue-100 text-blue-400 hover:text-blue-700">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </button>
                            </div>
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
      {(!isSteward || activeTab === 'My Data') && (activeTab === 'Data Product' || activeTab === 'Request' || activeTab === 'My Data') && (
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
                    {(activeTab === 'Data Product' || activeTab === 'My Data') && (
                      <th className="text-center py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wide">Query</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredAnalyst
                    .filter(item => (activeTab === 'Data Product' || activeTab === 'My Data') ? item.status === 'Approved' : true)
                    .map(item => {
                      const Icon = { Dashboard: BarChart3, Report: FileText, Dataset: Database }[item.type] || Database
                      const ucFullName = item.uc_full_name
                      const ucParts = ucFullName ? ucFullName.split('.') : []
                      const ucExplorerUrl = ucFullName && databricksHost
                        ? `${databricksHost}/explore/data/${ucParts.join('/')}`
                        : null
                      const starterQuery = ucFullName
                        ? `SELECT *\nFROM ${ucFullName}\nLIMIT 100`
                        : null
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
                          {(activeTab === 'Data Product' || activeTab === 'My Data') && (
                            <td className="py-3 px-4">
                              {item.status === 'Approved' && ucFullName ? (
                                <div className="flex items-center gap-1 justify-center">
                                  {ucExplorerUrl && (
                                    <a href={ucExplorerUrl} target="_blank" rel="noopener noreferrer"
                                      title="Open in UC Data Explorer"
                                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap">
                                      <ExternalLink className="h-3 w-3" /> Explore
                                    </a>
                                  )}
                                  {starterQuery && (
                                    <CopyQueryButton query={starterQuery} />
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
            {filteredAnalyst.filter(item => (activeTab === 'Data Product' || activeTab === 'My Data') ? item.status === 'Approved' : true).length === 0 && (
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
