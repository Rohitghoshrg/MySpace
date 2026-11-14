import type { NextRequest } from 'next/server'
import { getGoogleDriveToken, isGoogleDriveConfigured } from '@/lib/google-drive'

export async function GET(request: NextRequest) {
  if (!isGoogleDriveConfigured()) {
    return Response.json({
      configured: false,
      connected: false,
      message:
        'Google Drive is not configured. Add AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, and AUTH_SECRET.',
    })
  }
  const token = await getGoogleDriveToken(request)
  return Response.json({
    configured: true,
    connected: Boolean(token?.accessToken && !token.error),
    profile: token?.accessToken
      ? { email: token.email ?? '', name: token.name ?? '', image: token.picture ?? '' }
      : null,
    error: token?.error ?? null,
    preview: Boolean(process.env.FIGMA_PREVIEW_OAUTH_REDIRECT_URI),
  })
}
