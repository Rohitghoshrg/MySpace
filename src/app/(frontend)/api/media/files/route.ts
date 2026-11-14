import type { NextRequest } from 'next/server'
import { driveError, getGoogleDriveAccessToken } from '@/lib/google-drive'

export async function GET(request: NextRequest) {
  const accessToken = await getGoogleDriveAccessToken(request)
  if (!accessToken) return driveError(401, 'Connect Google Drive to view uploaded media.')
  const kind = request.nextUrl.searchParams.get('kind')
  const query = ["appProperties has { key='myspaceMedia' and value='true' }", 'trashed = false']
  if (kind === 'photo' || kind === 'video') {
    query.push(`appProperties has { key='myspaceMediaKind' and value='${kind}' }`)
  }
  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.search = new URLSearchParams({
    fields:
      'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,appProperties,videoMediaMetadata)',
    orderBy: 'createdTime desc',
    pageSize: '100',
    q: query.join(' and '),
  }).toString()
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!response.ok) return driveError(response.status, 'Uploaded media could not be loaded.')
  return Response.json(await response.json())
}
