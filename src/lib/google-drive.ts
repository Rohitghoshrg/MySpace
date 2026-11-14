import 'server-only'
import type { NextRequest } from 'next/server'
import { getToken, type JWT } from 'next-auth/jwt'
import { SESSION_COOKIE } from '@/lib/session-cookie'

export const isGoogleDriveConfigured = () =>
  Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET)

export async function getGoogleDriveToken(request: NextRequest): Promise<JWT | null> {
  if (!process.env.AUTH_SECRET) return null
  return getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    cookieName: SESSION_COOKIE,
    secureCookie: true,
  })
}

export async function getGoogleDriveAccessToken(request: NextRequest) {
  const token = await getGoogleDriveToken(request)
  if (!token?.accessToken) return null
  if (!token.expiresAt || Date.now() < token.expiresAt * 1000 - 60_000) return token.accessToken
  if (!token.refreshToken || !process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    return null
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID,
      client_secret: process.env.AUTH_GOOGLE_SECRET,
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
    }),
    cache: 'no-store',
  })
  const refreshed = (await response.json()) as { access_token?: string }
  return response.ok ? (refreshed.access_token ?? null) : null
}

export function driveError(status: number, message: string) {
  return Response.json({ error: message }, { status })
}
