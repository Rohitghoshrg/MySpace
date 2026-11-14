import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import type { JWT } from 'next-auth/jwt'
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  SESSION_MAX_AGE,
} from '@/lib/session-cookie'

if (
  !process.env.AUTH_URL &&
  process.env.NEXT_PUBLIC_SITE_URL &&
  !process.env.NEXT_PUBLIC_SITE_URL.includes('localhost')
) {
  process.env.AUTH_URL = process.env.NEXT_PUBLIC_SITE_URL
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken || !process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    return { ...token, error: 'RefreshAccessTokenError' }
  }

  try {
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
    const refreshed = (await response.json()) as {
      access_token?: string
      expires_in?: number
      refresh_token?: string
    }
    if (!response.ok || !refreshed.access_token) throw new Error('Google token refresh failed')

    return {
      ...token,
      accessToken: refreshed.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? 3600),
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    }
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' }
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE },
  cookies: {
    sessionToken: { name: SESSION_COOKIE, options: SESSION_COOKIE_OPTIONS },
    csrfToken: { name: CSRF_COOKIE, options: SESSION_COOKIE_OPTIONS },
  },
  providers: [
    Google({
      authorization: {
        params: {
          access_type: 'offline',
          prompt: 'select_account consent',
          scope: 'openid email profile https://www.googleapis.com/auth/drive',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider === 'google') {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token ?? token.refreshToken,
          expiresAt: account.expires_at,
          error: undefined,
        }
      }
      if (!token.expiresAt || Date.now() < token.expiresAt * 1000 - 60_000) return token
      return refreshAccessToken(token)
    },
    session({ session, token }) {
      session.driveError = token.error
      return session
    },
  },
})
