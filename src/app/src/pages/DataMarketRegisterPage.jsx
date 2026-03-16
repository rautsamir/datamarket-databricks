import React, { useState } from 'react'
import { CheckCircle2, ChevronRight, Users, Lock, Eye, X, Plus, Loader2 } from 'lucide-react'
import { usePersona } from '../context/PersonaContext'

const DataMarket_BLUE = '#003865'

const steps = [
  { id: 1, label: 'Data Product Overview' },
  { id: 2, label: 'Usage' },
  { id: 3, label: 'Key Roles' },
  { id: 4, label: 'Security & Compliance' },
  { id: 5, label: 'Review' },
]

const sourceOptions = ['ERP', 'HRIS', 'Property Tax', 'GIS', 'Demographics', 'Health Services', 'IT', 'Audit', 'Payroll', 'Other']
const tagOptions = ['Budget', 'Financial', 'ERP', 'Payroll', 'HR', 'Property Tax', 'Revenue', 'HRIS', 'Demographics', 'Audit', 'GIS', 'Health Services']
const classificationOptions = ['Public', 'Internal', 'Confidential', 'Restricted']
const accessLevelOptions = ['Read Only', 'Read + Export', 'Read + Write', 'Admin']

export function DataMarketRegisterPage({ onNavigate }) {
  const { persona } = usePersona()
  const [currentStep, setCurrentStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'Dashboard',
    source: '',
    tags: [],
    refreshFrequency: 'Daily',
    usageDescription: '',
    useCases: '',
    sla: '',
    dataOwner: '',
    steward: '',
    contributors: [],
    classification: 'Internal',
    accessLevel: 'Read Only',
    hasPII: false,
    retentionYears: '7',
  })

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }))
  const toggleTag = tag => setForm(prev => ({
    ...prev,
    tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
  }))

  if (submitted) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: '#E8F0F7' }}>
          <CheckCircle2 className="h-10 w-10" style={{ color: DataMarket_BLUE }} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Data Product Registered</h2>
        <p className="text-gray-500 max-w-md mx-auto mb-8">
          <strong>{form.name || 'Your data product'}</strong> has been submitted for review. It will appear in the catalog once approved by the data governance team.
        </p>
        <div className="flex justify-center gap-3">
          <button onClick={() => onNavigate('catalog')} className="px-6 py-2.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: DataMarket_BLUE }}>
            Browse Catalog
          </button>
          <button onClick={() => { setSubmitted(false); setCurrentStep(1); setForm({ name: '', description: '', type: 'Dashboard', source: '', tags: [], refreshFrequency: 'Daily', usageDescription: '', useCases: '', sla: '', dataOwner: '', steward: '', contributors: [], classification: 'Internal', accessLevel: 'Read Only', hasPII: false, retentionYears: '7' }) }} className="px-6 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            Register Another
          </button>
        </div>
      </div>
    )
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-5">
            <p className="text-xs text-gray-500">Required fields marked with *</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                placeholder="Example Product Name"
                value={form.name}
                onChange={e => updateForm('name', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea
                rows={4}
                placeholder="Describe what this data product contains and its business purpose..."
                value={form.description}
                onChange={e => updateForm('description', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Data Product Type *</label>
              <div className="flex gap-3">
                {['Source', 'Dashboard', 'Dataset', 'Report'].map(t => (
                  <button
                    key={t}
                    onClick={() => updateForm('type', t)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${form.type === t ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    style={form.type === t ? { backgroundColor: DataMarket_BLUE } : {}}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source System</label>
              <select
                value={form.source}
                onChange={e => updateForm('source', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select source system...</option>
                {sourceOptions.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {tagOptions.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${form.tags.includes(tag) ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    style={form.tags.includes(tag) ? { backgroundColor: DataMarket_BLUE } : {}}
                  >
                    {form.tags.includes(tag) && <X className="h-3 w-3 inline mr-1" />}{tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      case 2:
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usage Description *</label>
              <textarea rows={4} placeholder="How will this data product be used?" value={form.usageDescription} onChange={e => updateForm('usageDescription', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Known Use Cases</label>
              <textarea rows={3} placeholder="List specific use cases or reports that consume this data..." value={form.useCases} onChange={e => updateForm('useCases', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Refresh Frequency *</label>
              <select value={form.refreshFrequency} onChange={e => updateForm('refreshFrequency', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['Real-time', 'Hourly', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual'].map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SLA / Availability Requirements</label>
              <input type="text" placeholder="e.g. Available by 8am on business days" value={form.sla} onChange={e => updateForm('sla', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        )
      case 3:
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Owner *</label>
              <input type="text" placeholder="e.g. james.park@example.org" value={form.dataOwner} onChange={e => updateForm('dataOwner', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">Accountable for data quality and governance</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Steward</label>
              <input type="text" placeholder="e.g. sarah.kim@example.org" value={form.steward} onChange={e => updateForm('steward', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">Day-to-day management and quality monitoring</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" /> Contributors
              </label>
              <div className="flex gap-2">
                <input type="text" placeholder="Add contributor email..." id="contrib-input" className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.target.value) {
                      updateForm('contributors', [...form.contributors, e.target.value])
                      e.target.value = ''
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.getElementById('contrib-input')
                    if (input.value) { updateForm('contributors', [...form.contributors, input.value]); input.value = '' }
                  }}
                  className="p-2.5 rounded-lg text-white"
                  style={{ backgroundColor: DataMarket_BLUE }}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {form.contributors.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.contributors.map((c, i) => (
                    <span key={i} className="flex items-center gap-1.5 bg-blue-50 text-blue-800 px-2.5 py-1 rounded-full text-xs">
                      {c}
                      <button onClick={() => updateForm('contributors', form.contributors.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      case 4:
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Lock className="h-4 w-4" /> Data Classification *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {classificationOptions.map(c => (
                  <button
                    key={c}
                    onClick={() => updateForm('classification', c)}
                    className={`px-4 py-3 rounded-lg text-sm font-medium border-2 text-left transition-colors ${form.classification === c ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    style={form.classification === c ? { backgroundColor: DataMarket_BLUE } : {}}
                  >
                    {c === 'Public' && '🌐 '}
                    {c === 'Internal' && '🔒 '}
                    {c === 'Confidential' && '🔐 '}
                    {c === 'Restricted' && '⛔ '}
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Eye className="h-4 w-4" /> Default Access Level
              </label>
              <select value={form.accessLevel} onChange={e => updateForm('accessLevel', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {accessLevelOptions.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">Contains PII (Personally Identifiable Information)</p>
                <p className="text-xs text-gray-500 mt-0.5">Names, SSNs, addresses, or other personal data</p>
              </div>
              <button
                onClick={() => updateForm('hasPII', !form.hasPII)}
                className={`w-11 h-6 rounded-full transition-colors relative ${form.hasPII ? '' : 'bg-gray-200'}`}
                style={form.hasPII ? { backgroundColor: DataMarket_BLUE } : {}}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.hasPII ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Retention (years)</label>
              <select value={form.retentionYears} onChange={e => updateForm('retentionYears', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['1', '3', '5', '7', '10', 'Permanent'].map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
          </div>
        )
      case 5:
        return (
          <div className="space-y-5">
            <div className="bg-blue-50 rounded-xl p-5 space-y-4">
              <h4 className="font-semibold text-gray-900">Review Your Submission</h4>
              {[
                { label: 'Name', value: form.name || '—' },
                { label: 'Type', value: form.type },
                { label: 'Source', value: form.source || '—' },
                { label: 'Tags', value: form.tags.join(', ') || '—' },
                { label: 'Refresh Frequency', value: form.refreshFrequency },
                { label: 'Data Owner', value: form.dataOwner || '—' },
                { label: 'Classification', value: form.classification },
                { label: 'Access Level', value: form.accessLevel },
                { label: 'Contains PII', value: form.hasPII ? 'Yes' : 'No' },
                { label: 'Retention', value: `${form.retentionYears} years` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm border-b border-blue-100 pb-2">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-900 text-right max-w-[60%]">{value}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              By submitting, this data product will be queued for review by the DataMarket Data Governance team. 
              It will appear in the catalog once approved and will be governed by Unity Catalog RBAC.
            </p>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Register Data</h1>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {steps.map((step, i) => (
          <React.Fragment key={step.id}>
            <button
              onClick={() => step.id < currentStep && setCurrentStep(step.id)}
              className={`flex items-center gap-2 shrink-0 ${step.id < currentStep ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step.id < currentStep ? 'bg-emerald-500 text-white'
                  : step.id === currentStep ? 'text-white'
                  : 'bg-gray-100 text-gray-400'
                }`}
                style={step.id === currentStep ? { backgroundColor: DataMarket_BLUE } : {}}
              >
                {step.id < currentStep ? <CheckCircle2 className="h-4 w-4" /> : step.id}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap hidden sm:block ${step.id === currentStep ? 'text-gray-900' : step.id < currentStep ? 'text-emerald-600' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <ChevronRight className={`h-4 w-4 shrink-0 ${step.id < currentStep ? 'text-emerald-400' : 'text-gray-300'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">
          Step {currentStep}: {steps[currentStep - 1].label}
        </h2>
        {renderStep()}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        {submitError && (
          <p className="text-sm text-red-600 mb-2">{submitError}</p>
        )}
        <div className="flex gap-2">
          <button onClick={() => onNavigate('catalog')} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            Discard Draft
          </button>
          <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Save and Exit
          </button>
        </div>
        <div className="flex gap-2">
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep(s => s - 1)}
              className="px-5 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
          )}
          {currentStep < 5 ? (
            <button
              onClick={() => setCurrentStep(s => s + 1)}
              className="px-6 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: DataMarket_BLUE }}
            >
              Next
            </button>
          ) : (
            <button
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true)
                setSubmitError(null)
                try {
                  const res = await fetch('/api/portal/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: form.name,
                      description: form.description,
                      type: form.type,
                      source: form.source,
                      tags: form.tags,
                      refreshFrequency: form.refreshFrequency,
                      ownerEmail: form.dataOwner || persona.email,
                      classification: form.classification,
                      domain: form.source,
                      hasPII: form.hasPII,
                      submittedBy: persona.email
                    })
                  })
                  if (!res.ok) throw new Error(await res.text())
                  setSubmitted(true)
                } catch (e) {
                  setSubmitError('Submission failed — please try again.')
                  console.error(e)
                } finally {
                  setSubmitting(false)
                }
              }}
              className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: DataMarket_BLUE }}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit for Review
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
