import React, { useState } from 'react'
import { AlertTriangle, Copy, CheckCircle2, RefreshCw } from 'lucide-react'

const BLUE = '#003865'

// Shown when the backend could not initialize its Lakebase database. Without
// this, every API call fails and the UI silently renders empty/fallback content,
// which looks like a working app with no data rather than a setup problem.
export function SetupErrorScreen({ health }) {
  const [copied, setCopied] = useState(false)

  const copyHint = () => {
    navigator.clipboard.writeText(health.hint || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const title = {
    auth_failed:   'Service principal has no database role',
    no_permission: 'Insufficient database permissions',
    unreachable:   'Cannot reach Lakebase',
  }[health.status] || 'Database not initialized'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-6 text-white" style={{ backgroundColor: BLUE }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">DataMarket setup incomplete</h1>
              <p className="text-sm text-white/70 mt-0.5">{title}</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-5">
          <p className="text-sm text-gray-700 leading-relaxed">{health.message}</p>

          {health.hint && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">How to fix</p>
              <div className="relative bg-gray-950 rounded-xl p-4 pr-10 overflow-hidden">
                <pre className="text-xs text-emerald-300 font-mono whitespace-pre-wrap leading-relaxed overflow-auto max-h-48">
                  {health.hint}
                </pre>
                <button onClick={copyHint} title="Copy"
                  className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors">
                  {copied
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            <p className="text-xs text-blue-800 leading-relaxed">
              Once the fix is applied, restart the app from the Databricks Apps page
              (or redeploy). DataMarket creates its schema and tables automatically on
              startup — no manual SQL is required beyond the step above.
            </p>
          </div>

          <button onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: BLUE }}>
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </div>
    </div>
  )
}
