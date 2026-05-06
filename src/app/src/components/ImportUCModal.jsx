import React, { useState, useEffect } from 'react'
import { Upload, X, Check, Database } from 'lucide-react'

const DataMarket_BLUE = '#003865'

export function ImportUCModal({ onClose, onImported }) {
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
