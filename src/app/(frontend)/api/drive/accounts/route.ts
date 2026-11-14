import type { NextRequest } from 'next/server'
import {
  activateDriveAccount,
  archiveActiveDriveAccount,
  clearDriveAccountCookie,
  driveAccountVaultCookieName,
  getStoredDriveAccountToken,
  listDriveAccounts,
  MAX_DRIVE_ACCOUNTS,
} from '@/lib/drive-accounts'
import { SESSION_COOKIE } from '@/lib/session-cookie'

function isSameOriginMutation(request: NextRequest) {
  const origin = request.headers.get('origin')
  return Boolean(
    origin &&
    process.env.NEXT_PUBLIC_SITE_URL &&
    origin === process.env.NEXT_PUBLIC_SITE_URL &&
    request.headers.get('content-type')?.split(';')[0].trim() === 'application/json',
  )
}

export async function GET(request: NextRequest) {
  return Response.json(await listDriveAccounts(request), {
    headers: { 'cache-control': 'private, no-store' },
  })
}

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return Response.json({ error: 'Invalid account request.' }, { status: 403 })
  }
  const body = (await request.json()) as {
    action?: unknown
    accountId?: unknown
  }
  const headers = new Headers({ 'cache-control': 'private, no-store' })

  if (body.action === 'archive') {
    const current = await listDriveAccounts(request)
    const archived = await archiveActiveDriveAccount(request)
    if (!archived) {
      return Response.json({ error: 'No active Google account to save.' }, { status: 401 })
    }
    const archivedCookieName = driveAccountVaultCookieName(archived.id)
    const alreadyStored = Boolean(
      archivedCookieName && request.cookies.get(archivedCookieName)?.value,
    )
    if (!alreadyStored && current.accounts.length >= MAX_DRIVE_ACCOUNTS) {
      return Response.json(
        { error: `MySpace supports up to ${MAX_DRIVE_ACCOUNTS} connected Google accounts.` },
        { status: 409 },
      )
    }
    headers.append('set-cookie', archived.cookie)
    return Response.json({ saved: true, accountId: archived.id }, { headers })
  }

  if (body.action === 'switch' && typeof body.accountId === 'string') {
    const activated = await activateDriveAccount(request, body.accountId)
    if (!activated?.account) {
      return Response.json({ error: 'This account needs to be connected again.' }, { status: 409 })
    }
    headers.append('set-cookie', activated.cookie)
    return Response.json({ account: activated.account }, { headers })
  }

  return Response.json({ error: 'Unsupported account action.' }, { status: 400 })
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return Response.json({ error: 'Invalid account request.' }, { status: 403 })
  }
  const body = (await request.json()) as { accountId?: unknown }
  if (typeof body.accountId !== 'string') {
    return Response.json({ error: 'Choose an account to disconnect.' }, { status: 400 })
  }
  const vaultName = driveAccountVaultCookieName(body.accountId)
  if (!vaultName) return Response.json({ error: 'Invalid account.' }, { status: 400 })
  const token = await getStoredDriveAccountToken(request, body.accountId)
  let revoked = false
  const providerToken = token?.refreshToken || token?.accessToken
  if (providerToken) {
    try {
      const revokeResponse = await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: providerToken }),
        cache: 'no-store',
      })
      revoked = revokeResponse.ok
    } catch {
      // Local disconnect still succeeds when Google's revocation endpoint is unavailable.
    }
  }
  const { activeId } = await listDriveAccounts(request)
  const headers = new Headers({ 'cache-control': 'private, no-store' })
  headers.append('set-cookie', clearDriveAccountCookie(vaultName))
  if (activeId === body.accountId) {
    headers.append('set-cookie', clearDriveAccountCookie(SESSION_COOKIE))
  }
  return Response.json(
    { disconnected: true, revoked, wasActive: activeId === body.accountId },
    { headers },
  )
}
