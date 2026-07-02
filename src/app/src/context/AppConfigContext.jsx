import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const defaults = {
  appName:       'DataMarket',
  appSubtitle:   'Data Discovery & Access',
  appLogoUrl:    '',
  demoMode:      true,
  genieSpaceId:  '',
  sqlWarehouseId:'',
  rfaEnabled:    false,
  setupComplete: false,
  autoDiscoverEnabled: false,
  autoDiscoverPrefix:  '',
  databricksHost: '',
}

const AppConfigContext = createContext({ ...defaults, refreshConfig: () => {} })

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState(defaults)

  const refreshConfig = useCallback(() => {
    fetch('/api/portal/config')
      .then(r => r.json())
      .then(data => setConfig({ ...defaults, ...data }))
      .catch(() => { /* keep defaults */ })
  }, [])

  useEffect(() => { refreshConfig() }, [refreshConfig])

  return (
    <AppConfigContext.Provider value={{ ...config, refreshConfig }}>
      {children}
    </AppConfigContext.Provider>
  )
}

export function useAppConfig() {
  return useContext(AppConfigContext)
}
