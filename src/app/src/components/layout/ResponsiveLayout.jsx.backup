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
  BarChart3, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Database,
  Activity,
  PieChart,
  LineChart,
  Target
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

export function ResponsiveLayout({ children, onRefreshData, currentPage, onNavigate }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="h-full">
      {/* Mobile sidebar dialog */}
      {sidebarOpen && (
        <div className="relative z-50 lg:hidden">
          <div className="fixed inset-0 bg-gray-900/80" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-0 flex">
            <div className="relative mr-16 flex w-full max-w-xs flex-1 transform bg-white">
              {/* Close button */}
              <div className="absolute top-0 left-full flex w-16 justify-center pt-5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(false)}
                  className="text-white hover:text-white hover:bg-white/10"
                >
                  <span className="sr-only">Close sidebar</span>
                  <X className="h-6 w-6" />
                </Button>
              </div>

              {/* Sidebar content */}
              <div className="flex grow flex-col gap-y-5 overflow-y-auto px-6 pb-2">
                <div className="flex h-16 shrink-0 items-center">
                  <DatabricksLogo variant="full" size="md" />
                </div>
                <nav className="flex flex-1 flex-col">
                  <ul className="flex flex-1 flex-col gap-y-7">
                    <li>
                      <ul className="-mx-2 space-y-1">
                        {primaryNavigation.map((item) => (
                          <li key={item.id}>
                            <button
                              onClick={() => {
                                onNavigate(item.href)
                                setSidebarOpen(false)
                              }}
                              className={classNames(
                                isNavigationItemActive(currentPage, item.href)
                                  ? 'bg-gray-50 text-primary'
                                  : 'text-gray-700 hover:bg-gray-50 hover:text-primary',
                                'group flex gap-x-3 rounded-md p-2 text-sm font-semibold items-center w-full text-left'
                              )}
                            >
                              <item.icon
                                className={classNames(
                                  isNavigationItemActive(currentPage, item.href) ? 'text-primary' : 'text-gray-400 group-hover:text-primary',
                                  'h-6 w-6 shrink-0'
                                )}
                              />
                              <span className="flex-1">{item.name}</span>
                              {item.badge && (
                                <Badge variant="secondary" className="text-xs">
                                  {item.badge}
                                </Badge>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                    <li>
                      <div className="text-xs font-semibold text-gray-400 mb-2">ADMINISTRATION</div>
                      <ul className="-mx-2 space-y-1">
                        {secondaryNavigation.map((item) => (
                          <li key={item.id}>
                            <button
                              onClick={() => {
                                onNavigate(item.href)
                                setSidebarOpen(false)
                              }}
                              className="text-gray-700 hover:bg-gray-50 hover:text-primary group flex gap-x-3 rounded-md p-2 text-sm font-semibold w-full text-left"
                            >
                              <item.icon className="text-gray-400 group-hover:text-primary h-6 w-6 shrink-0" />
                              {item.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
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
          <nav className="flex flex-1 flex-col">
            <ul className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul className="-mx-2 space-y-1">
                  {primaryNavigation.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => onNavigate(item.href)}
                        className={classNames(
                          isNavigationItemActive(currentPage, item.href)
                            ? 'bg-gray-50 text-primary'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-primary',
                          'group flex gap-x-3 rounded-md p-2 text-sm font-semibold items-center w-full text-left'
                        )}
                      >
                        <item.icon
                          className={classNames(
                            isNavigationItemActive(currentPage, item.href) ? 'text-primary' : 'text-gray-400 group-hover:text-primary',
                            'h-6 w-6 shrink-0'
                          )}
                        />
                        <span className="flex-1">{item.name}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
              <li>
                <div className="text-xs font-semibold text-gray-400 mb-2">ADMINISTRATION</div>
                <ul className="-mx-2 space-y-1">
                  {secondaryNavigation.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => onNavigate(item.href)}
                        className="text-gray-700 hover:bg-gray-50 hover:text-primary group flex gap-x-3 rounded-md p-2 text-sm font-semibold w-full text-left"
                      >
                        <item.icon className="text-gray-400 group-hover:text-primary h-6 w-6 shrink-0" />
                        {item.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
              <li className="-mx-6 mt-auto">
                <div className="flex items-center gap-x-4 px-6 py-3 text-sm font-semibold text-gray-900 border-t border-border">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-databricks-emerald rounded-full animate-pulse"></div>
                    <span className="text-sm text-muted-foreground">Live Data</span>
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

      {/* Mobile header */}
      <div className="sticky top-0 z-40 flex items-center gap-x-4 bg-white px-4 py-3 shadow-sm border-b border-border sm:gap-x-6 sm:px-6 lg:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(true)}
          className="text-gray-700 lg:hidden"
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-6 w-6" />
        </Button>
        <div className="flex-1 text-sm font-semibold text-gray-900 capitalize">{currentPage || 'Dashboard'}</div>
        
        {/* Mobile actions */}
        <div className="flex items-center gap-x-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Search className="h-4 w-4" />
            <span className="sr-only">Search</span>
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onRefreshData}>
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">Refresh</span>
          </Button>
          <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0">
            <Bell className="h-4 w-4" />
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 text-xs rounded-full p-0 flex items-center justify-center">
              3
            </Badge>
            <span className="sr-only">Notifications</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full bg-primary p-0">
                <User className="h-4 w-4 text-primary-foreground" />
                <span className="sr-only">User menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">John Doe</p>
                  <p className="text-xs text-muted-foreground">john@company.com</p>
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
      <main className="py-6 lg:pl-72">
        <div className="px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}