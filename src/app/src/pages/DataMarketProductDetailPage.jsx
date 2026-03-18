import React, { useState } from 'react'
import { ArrowLeft, BarChart3, FileText, Database, X, Calendar, User, RefreshCw, Tag, Lock, ExternalLink, CheckCircle2, Clock, Eye, EyeOff } from 'lucide-react'
import { usePersona } from '../context/PersonaContext'

const DataMarket_BLUE = '#003865'

const tagColors = {
  Budget: 'bg-blue-100 text-blue-800', Financial: 'bg-green-100 text-green-800',
  'ERP System': 'bg-purple-100 text-purple-800', Payroll: 'bg-orange-100 text-orange-800',
  HR: 'bg-pink-100 text-pink-800', 'Property Tax': 'bg-amber-100 text-amber-800',
  Revenue: 'bg-teal-100 text-teal-800', HRIS: 'bg-indigo-100 text-indigo-800',
  Demographics: 'bg-rose-100 text-rose-800', Audit: 'bg-red-100 text-red-800',
  IT: 'bg-gray-100 text-gray-800', GIS: 'bg-cyan-100 text-cyan-800',
  'Health Services': 'bg-emerald-100 text-emerald-800',
}

const typeIcons = { Dashboard: BarChart3, Report: FileText, Dataset: Database }

// Generic sample data schemas indexed by domain/category
const sampleDataByDomain = {
  Budget: {
    columns: ['Department', 'FY Budget', 'YTD Spent', 'Variance', 'Status'],
    rows: [
      ['Public Works', '$4.2M', '$3.1M', '+$1.1M', 'On Track'],
      ['Health Services', '$8.7M', '$7.9M', '+$0.8M', 'On Track'],
      ['IT & Digital', '$2.3M', '$2.6M', '-$0.3M', 'Over Budget'],
      ['Parks & Rec', '$1.8M', '$1.2M', '+$0.6M', 'Under Spend'],
    ]
  },
  HRIS: {
    columns: ['Department', 'Headcount', 'Avg Salary', 'Overtime Hrs', 'Turnover Rate'],
    rows: [
      ['Finance', '142', '$78,400', '312', '4.2%'],
      ['Engineering', '88', '$94,200', '188', '6.1%'],
      ['HR & Admin', '56', '$72,100', '94', '3.8%'],
      ['Operations', '210', '$65,800', '544', '8.3%'],
    ]
  },
  Payroll: {
    columns: ['Pay Period', 'Gross Pay', 'Benefits', 'Net Pay', 'Employees Paid'],
    rows: [
      ['Jan 2025', '$12.4M', '$2.1M', '$10.3M', '1,842'],
      ['Feb 2025', '$12.6M', '$2.1M', '$10.5M', '1,851'],
      ['Mar 2025', '$12.8M', '$2.2M', '$10.6M', '1,858'],
      ['Apr 2025', '$13.1M', '$2.2M', '$10.9M', '1,872'],
    ]
  },
  'Property Tax': {
    columns: ['District', 'Assessed Value', 'Tax Levied', 'Collected', 'Delinquency %'],
    rows: [
      ['District 1', '$18.2B', '$182M', '$174M', '4.4%'],
      ['District 2', '$11.7B', '$117M', '$109M', '6.8%'],
      ['District 3', '$9.4B', '$94M', '$91M', '3.2%'],
      ['District 4', '$14.8B', '$148M', '$142M', '4.1%'],
    ]
  },
  Demographics: {
    columns: ['Age Group', 'Population', 'Median Income', 'Households', '% Total'],
    rows: [
      ['Under 18', '241,832', 'N/A', '—', '18.4%'],
      ['18–34', '298,441', '$52,400', '118,200', '22.7%'],
      ['35–54', '342,108', '$74,800', '156,400', '26.1%'],
      ['55+', '422,619', '$61,200', '198,300', '32.2%'],
    ]
  },
}

function getSampleData(product) {
  const domain = product.category || product.domain || ''
  for (const key of Object.keys(sampleDataByDomain)) {
    if (domain.toLowerCase().includes(key.toLowerCase())) return sampleDataByDomain[key]
  }
  return {
    columns: ['ID', 'Name', 'Category', 'Value', 'Updated'],
    rows: [
      ['001', 'Sample Record A', product.category || 'General', '$12,400', '01/15/2025'],
      ['002', 'Sample Record B', product.category || 'General', '$8,700', '01/20/2025'],
      ['003', 'Sample Record C', product.category || 'General', '$23,100', '02/01/2025'],
      ['004', 'Sample Record D', product.category || 'General', '$5,890', '02/11/2025'],
    ]
  }
}

