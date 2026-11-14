'use client'

import { useEffect, useState } from 'react'
import { startPreviewOAuthBridge } from '@/lib/preview-oauth-browser'

export default function PreviewBridge({ csrf }: { csrf: string }) {
  const [error, setError] = useState('')

  useEffect(() => {
    startPreviewOAuthBridge(async (secret) => {
      const response = await fetch('/api/auth/preview-start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret, csrf }),
      })
      const result = (await response.json()) as { authorizationUrl?: string; error?: string }
      if (!response.ok || !result.authorizationUrl) {
        throw new Error(result.error || 'Preview sign-in unavailable')
      }
      return result.authorizationUrl
    }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Preview sign-in unavailable')
    })
  }, [csrf])

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold">
          {error ? 'Google Drive connection failed' : 'Opening Google'}
        </h1>
        <p className="mt-3 text-sm text-slate-300">
          {error || 'Complete the secure Google consent flow in this window.'}
        </p>
      </div>
    </main>
  )
}
