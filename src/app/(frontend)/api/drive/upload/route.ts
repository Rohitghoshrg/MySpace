import type { NextRequest } from 'next/server'
import { driveError, getGoogleDriveAccessToken } from '@/lib/google-drive'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const accessToken = await getGoogleDriveAccessToken(request)
  if (!accessToken) return driveError(401, 'Connect Google Drive before uploading.')
  const form = await request.formData()
  const file = form.get('file')
  const folder = form.get('folder')
  const mediaKind = form.get('mediaKind')
  if (!(file instanceof File)) return driveError(400, 'Choose a file to upload.')
  if (file.size > 512 * 1024 * 1024) {
    return driveError(413, 'This upload is limited to 512 MB in MySpace.')
  }

  const metadata: { name: string; parents?: string[] } = { name: file.name }
  if (typeof folder === 'string' && folder) metadata.parents = [folder]
  if (mediaKind === 'photo' || mediaKind === 'video') {
    Object.assign(metadata, {
      appProperties: {
        myspaceMedia: 'true',
        myspaceMediaKind: mediaKind,
      },
      description: `Uploaded from MySpace ${mediaKind === 'photo' ? 'Photos' : 'Videos'}`,
    })
  }
  const start = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,mimeType,webViewLink',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json; charset=UTF-8',
        'x-upload-content-length': String(file.size),
        'x-upload-content-type': file.type || 'application/octet-stream',
      },
      body: JSON.stringify(metadata),
      cache: 'no-store',
    },
  )
  const location = start.headers.get('location')
  if (!start.ok || !location) return driveError(start.status, 'Google Drive rejected the upload.')
  const uploaded = await fetch(location, {
    method: 'PUT',
    headers: {
      'content-length': String(file.size),
      'content-type': file.type || 'application/octet-stream',
    },
    body: file,
    cache: 'no-store',
  })
  if (!uploaded.ok)
    return driveError(uploaded.status, 'The upload failed before Drive confirmed it.')
  return Response.json(await uploaded.json())
}