function SampleDataPreview({ product, accessGranted, onRequestAccess }) {
  const [expanded, setExpanded] = useState(false)
  const { columns, rows } = getSampleData(product)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-gray-400" />
          <h3 className="font-semibold text-gray-900 text-sm">Sample Data Preview</h3>
          {!accessGranted && (
            <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <Lock className="h-2.5 w-2.5" /> Restricted
            </span>
          )}
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1"
        >
          {expanded ? <><EyeOff className="h-3.5 w-3.5" /> Hide</> : <><Eye className="h-3.5 w-3.5" /> Preview</>}
        </button>
      </div>

      {expanded && (
        <div className="relative overflow-auto rounded-lg border border-gray-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {columns.map(col => (
                  <th key={col} className="text-left px-3 py-2 text-gray-500 font-medium whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={`border-b border-gray-50 last:border-0 ${!accessGranted ? 'select-none' : ''}`}>
                  {row.map((cell, ci) => (
                    <td key={ci} className={`px-3 py-2 text-gray-700 ${!accessGranted ? 'blur-[5px]' : ''}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {!accessGranted && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-lg">
              <Lock className="h-6 w-6 text-gray-400 mb-2" />
              <p className="text-sm font-medium text-gray-700 mb-3">Request access to view full data</p>
              <button
                onClick={onRequestAccess}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white flex items-center gap-1.5"
                style={{ backgroundColor: DataMarket_BLUE }}
              >
                <Lock className="h-3 w-3" /> Request Access
              </button>
            </div>
          )}
        </div>
      )}

      {!expanded && (
        <p className="text-xs text-gray-400">
          {accessGranted
            ? `${rows.length} sample rows available — click Preview to explore`
            : 'Preview is blurred. Request access to unlock full dataset.'}
        </p>
      )}
    </div>
  )
}

function AccessRequestModal({ product, onClose }) {
  const { submitRequest, persona, myRequests } = usePersona()
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: persona.name, team: persona.department, reason: '', agreed: false })

  const existingRequest = myRequests.find(r => r.productId === product.id)

  if (existingRequest && !submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-amber-50">
            <Clock className="h-8 w-8 text-amber-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Request Already Submitted</h3>
          <p className="text-gray-500 text-sm mb-2">You already have a <strong>{existingRequest.status}</strong> request for <strong>{product.name}</strong>.</p>
          {existingRequest.status === 'Pending' && <p className="text-xs text-gray-400 mb-6">Switch to the Admin persona to approve it.</p>}
          <button onClick={onClose} className="w-full py-2.5 rounded-lg text-white font-medium" style={{ backgroundColor: DataMarket_BLUE }}>OK</button>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#E8F0F7' }}>
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Request Submitted</h3>
          <p className="text-gray-500 text-sm mb-2">Your access request for <strong>{product.name}</strong> is pending approval.</p>
          <p className="text-xs text-gray-400 mb-6">Switch to the <strong>Admin persona</strong> to see it in the approval queue.</p>
          <button onClick={onClose} className="w-full py-2.5 rounded-lg text-white font-medium" style={{ backgroundColor: DataMarket_BLUE }}>
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Submit Access Request</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-800">
            Requesting access to: <strong>{product.name}</strong>
          </div>
          <p className="text-xs text-gray-500">Required fields marked with *</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requesting Name *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requesting Team *</label>
            <input type="text" value={form.team} onChange={e => setForm({ ...form, team: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Request Reason *</label>
            <textarea rows={3} placeholder="Describe why you need access..." value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form.agreed} onChange={e => setForm({ ...form, agreed: e.target.checked })} className="mt-0.5" />
            <span className="text-xs text-gray-500">
              By submitting, you acknowledge that access to this data is governed by the Your Organization Data Governance Policy and will be used only for authorized purposes.
            </span>
          </label>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => { if (form.name && form.team && form.reason && form.agreed) { submitRequest(product, form); setSubmitted(true) } }}
            disabled={!form.name || !form.team || !form.reason || !form.agreed}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: DataMarket_BLUE }}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}

export function DataMarketProductDetailPage({ product, onBack }) {
  const [showModal, setShowModal] = useState(false)
  const { hasAccess, myRequests } = usePersona()
  const Icon = typeIcons[product.type] || BarChart3
  const existingRequest = myRequests.find(r => r.productId === product.id)
  const accessGranted = hasAccess(product.id)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex gap-8 flex-col lg:flex-row">
        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#E8F0F7' }}>
                <Icon className="h-7 w-7" style={{ color: DataMarket_BLUE }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">{product.name}</h1>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {product.tags.map(tag => (
                    <span key={tag} className={`text-xs px-2.5 py-1 rounded-full font-medium ${tagColors[tag] || 'bg-gray-100 text-gray-700'}`}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-gray-600 leading-relaxed">{product.description}</p>

            <div className="mt-6 flex gap-3 flex-wrap items-center">
              <button onClick={onBack} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>

              {accessGranted ? (
                <span className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Access Granted
                </span>
              ) : existingRequest?.status === 'Pending' ? (
                <span className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm font-medium text-amber-700">
                  <Clock className="h-4 w-4" /> Request Pending
                </span>
              ) : (
                <button
                  onClick={() => setShowModal(true)}
                  className="px-6 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2"
                  style={{ backgroundColor: DataMarket_BLUE }}
                >
                  <Lock className="h-4 w-4" /> Request Access
                </button>
              )}

              {accessGranted && product.type === 'Dashboard' && (
                <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" /> Open Dashboard
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Properties Panel */}
        <div className="lg:w-72 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <h3 className="font-semibold text-gray-900">Properties</h3>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <Database className="h-4 w-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Data Source Type</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{product.type}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <Tag className="h-4 w-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Tags</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {product.tags.map(tag => (
                      <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tagColors[tag] || 'bg-gray-100 text-gray-700'}`}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <RefreshCw className="h-4 w-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Refresh Frequency</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{product.refreshFrequency}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Data Source Owner</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{product.owner}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                  <Calendar className="h-4 w-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Last Updated</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{product.lastUpdated || '02/11/2025'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SampleDataPreview
        product={product}
        accessGranted={accessGranted}
        onRequestAccess={() => setShowModal(true)}
      />

      {showModal && <AccessRequestModal product={product} onClose={() => setShowModal(false)} />}
    </div>
  )
}
