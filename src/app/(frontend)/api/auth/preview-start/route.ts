import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { hasPreviewOAuthCsrf, isPreviewOAuthPost } from '@/lib/preview-oauth-server'
import { previewOAuthStore } from '@/lib/preview-oauth-store'
import { isGoogleDriveConfigured } from '@/lib/google-drive'

function noStoreHeaders() {
  return {
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  }
}

function previewPrefixIsFresh(prefix: string) {
  try {
    const payload = JSON.parse(Buffer.from(prefix.split('.')[1] ?? '', 'base64url').toString()) as {
      exp?: number
    }
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() + 5 * 60_000
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const trustedOrigin = process.env.NEXT_PUBLIC_SITE_URL
  if (!trustedOrigin || !isPreviewOAuthPost(request, trustedOrigin)) {
    return Response.json(
      { error: 'Invalid preview request' },
      { status: 403, headers: noStoreHeaders() },
    )
  }
  if (!isGoogleDriveConfigured()) {
    return Response.json(
      { error: 'Google OAuth credentials are not configured' },
      { status: 503, headers: noStoreHeaders() },
    )
  }

  const body = (await request.json()) as { secret?: unknown; csrf?: unknown }
  const cookieStore = await cookies()
  const bootstrap = cookieStore.get('__Host-pv_bootstrap')?.value
  if (!hasPreviewOAuthCsrf(bootstrap, body.csrf) || typeof body.secret !== 'string') {
    return Response.json(
      { error: 'Invalid preview request' },
      { status: 403, headers: noStoreHeaders() },
    )
  }

  const redirectUri = process.env.FIGMA_PREVIEW_OAUTH_REDIRECT_URI
  const statePrefix = process.env.FIGMA_PREVIEW_OAUTH_STATE_PREFIX
  if (!redirectUri || !statePrefix || !previewPrefixIsFresh(statePrefix)) {
    return Response.json(
      {
        error:
          'Preview OAuth is unavailable. Use the published app or retry after preview restarts.',
      },
      { status: 503, headers: noStoreHeaders() },
    )
  }
  const transaction = previewOAuthStore.begin(body.secret)
  if (!transaction) {
    return Response.json(
      { error: 'Could not start sign-in' },
      { status: 409, headers: noStoreHeaders() },
    )
  }

  const state = [
    statePrefix,
    transaction.nonce,
    Buffer.from('/api/auth/preview-callback').toString('base64url'),
  ].join('.')
  const challenge = createHash('sha256').update(transaction.verifier).digest('base64url')
  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authorizationUrl.search = new URLSearchParams({
    access_type: 'offline',
    client_id: process.env.AUTH_GOOGLE_ID!,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account consent',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile https://www.googleapis.com/auth/drive',
    state,
  }).toString()

  const headers = new Headers(noStoreHeaders())
  headers.append(
    'set-cookie',
    '__Host-pv_bootstrap=; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=0',
  )
  headers.append(
    'set-cookie',
    `__Host-pv_handle=${body.secret}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=300`,
  )
  headers.append(
    'set-cookie',
    `__Host-pv_nonce=${transaction.nonce}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=300`,
  )
  return Response.json({ authorizationUrl: authorizationUrl.toString() }, { headers })
}
