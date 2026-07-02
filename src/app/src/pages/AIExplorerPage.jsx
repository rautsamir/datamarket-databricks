import React, { useState, useRef, useEffect } from 'react'
import { Bot, Send, Sparkles, Database, BarChart3, FileText, Lightbulb, RotateCcw, Search, ExternalLink, Tag, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAppConfig } from '@/context/AppConfigContext'

const TYPE_ICONS = { Dashboard: BarChart3, Report: FileText, Dataset: Database }
const DataMarket_BLUE = '#003865'

const SAMPLE_QUESTIONS = [
  'What financial data do we have?',
  'Show me datasets related to HR or employees',
  'What data is available about operations?',
  'Do we have any real-time or daily refreshed data?',
  'What datasets can I use for budget analysis?',
  'Show me all AI or ML-related data products',
]

// Thin fallback used only when FMAPI call fails
function fallbackMatches(question, demoMode) {
  if (!demoMode) return null
  return null // production: show error state, don't fake it
}

export function AIExplorerPage({ initialQuestion = '', onNavigate, onOpenProduct }) {
  const { demoMode } = useAppConfig()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const initialSent = useRef(false)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const sendQuestion = async (question) => {
    if (!question.trim() || loading) return
    const q = question.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)

    try {
      const r = await fetch('/api/portal/ask-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'API error')

      if (data.matches?.length > 0) {
        setMessages(prev => [...prev, { role: 'assistant', type: 'products', matches: data.matches, question: q }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant', type: 'empty', question: q,
          content: `No data products matched "${q}". Try browsing the full catalog or refining your search.`
        }])
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant', type: 'error',
        content: `Couldn't reach the catalog search service. ${e.message}`
      }])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialQuestion && !initialSent.current) {
      initialSent.current = true
      setTimeout(() => sendQuestion(initialQuestion), 200)
    }
  }, [initialQuestion])

  const openProduct = async (ref, name) => {
    try {
      const res = await fetch('/api/portal/products?includeAll=true')
      const products = await res.json()
      const p = products.find(x => x.product_ref === ref || x.display_name === name)
      if (p && onOpenProduct) {
        onOpenProduct({
          id: p.product_id, product_ref: p.product_ref, ref: p.product_ref,
          name: p.display_name, description: p.description, type: p.type,
          source: p.source_system, tags: Array.isArray(p.tags) ? p.tags : [],
          refreshFrequency: p.refresh_frequency, owner: p.owner_email,
          classification: p.classification, uc_full_name: p.uc_full_name,
          ucFullName: p.uc_full_name,
        })
        return
      }
    } catch (_) {}
    onNavigate?.('discover', { search: name })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: DataMarket_BLUE }}>
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI Explorer</h2>
          <p className="text-gray-500 text-sm">Find data products using natural language — powered by Databricks Foundation Models</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

        {/* ── Chat panel ── */}
        <div className="xl:col-span-3">
          <Card className="flex flex-col min-h-[520px]">
            <CardContent className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[520px]">

              {messages.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50">
                    <Search className="h-7 w-7 text-blue-500" />
                  </div>
                  <p className="font-semibold text-gray-800">What data are you looking for?</p>
                  <p className="text-sm text-gray-400 max-w-xs">Describe your use case or ask about a topic — I'll find the most relevant data products in your catalog.</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'user' ? (
                    <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white" style={{ backgroundColor: DataMarket_BLUE }}>
                      {msg.content}
                    </div>
                  ) : (
                    <div className="max-w-[90%] w-full space-y-3">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-xs font-medium text-blue-600">Catalog AI</span>
                      </div>

                      {msg.type === 'products' && (
                        <>
                          <p className="text-sm text-gray-600">
                            Found <span className="font-semibold text-gray-900">{msg.matches.length} data product{msg.matches.length > 1 ? 's' : ''}</span> relevant to <span className="italic">"{msg.question}"</span>:
                          </p>
                          <div className="space-y-2">
                            {msg.matches.map((m, mi) => {
                              const Icon = TYPE_ICONS[m.type] || Database
                              return (
                                <div key={mi} className="bg-white border border-gray-200 rounded-xl p-3.5 hover:border-blue-200 hover:shadow-sm transition-all">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: '#EFF6FF' }}>
                                        <Icon className="h-4 w-4" style={{ color: DataMarket_BLUE }} />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-semibold text-sm text-gray-900">{m.name}</span>
                                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{m.domain}</span>
                                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{m.type}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{m.reason}</p>
                                        {m.tags?.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-1.5">
                                            {m.tags.slice(0, 4).map(t => (
                                              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 border border-gray-100 text-gray-500 flex items-center gap-0.5">
                                                <Tag className="h-2 w-2" />{t}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => openProduct(m.ref, m.name)}
                                      className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors hover:opacity-90"
                                      style={{ backgroundColor: DataMarket_BLUE }}
                                    >
                                      View <ArrowRight className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => onNavigate?.('discover')}
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" /> Browse full catalog
                            </button>
                          </div>
                        </>
                      )}

                      {(msg.type === 'empty' || msg.type === 'error') && (
                        <div className={`rounded-xl p-3.5 text-sm ${msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-gray-50 text-gray-600 border border-gray-100'}`}>
                          <p>{msg.content}</p>
                          {msg.type === 'empty' && (
                            <button onClick={() => onNavigate?.('discover')}
                              className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" /> Browse full catalog
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1">
                      {[0, 150, 300].map(d => (
                        <div key={d} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">Searching catalog...</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </CardContent>

            <div className="border-t p-4">
              <div className="flex gap-2">
                <input ref={inputRef} type="text"
                  placeholder="What data are you looking for?"
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendQuestion(input)}
                />
                <Button onClick={() => sendQuestion(input)} disabled={loading || !input.trim()} style={{ backgroundColor: DataMarket_BLUE }}>
                  <Send className="h-4 w-4" />
                </Button>
                {messages.length > 0 && (
                  <Button variant="outline" onClick={() => { setMessages([]); setInput('') }} title="Clear conversation">
                    <RotateCcw className="h-4 w-4 text-gray-500" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" /> Try asking...
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {SAMPLE_QUESTIONS.map((q, i) => (
                <button key={i} onClick={() => sendQuestion(q)}
                  className="w-full text-left p-2.5 rounded-lg border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-colors group">
                  <span className="text-xs text-gray-600 group-hover:text-blue-800 leading-snug">{q}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-blue-900">Powered by Databricks FMAPI</p>
                  <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                    Describes your use case in plain language and finds matching data products from your catalog. No SQL, no warehouse required.
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
