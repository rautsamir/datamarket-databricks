import React, { useState } from 'react'
import { Bot, Send, Sparkles, Database, BarChart3, Table2, Lightbulb } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const sampleQuestions = [
  { icon: BarChart3, text: 'What are the top 5 departments by budget allocation?' },
  { icon: Database, text: 'Show me all flagged vendor payments with their reasons' },
  { icon: Table2, text: 'Which vendors have the highest risk scores?' },
  { icon: BarChart3, text: 'What is the total internal billing by service type?' },
  { icon: Database, text: 'Show budget variance by department' },
  { icon: Table2, text: 'How many certified vendors do we have?' }
]

const demoConversation = [
  {
    role: 'user',
    content: 'What are the top 5 departments by budget allocation?'
  },
  {
    role: 'assistant',
    content: 'Here are the top 5 departments by budget allocation for FY2024-25:',
    sql: `SELECT department_name, budget_allocation
FROM gold.departments
ORDER BY budget_allocation DESC
LIMIT 5`,
    results: [
      { department: 'Health Services', budget: '$5.20B' },
      { department: 'Public Safety', budget: '$3.80B' },
      { department: 'Social Services', budget: '$2.90B' },
      { department: 'Mental Health', budget: '$2.20B' },
      { department: 'Children & Family Services', budget: '$1.90B' }
    ]
  }
]

const cannedResponses = [
  {
    keywords: ['budget', 'department', 'spend', 'allocation', 'expenditure', 'variance'],
    content: 'Here\'s the budget vs. actual expenditure breakdown by department for FY2024-25:',
    sql: `SELECT department_name,
       budget_allocated,
       actual_spend,
       ROUND((actual_spend / budget_allocated) * 100, 1) AS pct_used,
       budget_allocated - actual_spend AS remaining
FROM gold.budget_summary
ORDER BY pct_used DESC`,
    results: [
      { department: 'IT Services', allocated: '$420M', actual: '$398M', pct_used: '94.8%', remaining: '$22M' },
      { department: 'Public Works', allocated: '$680M', actual: '$641M', pct_used: '94.3%', remaining: '$39M' },
      { department: 'Health Services', allocated: '$5.20B', actual: '$4.87B', pct_used: '93.7%', remaining: '$330M' },
      { department: 'Finance & Accounting', allocated: '$210M', actual: '$178M', pct_used: '84.8%', remaining: '$32M' },
      { department: 'Social Services', allocated: '$2.90B', actual: '$2.41B', pct_used: '83.1%', remaining: '$490M' }
    ]
  },
  {
    keywords: ['vendor', 'payment', 'fraud', 'flag', 'risk', 'anomaly'],
    content: 'Here are the flagged vendor payments with anomaly indicators:',
    sql: `SELECT vendor_name, payment_amount, flag_reason, risk_score
FROM gold.vendor_payments
WHERE fraud_flag = true
ORDER BY risk_score DESC
LIMIT 5`,
    results: [
      { vendor: 'Apex Consulting LLC', amount: '$284,500', flag: 'PO Box address mismatch', risk: '92' },
      { vendor: 'TechBridge Inc.', amount: '$156,000', flag: 'Duplicate invoice number', risk: '87' },
      { vendor: 'Summit Advisory', amount: '$98,750', flag: 'Weekend payment processed', risk: '74' },
      { vendor: 'NovaCorp Services', amount: '$67,200', flag: 'Vendor not in approved list', risk: '68' },
      { vendor: 'Clearview Partners', amount: '$43,800', flag: 'Split payment pattern', risk: '61' }
    ]
  },
  {
    keywords: ['payroll', 'salary', 'headcount', 'employee', 'compensation', 'staff'],
    content: 'Here\'s the payroll summary by department including headcount and average compensation:',
    sql: `SELECT department_name,
       COUNT(employee_id) AS headcount,
       SUM(annual_salary) AS total_payroll,
       AVG(annual_salary) AS avg_salary
FROM gold.employee_compensation
GROUP BY department_name
ORDER BY total_payroll DESC`,
    results: [
      { department: 'Public Safety', headcount: '12,400', total_payroll: '$1.24B', avg_salary: '$100K' },
      { department: 'Health Services', headcount: '18,200', total_payroll: '$1.18B', avg_salary: '$65K' },
      { department: 'IT Services', headcount: '2,100', total_payroll: '$294M', avg_salary: '$140K' },
      { department: 'Finance & Accounting', headcount: '1,800', total_payroll: '$198M', avg_salary: '$110K' },
      { department: 'Social Services', headcount: '8,600', total_payroll: '$516M', avg_salary: '$60K' }
    ]
  },
  {
    keywords: ['property', 'tax', 'revenue', 'assessment', 'collection'],
    content: 'Here\'s the property tax collection summary by district for FY2024:',
    sql: `SELECT district_name,
       assessed_value,
       tax_levied,
       tax_collected,
       ROUND((tax_collected / tax_levied) * 100, 1) AS collection_rate
FROM gold.property_tax_summary
ORDER BY tax_collected DESC`,
    results: [
      { district: 'Central District', assessed: '$42.1B', levied: '$421M', collected: '$408M', rate: '96.9%' },
      { district: 'West Region', assessed: '$38.7B', levied: '$387M', collected: '$371M', rate: '95.9%' },
      { district: 'North County', assessed: '$29.4B', levied: '$294M', collected: '$279M', rate: '94.9%' },
      { district: 'South Region', assessed: '$24.8B', levied: '$248M', collected: '$231M', rate: '93.1%' },
      { district: 'East District', assessed: '$18.2B', levied: '$182M', collected: '$167M', rate: '91.8%' }
    ]
  }
]

