import type { NextRequest } from 'next/server'
import { driveError, getGoogleDriveAccessToken } from '@/lib/google-drive'

const DRIVE_ID = /^[a-zA-Z0-9_-]{10,200}$/

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const accessToken = await getGoogleDriveAccessToken(request)
  if (!accessToken) return driveError(401, 'Connect Google Drive to access this media.')
  const { id } = await context.params
  if (!DRIVE_ID.test(id)) return driveError(400, 'Invalid media file.')

  const metadataResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=name,mimeType,size,appProperties`,
    {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    },
  )
  const metadata = (await metadataResponse.json()) as {
    name?: string
    mimeType?: string
    appProperties?: { myspaceMedia?: string }
  }
  if (!metadataResponse.ok || metadata.appProperties?.myspaceMedia !== 'true') {
    return driveError(404, 'Media file not found.')
  }

  const range = request.headers.get('range')
  const mediaResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...(range ? { range } : {}),
      },
      cache: 'no-store',
    },
  )
  if (!mediaResponse.ok || !mediaResponse.body) {
    return driveError(mediaResponse.status, 'Media could not be downloaded.')
  }
  const headers = new Headers({
    'cache-control': 'private, no-store',
    'content-type': metadata.mimeType || 'application/octet-stream',
  })
  const size = mediaResponse.headers.get('content-length')
  if (size) headers.set('content-length', size)
  const contentRange = mediaResponse.headers.get('content-range')
  if (contentRange) headers.set('content-range', contentRange)
  headers.set('accept-ranges', 'bytes')
  if (request.nextUrl.searchParams.get('download') === '1') {
    const safeName = (metadata.name || 'myspace-media').replaceAll(/["\r\n]/g, '_')
    headers.set('content-disposition', `attachment; filename="${safeName}"`)
  }
  return new Response(mediaResponse.body, { status: mediaResponse.status, headers })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const accessToken = await getGoogleDriveAccessToken(request)
  if (!accessToken) return driveError(401, 'Connect Google Drive to delete media.')
  const { id } = await context.params
  if (!DRIVE_ID.test(id)) return driveError(400, 'Invalid media file.')

  const metadataResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=appProperties`,
    {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    },
  )
  const metadata = (await metadataResponse.json()) as {
    appProperties?: { myspaceMedia?: string }
  }
  if (!metadataResponse.ok || metadata.appProperties?.myspaceMedia !== 'true') {
    return driveError(404, 'Media file not found.')
  }
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    },
  )
  if (!response.ok) return driveError(response.status, 'Google Drive could not delete this file.')
  return new Response(null, { status: 204 })
}
