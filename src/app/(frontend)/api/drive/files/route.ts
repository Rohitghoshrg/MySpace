import type { NextRequest } from 'next/server'
import { driveError, getGoogleDriveAccessToken } from '@/lib/google-drive'

export async function GET(request: NextRequest) {
  const accessToken = await getGoogleDriveAccessToken(request)
  if (!accessToken) return driveError(401, 'Connect Google Drive to browse files.')
  const folder = request.nextUrl.searchParams.get('folder') || 'root'
  const search = request.nextUrl.searchParams.get('q')?.trim()
  const query = [`'${folder.replaceAll("'", "\\'")}' in parents`, 'trashed = false']
  if (search) query.push(`name contains '${search.replaceAll("'", "\\'")}'`)
  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.search = new URLSearchParams({
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink,parents)',
    orderBy: 'folder,name',
    pageSize: '100',
    q: query.join(' and '),
  }).toString()
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!response.ok) return driveError(response.status, 'Google Drive could not load your files.')
  return Response.json(await response.json())
}
