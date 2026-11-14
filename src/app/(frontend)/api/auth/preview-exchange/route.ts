import { encode } from 'next-auth/jwt'
import { isPreviewOAuthPost } from '@/lib/preview-oauth-server'
import { previewOAuthStore } from '@/lib/preview-oauth-store'
import { SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session-cookie'

export async function POST(request: Request) {
  const headers = new Headers({
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  })
  const trustedOrigin = process.env.NEXT_PUBLIC_SITE_URL
  if (!trustedOrigin || !isPreviewOAuthPost(request, trustedOrigin)) {
    return new Response(null, { status: 403, headers })
  }
  const { secret } = (await request.json()) as { secret?: unknown }
  if (typeof secret !== 'string') return new Response(null, { status: 400, headers })
  const result = previewOAuthStore.consume(secret)
  if (result.status === 'pending') return new Response(null, { status: 202, headers })
  if (result.status === 'missing' || !process.env.AUTH_SECRET) {
    return new Response(null, { status: 410, headers })
  }
  const token = await encode({
    token: result.result,
    secret: process.env.AUTH_SECRET,
    salt: SESSION_COOKIE,
    maxAge: SESSION_MAX_AGE,
  })
  headers.set(
    'set-cookie',
    [
      `${SESSION_COOKIE}=${token}`,
      `Max-Age=${SESSION_MAX_AGE}`,
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=None',
      'Partitioned',
    ].join('; '),
  )
  return new Response(null, { status: 204, headers })
}
