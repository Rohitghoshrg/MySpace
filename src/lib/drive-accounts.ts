import 'server-only'
import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { decode, encode, type JWT } from 'next-auth/jwt'
import { getGoogleDriveToken } from '@/lib/google-drive'
import { SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session-cookie'

export const DRIVE_ACCOUNT_COOKIE_PREFIX = '__Host-myspace.drive.'
export const MAX_DRIVE_ACCOUNTS = 5

export type ConnectedDriveAccount = {
  id: string
  email: string
  name: string
  image?: string
  active: boolean
  status: 'connected' | 'reconnect'
}

const accountId = (subject: string) =>
  createHash('sha256').update(subject).digest('base64url').slice(0, 24)

const cookieName = (id: string) => `${DRIVE_ACCOUNT_COOKIE_PREFIX}${id}`

export function driveAccountCookie(name: string, value: string, maxAge = SESSION_MAX_AGE) {
  return [
    `${name}=${value}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=None',
    'Partitioned',
  ].join('; ')
}

export function clearDriveAccountCookie(name: string) {
  return driveAccountCookie(name, '', 0)
}

async function decodeVaultToken(name: string, value: string) {
  if (!process.env.AUTH_SECRET) return null
  try {
    return await decode({
      token: value,
      secret: process.env.AUTH_SECRET,
      salt: name,
    })
  } catch {
    return null
  }
}

function accountFromToken(token: JWT, id: string, active: boolean): ConnectedDriveAccount | null {
  if (!token.sub || !token.email) return null
  return {
    id,
    email: token.email,
    name: token.name || token.email.split('@')[0] || 'Google account',
    image: typeof token.picture === 'string' ? token.picture : undefined,
    active,
    status: token.error || (!token.accessToken && !token.refreshToken) ? 'reconnect' : 'connected',
  }
}

export async function listDriveAccounts(request: NextRequest) {
  const activeToken = await getGoogleDriveToken(request)
  const activeId = activeToken?.sub ? accountId(activeToken.sub) : null
  const accounts = new Map<string, ConnectedDriveAccount>()

  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.startsWith(DRIVE_ACCOUNT_COOKIE_PREFIX)) continue
    const id = cookie.name.slice(DRIVE_ACCOUNT_COOKIE_PREFIX.length)
    const token = await decodeVaultToken(cookie.name, cookie.value)
    if (!token) continue
    const account = accountFromToken(token, id, id === activeId)
    if (account) accounts.set(id, account)
  }

  if (activeToken?.sub) {
    const id = accountId(activeToken.sub)
    const account = accountFromToken(activeToken, id, true)
    if (account) accounts.set(id, account)
  }

  return {
    activeId,
    accounts: Array.from(accounts.values()).sort((a, b) => {
      if (a.active) return -1
      if (b.active) return 1
      return a.email.localeCompare(b.email)
    }),
  }
}

export async function archiveActiveDriveAccount(request: NextRequest) {
  if (!process.env.AUTH_SECRET) return null
  const token = await getGoogleDriveToken(request)
  if (!token?.sub || !token.email) return null
  const id = accountId(token.sub)
  const name = cookieName(id)
  const encoded = await encode({
    token,
    secret: process.env.AUTH_SECRET,
    salt: name,
    maxAge: SESSION_MAX_AGE,
  })
  return { id, cookie: driveAccountCookie(name, encoded) }
}

export async function activateDriveAccount(request: NextRequest, id: string) {
  if (!process.env.AUTH_SECRET || !/^[a-zA-Z0-9_-]{24}$/.test(id)) return null
  const vaultName = cookieName(id)
  const stored = request.cookies.get(vaultName)?.value
  if (!stored) return null
  const token = await decodeVaultToken(vaultName, stored)
  if (!token?.sub || accountId(token.sub) !== id) return null
  const encoded = await encode({
    token,
    secret: process.env.AUTH_SECRET,
    salt: SESSION_COOKIE,
    maxAge: SESSION_MAX_AGE,
  })
  return {
    account: accountFromToken(token, id, true),
    cookie: driveAccountCookie(SESSION_COOKIE, encoded),
  }
}

export function driveAccountVaultCookieName(id: string) {
  return /^[a-zA-Z0-9_-]{24}$/.test(id) ? cookieName(id) : null
}

export async function getStoredDriveAccountToken(request: NextRequest, id: string) {
  const name = driveAccountVaultCookieName(id)
  if (!name) return null
  const stored = request.cookies.get(name)?.value
  if (stored) {
    const token = await decodeVaultToken(name, stored)
    if (token?.sub && accountId(token.sub) === id) return token
  }
  const active = await getGoogleDriveToken(request)
  return active?.sub && accountId(active.sub) === id ? active : null
}
