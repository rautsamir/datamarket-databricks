import React, { useState } from 'react'
import { PersonaProvider } from './context/PersonaContext'
import { LACESLayout } from './components/layout/LACESLayout'
import { LACESHomePage } from './pages/LACESHomePage'
import { LACESCatalogPage } from './pages/LACESCatalogPage'
import { LACESProductDetailPage } from './pages/LACESProductDetailPage'
import { LACESLibraryPage } from './pages/LACESLibraryPage'
import { LACESRegisterPage } from './pages/LACESRegisterPage'
import { LACESAdminPage } from './pages/LACESAdminPage'

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
      return <LACESProductDetailPage product={selectedProduct} onBack={() => navigate('catalog')} />
    }
    switch (currentPage) {
      case 'home':       return <LACESHomePage onNavigate={navigate} onOpenProduct={openProduct} />
      case 'data':
      case 'catalog':    return <LACESCatalogPage onOpenProduct={openProduct} initialSearch={pageProps.search || ''} />
      case 'library':
      case 'my-library': return <LACESLibraryPage onNavigate={navigate} onOpenProduct={openProduct} />
      case 'register':   return <LACESRegisterPage onNavigate={navigate} />
      case 'admin':      return <LACESAdminPage />
      default:           return <LACESHomePage onNavigate={navigate} onOpenProduct={openProduct} />
    }
  }

  return (
    <LACESLayout currentPage={currentPage} onNavigate={navigate}>
      {renderPage()}
    </LACESLayout>
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
