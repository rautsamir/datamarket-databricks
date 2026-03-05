import React from 'react'

export function DatabricksLogo({ variant = 'full', size = 'md' }) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center">
        <span className={`font-bold ${sizeClasses[size]}`} style={{ color: '#003366' }}>DNA</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#003366' }}>
          <span className="text-white font-bold text-sm">LA</span>
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            <span className={`font-bold ${sizeClasses[size]}`} style={{ color: '#003366' }}>DNA</span>
            <span className={`font-light ${size === 'lg' ? 'text-lg' : 'text-base'} text-gray-500`}>Portal</span>
          </div>
          <p className="text-[10px] text-gray-400 leading-tight">LA County Auditor-Controller</p>
        </div>
      </div>
    </div>
  )
}