function getAIResponse(question) {
  const q = question.toLowerCase()
  for (const r of cannedResponses) {
    if (r.keywords.some(k => q.includes(k))) return r
  }
  return {
    content: 'I found several data products related to your query. In a live deployment, Databricks Genie executes this as SQL against your Gold layer tables in real time.',
    sql: `-- Genie translates your question into SQL automatically
-- Example: "${question}"
SELECT * FROM gold.relevant_table
WHERE conditions_match_your_query
LIMIT 20`,
    results: null
  }
}

export function AIExplorerPage({ initialQuestion = '' }) {
  const [messages, setMessages] = useState(() => {
    if (initialQuestion) {
      const response = getAIResponse(initialQuestion)
      return [
        ...demoConversation,
        { role: 'user', content: initialQuestion },
        { role: 'assistant', ...response }
      ]
    }
    return demoConversation
  })
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)

  const handleSend = () => {
    if (!input.trim()) return
    const userMsg = { role: 'user', content: input }
    const question = input
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsThinking(true)

    setTimeout(() => {
      const response = getAIResponse(question)
      setMessages(prev => [...prev, { role: 'assistant', ...response }])
      setIsThinking(false)
    }, 1500)
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#003366' }}>
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">AI Explorer</h2>
            <p className="text-gray-500">Ask questions about your data in natural language — powered by Databricks Genie</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 space-y-4">
          <Card className="min-h-[500px] flex flex-col">
            <CardContent className="flex-1 p-4 space-y-4 overflow-y-auto">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
                    msg.role === 'user' 
                      ? 'bg-[#003366] text-white' 
                      : 'bg-gray-50 border border-gray-200'
                  }`}>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        <span className="text-xs font-medium text-blue-600">Genie AI</span>
                      </div>
                    )}
                    <p className={`text-sm ${msg.role === 'user' ? 'text-white' : 'text-gray-800'}`}>
                      {msg.content}
                    </p>
                    {msg.sql && (
                      <div className="mt-3 bg-gray-900 rounded-lg p-3 overflow-x-auto">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="bg-blue-600 text-white text-[10px]">SQL</Badge>
                        </div>
                        <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">{msg.sql}</pre>
                      </div>
                    )}
                    {msg.results && (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-300">
                              {Object.keys(msg.results[0]).map(k => (
                                <th key={k} className="text-left py-2 px-3 font-medium text-gray-500 capitalize">{k}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {msg.results.map((row, ri) => (
                              <tr key={ri} className="border-b border-gray-100">
                                {Object.values(row).map((v, vi) => (
                                  <td key={vi} className="py-2 px-3 text-gray-700">{v}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-gray-500">Genie is thinking...</span>
                  </div>
                </div>
              )}
            </CardContent>

            <div className="border-t p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask a question about your data..."
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
                <Button onClick={handleSend} style={{ backgroundColor: '#003366' }}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Try asking...
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sampleQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q.text)}
                  className="w-full text-left p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-colors group"
                >
                  <div className="flex items-start gap-2">
                    <q.icon className="h-3.5 w-3.5 text-gray-400 mt-0.5 group-hover:text-blue-500" />
                    <span className="text-xs text-gray-600 group-hover:text-gray-900">{q.text}</span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-blue-900">Powered by Databricks Genie</p>
                  <p className="text-xs text-blue-700 mt-1">
                    AI Explorer translates natural language into SQL queries against your Gold layer tables — budgets, vendors, payments, and more.
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
