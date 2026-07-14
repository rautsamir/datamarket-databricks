import React, { useState, useEffect } from 'react'
import { Database, Warehouse, CheckCircle2, ArrowRight, X, Sparkles, Package } from 'lucide-react'
import { useAppConfig } from '@/context/AppConfigContext'
import { ImportUCModal } from '@/components/ImportUCModal'

const BLUE = '#003865'

const STEPS = [
  {
    id: 'warehouse',
    short: 'SQL Warehouse',
    icon: Warehouse,
    title: 'Connect a SQL Warehouse',
    desc: 'Required so the app can execute Unity Catalog grants when you approve access requests.',
  },
  {
    id: 'import',
    short: 'Import data',
    icon: Package,
    title: 'Import your first data products',
    desc: 'Pull tables from Unity Catalog into the catalog. Users can\'t discover anything until you import.',
  },
  {
    id: 'done',
    short: 'You\'re live',
    icon: CheckCircle2,
    title: 'You\'re live',
    desc: 'Your portal is ready. Share the URL with your team.',
  },
]

export function FirstRunWizard({ onDismiss }) {
  const { appName, refreshConfig } = useAppConfig()
  const [step, setStep]               = useState(0)
  const [warehouseId, setWarehouseId] = useState('')
  const [warehousePreFilled, setWarehousePreFilled] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState('')
  const [showImport, setShowImport]   = useState(false)
  const [imported, setImported]       = useState(false)

  // Pre-fill warehouse ID if already configured (e.g. set by deploy script)
  useEffect(() => {
    fetch('/api/portal/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const id = data?.sql_warehouse_id || ''
        if (id) { setWarehouseId(id); setWarehousePreFilled(true) }
      })
      .catch(() => {})
  }, [])

  const saveWarehouse = async () => {
    if (!warehouseId.trim()) { setSaveError('Paste your warehouse ID first.'); return }
    setSaving(true); setSaveError('')
    try {
      const r = await fetch('/api/portal/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql_warehouse_id: warehouseId.trim() }),
      })
      if (!r.ok) throw new Error(await r.text())
      refreshConfig()
      setStep(1)
    } catch (e) { setSaveError(e.message) }
    finally { setSaving(false) }
  }

  const markComplete = async () => {
    await fetch('/api/portal/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setup_complete: 'true' }),
    }).catch(() => {})
    refreshConfig()
    onDismiss()
  }

  const progressPct = (step / (STEPS.length - 1)) * 100

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

          {/* Header */}
          <div className="px-6 pt-6 pb-4" style={{ background: `linear-gradient(135deg, ${BLUE} 0%, #1e4a7a 100%)` }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-lg leading-tight">Set up {appName}</h2>
                  <p className="text-white/70 text-xs mt-0.5">3 quick steps — takes about 2 minutes</p>
                </div>
              </div>
              <button onClick={markComplete}
                className="text-white/50 hover:text-white/90 transition-colors mt-0.5"
                title="Skip setup">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="mt-4 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flex justify-between mt-1.5">
              {STEPS.map((s, i) => (
                <span key={s.id}
                  className={`text-[10px] font-medium transition-colors ${i <= step ? 'text-white' : 'text-white/40'}`}>
                  {i + 1}. {s.short}
                </span>
              ))}
            </div>
          </div>

          {/* Step content */}
          <div className="px-6 py-5">
            {/* Step 1 — Warehouse */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Warehouse className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{STEPS[0].title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{STEPS[0].desc}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    SQL Warehouse ID
                  </label>
                  {warehousePreFilled && (
                    <div className="flex items-center gap-2 mb-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <p className="text-xs text-emerald-700">Auto-detected by deploy script — verify below or continue.</p>
                    </div>
                  )}
                  <input
                    type="text"
                    value={warehouseId}
                    onChange={e => { setWarehouseId(e.target.value); setWarehousePreFilled(false) }}
                    onKeyDown={e => e.key === 'Enter' && saveWarehouse()}
                    placeholder="e.g. abc1234def567890"
                    autoFocus={!warehousePreFilled}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  {!warehousePreFilled && (
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      Find it in SQL Warehouses → your warehouse → <strong>Connection Details</strong> → HTTP Path — it's the last segment after <code className="bg-gray-100 px-1 rounded">/sql/1.0/warehouses/</code>
                    </p>
                  )}
                </div>
                {saveError && (
                  <p className="text-xs text-red-600">{saveError}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={saveWarehouse} disabled={saving || !warehouseId.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: BLUE }}>
                    {saving ? 'Saving…' : warehousePreFilled ? 'Confirm & continue' : 'Save & continue'} {!saving && <ArrowRight className="h-4 w-4" />}
                  </button>
                  <button onClick={() => setStep(1)}
                    className="px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-gray-600">
                    Skip for now
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 — Import */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{STEPS[1].title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{STEPS[1].desc}</p>
                  </div>
                </div>
                {imported ? (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <p className="text-sm text-emerald-700 font-medium">Tables imported. Ready to go!</p>
                  </div>
                ) : (
                  <button onClick={() => setShowImport(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white"
                    style={{ backgroundColor: BLUE }}>
                    <Database className="h-4 w-4" /> Import from Unity Catalog
                  </button>
                )}
                <div className="flex gap-2 pt-1">
                  {imported && (
                    <button onClick={() => setStep(2)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white"
                      style={{ backgroundColor: BLUE }}>
                      Continue <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => setStep(2)}
                    className="px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-gray-600">
                    {imported ? '' : 'Skip for now'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — Done */}
            {step === 2 && (
              <div className="space-y-4 text-center py-2">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-lg">You're all set!</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {appName} is configured and ready. Invite your team and start approving access requests.
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">What's next</p>
                  {[
                    'Share this URL with your data consumers',
                    'Add data stewards in Manage → Users',
                    'Customise the portal name and logo in Settings',
                  ].map(t => (
                    <div key={t} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      {t}
                    </div>
                  ))}
                </div>
                <button onClick={markComplete}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: BLUE }}>
                  Open {appName} →
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Import UC Modal */}
      {showImport && (
        <ImportUCModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); setImported(true) }}
        />
      )}
    </>
  )
}
