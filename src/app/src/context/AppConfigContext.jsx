import { createContext, useContext, useEffect, useState } from 'react'

const defaults = {
  appName:    'DataMarket',
  appSubtitle: 'Data Discovery & Access',
  appLogoUrl: '/la-county-seal.png',
  demoMode:   true,
}

const AppConfigContext = createContext(defaults)

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState(defaults)

  useEffect(() => {
    fetch('/api/portal/config')
      .then(r => r.json())
      .then(data => setConfig({ ...defaults, ...data }))
      .catch(() => { /* keep defaults */ })
  }, [])

  return (
    <AppConfigContext.Provider value={config}>
      {children}
    </AppConfigContext.Provider>
  )
}

export function useAppConfig() {
  return useContext(AppConfigContext)
}
