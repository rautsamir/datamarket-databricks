import React, { useState, useRef } from 'react'
import { Upload, Download, FileText, CheckCircle2, AlertTriangle, XCircle, Loader2, X } from 'lucide-react'
import { parseCsv, rowsFromJson } from '../lib/csv'

const MAX_ROWS = 500

// One example row so the template shows what a good line looks like. Synthetic.
const TEMPLATE = [
  'name,description,report_url,owner_email,source_type,workspace,domain,tags,classification,refresh_frequency,upstream_table',
  '"Quarterly Spend by Department","Spend against budget for each department, refreshed nightly.","https://app.powerbi.com/groups/00000000-0000-0000-0000-000000000000/reports/11111111-1111-1111-1111-111111111111","owner@example.org","Power BI","Finance Reporting","Finance","budget;spend","Internal","Daily","main.finance.spend_gold"',
].join('\n')

const ACTION_STYLE = {
  create: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  update: 'bg-blue-50 text-blue-700 border-blue-200',
  skip:   'bg-red-50 text-red-700 border-red-200',
}
const ACTION_LABEL = { create: 'Add', update: 'Update', skip: 'Skip' }

function shortLink(link) {
  try {
    const u = new URL(link)
    const rest = (u.pathname + u.hash).replace(/\/$/, '')
    return u.hostname + (rest.length > 38 ? rest.slice(0, 36) + '…' : rest)
  } catch {
    return link || '—'
  }
}

async function postImport(body) {
  const res = await fetch('/api/portal/admin/import-external', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok && !data.rows) throw new Error(data.error || `Import failed (${res.status})`)
  return data
}

export function ImportFileModal({ onClose, onImported, onViewProducts }) {
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [preview, setPreview] = useState(null)
  const [landAs, setLandAs] = useState('Pending')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const fileRef = useRef(null)

  const reset = () => {
    setFileName(''); setRows([]); setPreview(null); setError(''); setDone(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE + '\n'], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'datamarket-import-template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(null); setError(''); setDone(null); setRows([])
    setFileName(file.name)
    setBusy(true)
    try {
      const text = await file.text()
      const parsed = /\.json$/i.test(file.name) ? rowsFromJson(text) : parseCsv(text).rows
      if (!parsed.length) throw new Error('No rows found in the file.')
      if (parsed.length > MAX_ROWS) throw new Error(`This file has ${parsed.length} rows. Import up to ${MAX_ROWS} at a time.`)
      setRows(parsed)
      setPreview(await postImport({ rows: parsed, dryRun: true }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const runImport = async () => {
    setBusy(true); setError('')
    try {
      setDone(await postImport({ rows, landAs, dryRun: false }))
      setPreview(null)
      onImported?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const summary = preview?.summary
  const importable = summary ? summary.create + summary.update : 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col" style={{ maxHeight: '88vh' }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Import from a file</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Power BI, Tableau, Looker, or anything with a link. Importing the same file again updates products instead of adding duplicates.
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg shrink-0" aria-label="Close">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
          {done ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <p className="mt-3 font-semibold text-gray-900">Import complete</p>
              <p className="text-sm text-gray-600 mt-1">
                {done.summary.create} added, {done.summary.update} updated
                {done.summary.skip > 0 && `, ${done.summary.skip} skipped`}.
              </p>
              {done.summary.create > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  {done.landAs === 'Pending'
                    ? 'New products are waiting in Manage Approvals for review.'
                    : 'New products are live in the catalog.'}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={downloadTemplate}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
                  <Download className="h-4 w-4" /> Download template
                </button>
                <label className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg cursor-pointer ${
                  preview ? 'border border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                  <Upload className="h-4 w-4" /> {preview ? 'Choose another file' : 'Choose file'}
                  <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" className="hidden" onChange={onFile} />
                </label>
                {fileName && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                    <FileText className="h-4 w-4 text-gray-400" /> {fileName}
                    {rows.length > 0 && <span className="text-gray-400">· {rows.length} row{rows.length !== 1 ? 's' : ''}</span>}
                  </span>
                )}
              </div>

              {!preview && (
                <p className="text-xs text-gray-400">
                  CSV or JSON, up to {MAX_ROWS} rows. Required: <strong>name</strong> and <strong>report_url</strong>. Recommended: owner_email
                  and description. Column names from vendor exports, like webUrl or configuredBy, work as they are.
                </p>
              )}

              {busy && !preview && (
                <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Checking file…</div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
                </div>
              )}

              {preview && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 mr-1">Preview</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${ACTION_STYLE.create}`}>{summary.create} to add</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${ACTION_STYLE.update}`}>{summary.update} to update</span>
                    {summary.skip > 0 && <span className={`text-xs px-2 py-0.5 rounded-full border ${ACTION_STYLE.skip}`}>{summary.skip} skipped</span>}
                    {summary.warnings > 0 && <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">{summary.warnings} with warnings</span>}
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-4 py-2 w-12">Row</th>
                        <th className="text-left px-4 py-2">Name</th>
                        <th className="text-left px-4 py-2">Link</th>
                        <th className="text-left px-4 py-2">Source</th>
                        <th className="text-left px-4 py-2">Result</th>
                        <th className="text-left px-4 py-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.rows.map(r => (
                        <tr key={r.rowNumber} className={r.action === 'skip' ? 'bg-red-50/40' : ''}>
                          <td className="px-4 py-2 text-gray-400">{r.rowNumber}</td>
                          <td className="px-4 py-2 font-medium text-gray-900">{r.name || <span className="text-gray-400">—</span>}</td>
                          <td className="px-4 py-2 text-gray-500 font-mono text-xs">{shortLink(r.link)}</td>
                          <td className="px-4 py-2 text-gray-600">{r.sourceType}</td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${ACTION_STYLE[r.action]}`}>
                              {ACTION_LABEL[r.action]}{r.matchRef ? ` ${r.matchRef}` : ''}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs">
                            {r.problems.map((p, i) => <div key={i} className="text-red-600 flex items-start gap-1"><XCircle className="h-3 w-3 mt-0.5 shrink-0" />{p}</div>)}
                            {r.warnings.map((w, i) => <div key={i} className="text-amber-600 flex items-start gap-1"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{w}</div>)}
                            {r.existingStatus && r.existingStatus !== 'Published' && (
                              <div className="text-gray-500">Existing product is {r.existingStatus}; its status won't change.</div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {preview && !done && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex flex-wrap items-center gap-4">
            <fieldset className="flex flex-wrap items-center gap-4 text-sm">
              <legend className="sr-only">New products land as</legend>
              <span className="text-gray-600 font-medium">New products land as</span>
              <label className="inline-flex items-center gap-1.5">
                <input type="radio" name="landAs" checked={landAs === 'Pending'} onChange={() => setLandAs('Pending')} />
                Pending review <span className="text-xs text-gray-400">(recommended)</span>
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input type="radio" name="landAs" checked={landAs === 'Published'} onChange={() => setLandAs('Published')} />
                Published
              </label>
            </fieldset>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={reset} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">Start over</button>
              <button onClick={runImport} disabled={busy || importable === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Import {importable} product{importable !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
        {done && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-2">
            <button onClick={reset} className="px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-white">Import another file</button>
            <button onClick={onViewProducts} className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">View data products</button>
          </div>
        )}
      </div>
    </div>
  )
}
