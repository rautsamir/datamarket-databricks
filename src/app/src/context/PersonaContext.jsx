import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export const personas = {
  richard: {
    id: 'richard',
    name: 'Richard',
    fullName: 'Richard Chen',
    email: 'richard.chen@lacounty.gov',
    role: 'Data Analyst',
    department: 'Auditor-Controller',
    avatar: 'RC',
    color: '#3B82F6',
    approvedProductRefs: ['DP-001', 'DP-007'],
    description: 'Analyst — limited access, can browse and request'
  },
  james: {
    id: 'james',
    name: 'James',
    fullName: 'James Park',
    email: 'james.park@lacounty.gov',
    role: 'Finance Manager',
    department: 'Budget & Finance',
    avatar: 'JP',
    color: '#10B981',
    approvedProductRefs: ['DP-001', 'DP-002', 'DP-003', 'DP-007', 'DP-010'],
    description: 'Finance Manager — pre-approved for financial data'
  },
  admin: {
    id: 'admin',
    name: 'Admin',
    fullName: 'Data Steward',
    email: 'datasteward@lacounty.gov',
    role: 'Data Steward',
    department: 'LACES Platform Team',
    avatar: 'DS',
    color: '#8B5CF6',
    approvedProductRefs: 'all',
    description: 'Data Steward — full access + approval authority'
  }
}

const PersonaContext = createContext(null)

export function PersonaProvider({ children }) {
  const [currentPersona, setCurrentPersona] = useState('richard')
  const [requests, setRequests] = useState([])
  const [products, setProducts] = useState([])
  const [library, setLibrary] = useState([])
  const [loading, setLoading] = useState(false)
  const [apiAvailable, setApiAvailable] = useState(false)

  const persona = personas[currentPersona]

  // ── Check if real API is available ────────────────────────────────────────
  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(data => {
        const lakebaseOk = data.lakebase === 'connected'
        setApiAvailable(lakebaseOk)
        if (!lakebaseOk) console.info('[PersonaContext] Lakebase not connected, using demo data')
      })
      .catch(() => setApiAvailable(false))
  }, [])

  // ── Load from API or fall back to local seed ──────────────────────────────
  const loadProducts = useCallback(async () => {
    if (!apiAvailable) return
    try {
      const r = await fetch('/api/portal/products')
      if (r.ok) setProducts(await r.json())
    } catch (e) { console.warn('products load failed', e) }
  }, [apiAvailable])

  const loadRequests = useCallback(async () => {
    if (!apiAvailable) return
    try {
      const r = await fetch('/api/portal/requests')
      if (r.ok) setRequests(await r.json())
    } catch (e) { console.warn('requests load failed', e) }
  }, [apiAvailable])

  const loadLibrary = useCallback(async () => {
    if (!apiAvailable) return
    try {
      const r = await fetch(`/api/portal/library?email=${encodeURIComponent(persona.email)}`)
      if (r.ok) setLibrary(await r.json())
    } catch (e) { console.warn('library load failed', e) }
  }, [apiAvailable, persona.email])

  useEffect(() => {
    if (apiAvailable) {
      loadProducts()
      loadRequests()
      loadLibrary()
    }
  }, [apiAvailable, loadProducts, loadRequests, loadLibrary])

  useEffect(() => { if (apiAvailable) loadLibrary() }, [currentPersona, apiAvailable, loadLibrary])

  // ── Mutations ─────────────────────────────────────────────────────────────
  const submitRequest = async (product, form) => {
    const productRef = product.product_ref || `DP-${String(product.id).padStart(3, '0')}`
    if (apiAvailable) {
      try {
        const r = await fetch('/api/portal/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productRef,
            requesterEmail: persona.email,
            team: form.team || persona.department,
            reason: form.reason,
            accessLevel: 'Read Only'
          })
        })
        if (r.ok) {
          await loadRequests()
          return await r.json()
        }
      } catch (e) { console.warn('submitRequest API failed, falling back', e) }
    }
    // Optimistic local fallback
    const newReq = {
      request_ref: `REQ-${String(requests.length + 1).padStart(3, '0')}`,
      product_ref: productRef,
      product_name: product.display_name || product.name,
      requester_email: persona.email,
      requester_name: persona.fullName,
      requester_team: form.team || persona.department,
      business_reason: form.reason,
      status: 'Pending',
      requested_at: new Date().toISOString(),
      access_level: 'Read Only',
      _local: true
    }
    setRequests(prev => [newReq, ...prev])
    return newReq
  }

  const approveRequest = async (reqRef) => {
    if (apiAvailable) {
      try {
        await fetch(`/api/portal/requests/${reqRef}/approve`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminEmail: persona.email })
        })
        await loadRequests()
        return
      } catch (e) { console.warn('approveRequest API failed', e) }
    }
    setRequests(prev => prev.map(r =>
      (r.request_ref === reqRef || r.id === reqRef)
        ? { ...r, status: 'Approved', resolved_at: new Date().toISOString() }
        : r
    ))
  }

  const denyRequest = async (reqRef, reason = '') => {
    if (apiAvailable) {
      try {
        await fetch(`/api/portal/requests/${reqRef}/deny`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminEmail: persona.email, reason })
        })
        await loadRequests()
        return
      } catch (e) { console.warn('denyRequest API failed', e) }
    }
    setRequests(prev => prev.map(r =>
      (r.request_ref === reqRef || r.id === reqRef)
        ? { ...r, status: 'Denied', resolved_at: new Date().toISOString(), denial_reason: reason }
        : r
    ))
  }

  // ── Access check ──────────────────────────────────────────────────────────
  const hasAccess = (productRef) => {
    if (persona.approvedProductRefs === 'all') return true
    const refStr = typeof productRef === 'number'
      ? `DP-${String(productRef).padStart(3, '0')}`
      : productRef
    if (persona.approvedProductRefs.includes(refStr)) return true
    // Check approved requests
    return requests.some(r =>
      (r.product_ref === refStr || r.productRef === refStr) &&
      (r.requester_email === persona.email || r.requestedBy === currentPersona) &&
      r.status === 'Approved'
    )
  }

  const myRequests = requests.filter(r =>
    r.requester_email === persona.email || r.requestedBy === currentPersona)
  const pendingRequests = requests.filter(r => r.status === 'Pending')

  return (
    <PersonaContext.Provider value={{
      currentPersona,
      setCurrentPersona,
      persona,
      requests,
      myRequests,
      pendingRequests,
      products,
      library,
      loading,
      apiAvailable,
      submitRequest,
      approveRequest,
      denyRequest,
      hasAccess,
      refreshRequests: loadRequests,
      refreshLibrary: loadLibrary
    }}>
      {children}
    </PersonaContext.Provider>
  )
}

export function usePersona() {
  const ctx = useContext(PersonaContext)
  if (!ctx) throw new Error('usePersona must be used within PersonaProvider')
  return ctx
}
