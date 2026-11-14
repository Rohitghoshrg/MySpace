import { cookies } from 'next/headers'
import PreviewBridge from './preview-bridge'

export default async function PreviewSignInBridgePage() {
  const csrf = (await cookies()).get('__Host-pv_bootstrap')?.value ?? ''
  return <PreviewBridge csrf={csrf} />
}
