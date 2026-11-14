import { auth } from '@/auth'
import MySpaceApp, { type DriveConfig } from '@/components/MySpaceApp'
import { isGoogleDriveConfigured } from '@/lib/google-drive'

export default async function HomePage() {
  const session = await auth()
  const driveConfig: DriveConfig = {
    configured: isGoogleDriveConfigured(),
    connected: Boolean(session?.user && !session.driveError),
    preview: Boolean(process.env.FIGMA_PREVIEW_OAUTH_REDIRECT_URI),
    profile: session?.user
      ? {
          email: session.user.email ?? '',
          name: session.user.name ?? 'Google account',
          image: session.user.image ?? undefined,
        }
      : null,
  }

  return <MySpaceApp driveConfig={driveConfig} />
}
