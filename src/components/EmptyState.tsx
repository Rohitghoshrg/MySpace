'use client'

import type { ReactNode } from 'react'

type EmptyStateProps = {
  icon: ReactNode
  title: string
  text: string
  action?: {
    label: string
    onClick: () => void
  }
  compact?: boolean
}

export default function EmptyState({
  icon,
  title,
  text,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${compact ? 'compact' : ''}`}>
      <span className="empty-state-icon">{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
      {action && (
        <button type="button" className="button primary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
