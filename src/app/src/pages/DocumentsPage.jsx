import React, { useState } from 'react'
import { FileText, Search, Bot, Send, Download, Calendar, User, Sparkles, BookOpen, FileQuestion } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const documents = [
  { id: 1, name: 'Vendor Master Data Dictionary', type: 'Data Dictionary', domain: 'Procurement', updated: '2024-12-15', author: 'Maria Chen', pages: 12, format: 'MD' },
  { id: 2, name: 'Budget & Expenditure Data Dictionary', type: 'Data Dictionary', domain: 'Finance', updated: '2024-12-10', author: 'James Park', pages: 18, format: 'MD' },
  { id: 3, name: 'DNA Portal User Guide', type: 'User Guide', domain: 'Platform', updated: '2024-12-20', author: 'DNA Team', pages: 24, format: 'MD' },
  { id: 4, name: 'Fraud Detection Methodology', type: 'Technical', domain: 'Analytics', updated: '2024-11-30', author: 'David Nguyen', pages: 15, format: 'PDF' },
  { id: 5, name: 'Data Classification Policy', type: 'Policy', domain: 'Governance', updated: '2024-10-15', author: 'IT Security', pages: 8, format: 'PDF' },
  { id: 6, name: 'LSBE/Prop A Certification Guide', type: 'Guide', domain: 'Procurement', updated: '2024-09-20', author: 'Diana Torres', pages: 10, format: 'PDF' },
  { id: 7, name: 'Internal Billing Procedures', type: 'Procedures', domain: 'Finance', updated: '2024-11-05', author: 'James Park', pages: 14, format: 'PDF' },
  { id: 8, name: 'eCAPS Data Integration Guide', type: 'Technical', domain: 'Platform', updated: '2024-08-25', author: 'DNA Team', pages: 22, format: 'PDF' }
]

const typeColors = {
  'Data Dictionary': 'bg-blue-100 text-blue-800',
  'User Guide': 'bg-emerald-100 text-emerald-800',
  Technical: 'bg-purple-100 text-purple-800',
  Policy: 'bg-red-100 text-red-800',
  Guide: 'bg-amber-100 text-amber-800',
  Procedures: 'bg-gray-100 text-gray-800'
}

const demoQA = [
  { question: 'What columns are in the gold_vendors table?', answer: 'The gold_vendors table contains 15 columns: vendor_id (INT), vendor_name (STRING), vendor_type (STRING), tax_id (STRING), address, city, state, zip_code, phone, is_lsbe (BOOLEAN), is_prop_a (BOOLEAN), registration_date (DATE), risk_score (DECIMAL), total_payments_ytd (DECIMAL), and contract_count (INT). Risk scores above 0.50 trigger enhanced review.' },
  { question: 'What triggers a fraud flag?', answer: 'Per the Vendor Data Dictionary, fraud flags are triggered by: (1) Payments exceeding 3x historical average, (2) Duplicate invoices via fuzzy matching, (3) PO Box-only addresses, (4) Vendors registered <30 days before first payment, (5) Split purchases under approval thresholds, and (6) Exponential YoY payment growth.' }
]

export function DocumentsPage() {
  const [search, setSearch] = useState('')
  const [qaInput, setQaInput] = useState('')
  const [qaMessages, setQaMessages] = useState(demoQA.map(q => [
    { role: 'user', content: q.question },
    { role: 'assistant', content: q.answer }
  ]).flat())

  const filtered = documents.filter(d =>
    search === '' || d.name.toLowerCase().includes(search.toLowerCase()) || d.domain.toLowerCase().includes(search.toLowerCase())
  )

  const handleAsk = () => {
    if (!qaInput.trim()) return
    setQaMessages(prev => [...prev, { role: 'user', content: qaInput }])
    const question = qaInput
    setQaInput('')
    setTimeout(() => {
      setQaMessages(prev => [...prev, {
        role: 'assistant',
        content: `This is a demo of the Knowledge Assistant (LAC_DNA_Documentation_Assistant). In production, this would search across all uploaded documentation using RAG to provide accurate, cited answers. Your question: "${question}"`
      }])
    }, 1000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Documents & Knowledge Base</h2>
        <p className="text-gray-500 mt-1">Data dictionaries, training materials, and AI-powered documentation Q&A</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search documents..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            {filtered.map(doc => (
              <Card key={doc.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-medium text-sm text-gray-900 truncate">{doc.name}</h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge className={`text-[10px] ${typeColors[doc.type] || 'bg-gray-100 text-gray-800'}`}>{doc.type}</Badge>
                          <Badge variant="outline" className="text-[10px]">{doc.domain}</Badge>
                          <span className="text-[10px] text-gray-400">{doc.format}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{doc.updated}</span>
                          <span className="flex items-center gap-1"><User className="h-3 w-3" />{doc.author}</span>
                          <span>{doc.pages} pages</span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Card className="flex flex-col" style={{ minHeight: '500px' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="h-4 w-4" style={{ color: '#003366' }} />
                Documentation Assistant
              </CardTitle>
              <CardDescription className="text-xs">Ask questions about data products, schemas, and business rules</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 space-y-3 overflow-y-auto mb-3" style={{ maxHeight: '400px' }}>
                {qaMessages.map((msg, i) => (
                  <div key={i} className={`${msg.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block max-w-[90%] rounded-lg px-3 py-2 text-xs ${
                      msg.role === 'user'
                        ? 'bg-[#003366] text-white'
                        : 'bg-gray-50 border border-gray-200 text-gray-700'
                    }`}>
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-1 mb-1">
                          <Sparkles className="h-3 w-3 text-blue-600" />
                          <span className="text-[10px] font-medium text-blue-600">Knowledge Assistant</span>
                        </div>
                      )}
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask about any document..."
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={qaInput}
                  onChange={e => setQaInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAsk()}
                />
                <Button size="sm" onClick={handleAsk} style={{ backgroundColor: '#003366' }}>
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <BookOpen className="h-4 w-4 text-purple-600 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-purple-900">Powered by Knowledge Assistant</p>
                  <p className="text-xs text-purple-700 mt-1">
                    Uses RAG over uploaded documentation in Unity Catalog Volumes to provide accurate, cited answers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
