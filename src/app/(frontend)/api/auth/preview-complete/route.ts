import { cookies } from 'next/headers'
import type { JWT } from 'next-auth/jwt'
import { isPreviewOAuthPost, readPreviewOAuthCallback } from '@/lib/preview-oauth-server'
import { previewOAuthStore } from '@/lib/preview-oauth-store'
import { isGoogleDriveConfigured } from '@/lib/google-drive'

const flowCookieClear = [
  '__Host-pv_handle=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0',
  '__Host-pv_nonce=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0',
]

export async function POST(request: Request) {
  const headers = new Headers({
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  })
  const trustedOrigin = process.env.NEXT_PUBLIC_SITE_URL
  if (!trustedOrigin || !isPreviewOAuthPost(request, trustedOrigin) || !isGoogleDriveConfigured()) {
    return new Response(null, { status: 403, headers })
  }
  const params = readPreviewOAuthCallback(await request.json())
  if (!params) return new Response(null, { status: 400, headers })

  const cookieStore = await cookies()
  const handle = cookieStore.get('__Host-pv_handle')?.value ?? ''
  const popupNonce = cookieStore.get('__Host-pv_nonce')?.value
  const state = params.get('state') ?? ''
  const verifier = previewOAuthStore.takeCallback(handle, state.split('.')[3] ?? '', popupNonce)
  if (!verifier) return new Response(null, { status: 410, headers })

  try {
    const code = params.get('code')
    if (!code || params.get('error')) throw new Error('Google authorization was denied')
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AUTH_GOOGLE_ID!,
        client_secret: process.env.AUTH_GOOGLE_SECRET!,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: process.env.FIGMA_PREVIEW_OAUTH_REDIRECT_URI!,
      }),
      cache: 'no-store',
    })
    const tokens = (await tokenResponse.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
    }
    if (!tokenResponse.ok || !tokens.access_token) throw new Error('Google token exchange failed')

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { authorization: `Bearer ${tokens.access_token}` },
      cache: 'no-store',
    })
    const profile = (await profileResponse.json()) as {
      sub?: string
      email?: string
      name?: string
      picture?: string
    }
    if (!profileResponse.ok || !profile.sub) throw new Error('Google profile validation failed')

    const claims: JWT = {
      sub: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + (tokens.expires_in ?? 3600),
    }
    if (!previewOAuthStore.complete(handle, claims)) throw new Error('OAuth transaction expired')
    for (const cookie of flowCookieClear) headers.append('set-cookie', cookie)
    return new Response(null, { status: 204, headers })
  } catch (error) {
    previewOAuthStore.fail(handle)
    console.error(
      'Google preview OAuth failed:',
      error instanceof Error ? error.message : 'Unknown OAuth error',
    )
    for (const cookie of flowCookieClear) headers.append('set-cookie', cookie)
    return new Response(null, { status: 410, headers })
  }
}
