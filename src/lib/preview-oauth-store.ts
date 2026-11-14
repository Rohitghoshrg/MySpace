import type { JWT } from 'next-auth/jwt'
import { createPreviewOAuthStore } from '@/lib/preview-oauth-server'

const globalStore = globalThis as typeof globalThis & {
  mySpacePreviewOAuthStore?: ReturnType<typeof createPreviewOAuthStore<JWT>>
}

export const previewOAuthStore =
  globalStore.mySpacePreviewOAuthStore ??
  (globalStore.mySpacePreviewOAuthStore = createPreviewOAuthStore<JWT>())
