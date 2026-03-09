import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Menu, 
  Bell, 
  Search, 
  RefreshCw,
  Settings,
  User,
  LogOut,
  X,
  Activity
} from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DatabricksLogo } from '../DatabricksLogo'

// Import centralized navigation configuration
import { 
  primaryNavigation, 
  secondaryNavigation, 
  isNavigationItemActive 
} from '../../config/navigation'

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Improved ResponsiveLayout Component
 * 
 * Key Improvements:
 * - Uses centralized navigation configuration
 * - Better prop types and documentation
 * - Consistent navigation state handling
 * - Cleaner component structure
 * - Accessibility improvements
 * - Enhanced mobile header with actions
 * - Desktop header with feature parity
 * - Permissions-based navigation filtering
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content to render
 * @param {Function} props.onRefreshData - Callback for refresh action
 * @param {string} props.currentPage - Current active page identifier
 * @param {Function} props.onNavigate - Navigation callback function
 * @param {string[]} props.userPermissions - User permissions for navigation filtering
 */
export function ImprovedResponsiveLayout({ 
  children, 
  onRefreshData, 
  currentPage = 'overview', 
  onNavigate,
  userPermissions = [] 
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Filter navigation items based on user permissions
  const filteredPrimaryNav = primaryNavigation.filter(item => 
    !item.permissions || item.permissions.some(permission => userPermissions.includes(permission))
  )
  
  const filteredSecondaryNav = secondaryNavigation.filter(item => 
    !item.permissions || item.permissions.some(permission => userPermissions.includes(permission))
  )

  const handleNavigate = (href) => {
    onNavigate(href)
    setSidebarOpen(false)
  }

  const renderNavigationItem = (item, isMobile = false) => (
    <li key={item.id}>
      <button
        onClick={() => handleNavigate(item.href)}
        disabled={item.disabled}
        className={classNames(
          isNavigationItemActive(currentPage, item.href)
            ? 'bg-gray-50 text-primary'
            : 'text-gray-700 hover:bg-gray-50 hover:text-primary',
          'group flex gap-x-3 rounded-md p-2 text-sm font-semibold items-center w-full text-left',
          item.disabled ? 'opacity-50 cursor-not-allowed' : ''
        )}
        aria-current={isNavigationItemActive(currentPage, item.href) ? 'page' : undefined}
        title={item.description}
      >
        <item.icon
          className={classNames(
            isNavigationItemActive(currentPage, item.href) 
              ? 'text-primary' 
              : 'text-gray-400 group-hover:text-primary',
            'h-6 w-6 shrink-0'
          )}
          aria-hidden="true"
        />
        <span className="flex-1">{item.name}</span>
        {item.badge && (
          <Badge variant="secondary" className="text-xs">
            {item.badge}
          </Badge>
        )}
      </button>
    </li>
  )

  return (
    <div className="h-full">
      {/* Mobile sidebar dialog */}
      {sidebarOpen && (
        <div className="relative z-50 lg:hidden" role="dialog" aria-modal="true">
          <div 
            className="fixed inset-0 bg-gray-900/80" 
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 flex">
            <div className="relative mr-16 flex w-full max-w-xs flex-1 transform bg-white">
              {/* Close button */}
              <div className="absolute top-0 left-full flex w-16 justify-center pt-5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(false)}
                  className="text-white hover:text-white hover:bg-white/10"
                  aria-label="Close sidebar"
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>

              {/* Sidebar content */}
              <div className="flex grow flex-col gap-y-5 overflow-y-auto px-6 pb-2">
                <div className="flex h-16 shrink-0 items-center">
                  <DatabricksLogo variant="full" size="md" />
                </div>
                <nav className="flex flex-1 flex-col" aria-label="Main navigation">
                  <ul className="flex flex-1 flex-col gap-y-7">
                    <li>
                      <ul className="-mx-2 space-y-1">
                        {filteredPrimaryNav.map(item => renderNavigationItem(item, true))}
                      </ul>
                    </li>
                    
                    {filteredSecondaryNav.length > 0 && (
                      <li>
                        <div className="text-xs font-semibold text-gray-400 mb-2">
                          ADMINISTRATION
                        </div>
                        <ul className="-mx-2 space-y-1">
                          {filteredSecondaryNav.map(item => renderNavigationItem(item, true))}
                        </ul>
                      </li>
                    )}
                  </ul>
                </nav>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Static sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-white px-6">
          <div className="flex h-16 shrink-0 items-center">
            <DatabricksLogo variant="full" size="md" />
          </div>
          <nav className="flex flex-1 flex-col" aria-label="Main navigation">
            <ul className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul className="-mx-2 space-y-1">
                  {filteredPrimaryNav.map(item => renderNavigationItem(item))}
                </ul>
              </li>
              
              {filteredSecondaryNav.length > 0 && (
                <li>
                  <div className="text-xs font-semibold text-gray-400 mb-2">
                    ADMINISTRATION
                  </div>
                  <ul className="-mx-2 space-y-1">
                    {filteredSecondaryNav.map(item => renderNavigationItem(item))}
                  </ul>
                </li>
              )}
              
              <li className="-mx-6 mt-auto">
                <div className="flex items-center gap-x-4 px-6 py-3 text-sm font-semibold text-gray-900 border-t border-border">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-databricks-emerald rounded-full animate-pulse"></div>
                    <span className="text-sm text-muted-foreground">DNA Platform</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <Activity className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:block sticky top-0 z-40 bg-white border-b border-border lg:pl-72">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-gray-900 capitalize">
              {currentPage || 'Dashboard'}
            </h1>
          </div>
          
          {/* Desktop actions */}
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <span>Search</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefreshData}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </Button>
            <Button variant="outline" size="sm" className="relative">
              <Bell className="h-4 w-4" />
              <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 text-xs rounded-full p-0 flex items-center justify-center">
                3
              </Badge>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span>County Analyst</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">County Analyst</p>
                    <p className="text-xs text-muted-foreground">analyst@example.org</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Mobile header */}
      <div className="sticky top-0 z-40 flex items-center gap-x-4 bg-white px-4 py-3 shadow-sm border-b border-border sm:gap-x-6 sm:px-6 lg:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(true)}
          className="text-gray-700 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-6 w-6" />
        </Button>
        <div className="flex-1 text-sm font-semibold text-gray-900 capitalize">
          {currentPage || 'Dashboard'}
        </div>
        
        {/* Mobile actions */}
        <div className="flex items-center gap-x-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0" aria-label="Notifications">
            <Bell className="h-4 w-4" />
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 text-xs rounded-full p-0 flex items-center justify-center">
              3
            </Badge>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full bg-primary p-0" aria-label="User menu">
                <User className="h-4 w-4 text-primary-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">County Analyst</p>
                  <p className="text-xs text-muted-foreground">analyst@example.org</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main content */}
      <main className="py-6 lg:pl-72" role="main">
        <div className="px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}