import { randomBytes } from 'node:crypto'

const SECRET = /^[a-f0-9]{64}$/
const TRANSACTION_TTL_MS = 5 * 60_000

export const newPreviewOAuthSecret = () => randomBytes(32).toString('hex')

export function isPreviewOAuthPost(request: Request, trustedOrigin: string) {
  return (
    request.method === 'POST' &&
    request.headers.get('origin') === trustedOrigin &&
    request.headers.get('content-type')?.split(';')[0].trim() === 'application/json'
  )
}

export function hasPreviewOAuthCsrf(cookie: string | undefined, submitted: unknown) {
  return typeof cookie === 'string' && SECRET.test(cookie) && cookie === submitted
}

export function readPreviewOAuthCallback(body: unknown) {
  const callback = (body as { callback?: unknown } | null)?.callback
  if (typeof callback !== 'string' || !callback || callback.length > 8192) return null
  return new URLSearchParams(callback)
}

type Transaction<T> = {
  expires: number
  nonce: string
  verifier: string
  phase: 'pending' | 'exchanging' | 'complete'
  result?: T
}

export function createPreviewOAuthStore<T>(now = Date.now) {
  const transactions = new Map<string, Transaction<T>>()
  const live = (secret: string) => {
    const entry = transactions.get(secret)
    if (entry && entry.expires <= now()) {
      transactions.delete(secret)
      return undefined
    }
    return entry
  }
  return {
    begin(secret: string) {
      if (!SECRET.test(secret) || transactions.has(secret) || transactions.size >= 1000) return null
      const nonce = newPreviewOAuthSecret()
      const verifier = newPreviewOAuthSecret()
      transactions.set(secret, {
        nonce,
        verifier,
        expires: now() + TRANSACTION_TTL_MS,
        phase: 'pending',
      })
      return { nonce, verifier }
    },
    takeCallback(secret: string, stateNonce: string, popupNonce: string | undefined) {
      const entry = live(secret)
      if (
        !entry ||
        entry.phase !== 'pending' ||
        entry.nonce !== stateNonce ||
        entry.nonce !== popupNonce
      )
        return null
      entry.phase = 'exchanging'
      return entry.verifier
    },
    complete(secret: string, result: T) {
      const entry = live(secret)
      if (!entry || entry.phase !== 'exchanging') return false
      entry.result = result
      entry.phase = 'complete'
      return true
    },
    fail(secret: string) {
      if (live(secret)) transactions.delete(secret)
    },
    consume(secret: string) {
      const entry = live(secret)
      if (!entry) return { status: 'missing' as const }
      if (entry.phase !== 'complete') return { status: 'pending' as const }
      transactions.delete(secret)
      return { status: 'complete' as const, result: entry.result as T }
    },
  }
}
