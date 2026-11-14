import type { NextRequest } from 'next/server'
import { driveError, getGoogleDriveAccessToken } from '@/lib/google-drive'

export async function GET(request: NextRequest) {
  const accessToken = await getGoogleDriveAccessToken(request)
  if (!accessToken) return driveError(401, 'Connect Google Drive to view storage.')
  const response = await fetch(
    'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink),storageQuota(limit,usage,usageInDrive,usageInDriveTrash)',
    {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    },
  )
  if (!response.ok) return driveError(response.status, 'Google Drive storage is unavailable.')
  return Response.json(await response.json())
}
