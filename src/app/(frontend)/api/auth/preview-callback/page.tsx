'use client'

import { useEffect, useState } from 'react'
import { completePreviewOAuthCallback } from '@/lib/preview-oauth-browser'

export default function PreviewCallbackPage() {
  const [message, setMessage] = useState('Finishing your Google Drive connection…')

  useEffect(() => {
    completePreviewOAuthCallback(async (callback) => {
      const response = await fetch('/api/auth/preview-complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ callback }),
      })
      if (!response.ok) throw new Error('Google sign-in could not be completed')
    })
      .then(() => {
        setMessage('Google Drive connected. You can close this window.')
        window.setTimeout(() => window.close(), 600)
      })
      .catch((cause: unknown) =>
        setMessage(cause instanceof Error ? cause.message : 'Google sign-in failed'),
      )
  }, [])

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white">
      <p className="max-w-sm text-center text-sm">{message}</p>
    </main>
  )
}
