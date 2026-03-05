import React, { useState } from 'react'
import { PersonaProvider } from './context/PersonaContext'
import { DataMarketLayout } from './components/layout/DataMarketLayout'
import { DataMarketHomePage } from './pages/DataMarketHomePage'
import { DataMarketCatalogPage } from './pages/DataMarketCatalogPage'
import { DataMarketProductDetailPage } from './pages/DataMarketProductDetailPage'
import { DataMarketLibraryPage } from './pages/DataMarketLibraryPage'
import { DataMarketRegisterPage } from './pages/DataMarketRegisterPage'
import { DataMarketAdminPage } from './pages/DataMarketAdminPage'

function AppInner() {
  const [currentPage, setCurrentPage] = useState('home')
  const [pageProps, setPageProps] = useState({})
  const [selectedProduct, setSelectedProduct] = useState(null)

  const navigate = (page, props = {}) => {
    setCurrentPage(page)
    setPageProps(props)
    setSelectedProduct(null)
    window.scrollTo(0, 0)
  }

  const openProduct = (product) => {
    setSelectedProduct(product)
    setCurrentPage('detail')
    window.scrollTo(0, 0)
  }

  const renderPage = () => {
    if (currentPage === 'detail' && selectedProduct) {
      return <DataMarketProductDetailPage product={selectedProduct} onBack={() => navigate('catalog')} />
    }
    switch (currentPage) {
      case 'home':       return <DataMarketHomePage onNavigate={navigate} onOpenProduct={openProduct} />
      case 'data':
      case 'catalog':    return <DataMarketCatalogPage onOpenProduct={openProduct} initialSearch={pageProps.search || ''} />
      case 'library':
      case 'my-library': return <DataMarketLibraryPage onNavigate={navigate} onOpenProduct={openProduct} />
      case 'register':   return <DataMarketRegisterPage onNavigate={navigate} />
      case 'admin':      return <DataMarketAdminPage />
      default:           return <DataMarketHomePage onNavigate={navigate} onOpenProduct={openProduct} />
    }
  }

  return (
    <DataMarketLayout currentPage={currentPage} onNavigate={navigate}>
      {renderPage()}
    </DataMarketLayout>
  )
}

function App() {
  return (
    <PersonaProvider>
      <AppInner />
    </PersonaProvider>
  )
}

export default App
