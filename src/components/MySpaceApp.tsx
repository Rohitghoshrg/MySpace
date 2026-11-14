'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, signOut } from 'next-auth/react'
import { openPreviewOAuth, waitForPreviewOAuthSession } from '@/lib/preview-oauth-browser'
import EmptyState from '@/components/EmptyState'
import MediaCenter from '@/components/MediaCenter'

export type DriveConfig = {
  configured: boolean
  connected: boolean
  preview: boolean
  profile: { email: string; name: string; image?: string } | null
}

type DriveAccount = {
  id: string
  email: string
  name: string
  image?: string
  active: boolean
  status: 'connected' | 'reconnect'
}

type View = 'dashboard' | 'chat' | 'notes' | 'collections' | 'files' | 'drive' | 'settings'
type IconName =
  | 'archive'
  | 'arrow'
  | 'back'
  | 'bell'
  | 'bookmark'
  | 'check'
  | 'chevron'
  | 'cloud'
  | 'download'
  | 'edit'
  | 'file'
  | 'folder'
  | 'grid'
  | 'image'
  | 'info'
  | 'list'
  | 'lock'
  | 'menu'
  | 'message'
  | 'moon'
  | 'more'
  | 'note'
  | 'paperclip'
  | 'plus'
  | 'search'
  | 'send'
  | 'settings'
  | 'share'
  | 'shield'
  | 'sparkle'
  | 'star'
  | 'storage'
  | 'sun'
  | 'trash'
  | 'upload'
  | 'user'
  | 'video'
  | 'wifi'
  | 'x'

const paths: Record<IconName, ReactNode> = {
  archive: (
    <>
      <path d="M4 7h16v13H4z" />
      <path d="M2.5 4h19v3h-19zM9 11h6" />
    </>
  ),
  arrow: (
    <>
      <path d="m9 18 6-6-6-6" />
    </>
  ),
  back: (
    <>
      <path d="m15 18-6-6 6-6" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  cloud: <path d="M17.5 19H7a5 5 0 1 1 1.1-9.9A7 7 0 0 1 21 13a4 4 0 0 1-3.5 6Z" />,
  download: (
    <>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
      <path d="M5 21h14" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </>
  ),
  file: (
    <>
      <path d="M6 2h8l4 4v16H6z" />
      <path d="M14 2v5h5" />
    </>
  ),
  folder: <path d="M3 6h7l2 2h9v12H3z" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10h.01" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  message: (
    <path d="M21 11.5a8.5 8.5 0 0 1-9 8.5 9.5 9.5 0 0 1-4-.9L3 21l1.7-4.5A8.5 8.5 0 1 1 21 11.5Z" />
  ),
  moon: <path d="M21 12.7A9 9 0 1 1 11.3 3 7 7 0 0 0 21 12.7Z" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  note: (
    <>
      <path d="M5 3h14v18H5z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  paperclip: (
    <path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 0 1-2.8-2.8l8.9-8.9" />
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  send: (
    <>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
    </>
  ),
  shield: <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" />,
  sparkle: (
    <path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Zm6 11 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8Z" />
  ),
  star: <path d="m12 2.5 3 6 6.5 1-4.7 4.6 1.1 6.4-5.9-3.1-5.9 3.1 1.1-6.4-4.7-4.6 6.5-1Z" />,
  storage: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 3h6l1 4H8zM6 7l1 14h10l1-14M10 11v6m4-6v6" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m0 0L8 8m4-4 4 4" />
      <path d="M5 20h14" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <path d="m17 10 4-2v8l-4-2Z" />
    </>
  ),
  wifi: (
    <>
      <path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
      <path d="M12 20h.01" />
    </>
  ),
  x: <path d="m6 6 12 12M18 6 6 18" />,
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

function Button({
  children,
  icon,
  variant = 'primary',
  onClick,
  type = 'button',
  disabled = false,
  className = '',
}: {
  children?: ReactNode
  icon?: IconName
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`button ${variant} ${className}`}
      onClick={onClick}
    >
      {icon && <Icon name={icon} size={18} />} {children}
    </button>
  )
}

function IconButton({
  icon,
  label,
  onClick,
  active = false,
}: {
  icon: IconName
  label: string
  onClick?: () => void
  active?: boolean
}) {
  return (
    <button
      className={`icon-button ${active ? 'active' : ''}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  )
}

const nav: { id: View; label: string; icon: IconName }[] = [
  { id: 'chat', label: 'My Notes', icon: 'message' },
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'notes', label: 'Smart Notes', icon: 'note' },
  { id: 'collections', label: 'Collections', icon: 'bookmark' },
  { id: 'files', label: 'Files', icon: 'folder' },
  { id: 'drive', label: 'Google Drive', icon: 'cloud' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

const mobileNav = nav.filter((item) =>
  ['chat', 'collections', 'files', 'settings'].includes(item.id),
)

type Message = {
  id: number
  text: string
  time: string
  type: 'text'
  starred: boolean
}

type Note = {
  id: number
  title: string
  preview: string
  category: string
  date: string
  color: string
  pinned: boolean
  favorite: boolean
}

const initialMessages: Message[] = []
const legacyDemoMessages = [
  'Weekend ideas: visit the design museum, pick up a new sketchbook, and call Mom.',
  'Project Aurora — final moodboard',
  'Travel documents.pdf',
  'A quiet reminder: make space for what matters.',
]

function App({ driveConfig }: { driveConfig: DriveConfig }) {
  const router = useRouter()
  const pendingSignIn = useRef<AbortController | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [entry, setEntry] = useState<'welcome' | 'app'>('app')
  const [view, setView] = useState<View>('chat')
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState('')
  const [dark, setDark] = useState(true)
  const [accent, setAccent] = useState('blue')
  const [fontSize, setFontSize] = useState('comfortable')
  const [connected, setConnected] = useState(driveConfig.connected)
  const [driveProfile, setDriveProfile] = useState(driveConfig.profile)
  const [driveAccounts, setDriveAccounts] = useState<DriveAccount[]>([])
  const [activeDriveAccountId, setActiveDriveAccountId] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [globalSearch, setGlobalSearch] = useState(false)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<
    'connect' | 'upload' | 'media' | 'backup' | 'note' | 'storage' | null
  >(null)
  const [toast, setToast] = useState('')
  const [fileView, setFileView] = useState<'list' | 'grid'>('list')
  const [driveTab, setDriveTab] = useState('My Drive')
  const [settingsTab, setSettingsTab] = useState('Appearance')
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('dark')
  const [statusTime, setStatusTime] = useState('9:41')
  const [toggles, setToggles] = useState({
    backup: false,
    wifi: true,
    biometric: true,
    reminders: true,
  })

  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem('myspace-messages')
      const savedTheme = localStorage.getItem('myspace-theme')
      const savedMode = localStorage.getItem('myspace-theme-mode')
      const savedNotes = localStorage.getItem('myspace-notes')
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages) as Message[]
        const isLegacyDemo =
          parsed.length === legacyDemoMessages.length &&
          parsed.every((message, index) => message.text === legacyDemoMessages[index])
        if (isLegacyDemo) localStorage.removeItem('myspace-messages')
        else setMessages(parsed)
      }
      if (savedNotes) setNotes(JSON.parse(savedNotes) as Note[])
      setDark(savedTheme !== 'light')
      setAccent(localStorage.getItem('myspace-accent') || 'blue')
      setFontSize(localStorage.getItem('myspace-font') || 'comfortable')
      if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
        setThemeMode(savedMode)
      }
    } catch {
      // Invalid browser preferences fall back to deterministic defaults.
    }
    const updateClock = () =>
      setStatusTime(
        new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(new Date()),
      )
    updateClock()
    const clock = window.setInterval(updateClock, 30_000)
    setHydrated(true)
    return () => window.clearInterval(clock)
  }, [])

  useEffect(() => {
    setConnected(driveConfig.connected)
    setDriveProfile(driveConfig.profile)
  }, [driveConfig])

  useEffect(() => () => pendingSignIn.current?.abort(), [])

  const refreshDriveAccounts = useCallback(async (archiveActive = false) => {
    try {
      if (archiveActive) {
        await fetch('/api/drive/accounts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'archive' }),
        })
      }
      const response = await fetch('/api/drive/accounts', { cache: 'no-store' })
      const result = (await response.json()) as {
        activeId?: string | null
        accounts?: DriveAccount[]
      }
      if (response.ok) {
        setDriveAccounts(result.accounts ?? [])
        setActiveDriveAccountId(result.activeId ?? null)
      }
    } catch {
      // The active Drive session remains usable if the optional account list cannot load.
    }
  }, [])

  useEffect(() => {
    void refreshDriveAccounts(connected)
  }, [connected, driveProfile?.email, refreshDriveAccounts])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.documentElement.dataset.accent = accent
    document.documentElement.dataset.font = fontSize
    if (!hydrated) return
    localStorage.setItem('myspace-theme', dark ? 'dark' : 'light')
    localStorage.setItem('myspace-accent', accent)
    localStorage.setItem('myspace-font', fontSize)
  }, [dark, accent, fontSize, hydrated])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem('myspace-theme-mode', themeMode)
    if (themeMode !== 'system') {
      setDark(themeMode === 'dark')
      return
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const syncTheme = () => setDark(media.matches)
    syncTheme()
    media.addEventListener('change', syncTheme)
    return () => media.removeEventListener('change', syncTheme)
  }, [themeMode, hydrated])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem('myspace-messages', JSON.stringify(messages))
  }, [messages, hydrated])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem('myspace-notes', JSON.stringify(notes))
  }, [notes, hydrated])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const sendMessage = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) return
    setMessages([
      ...messages,
      { id: Date.now(), text: draft.trim(), time: 'Now', type: 'text', starred: false },
    ])
    setDraft('')
    setToast('Saved privately on this device')
  }

  const show = (next: View) => {
    setView(next)
    setSearch('')
    if (next === 'drive' && driveAccounts.length > 1) setModal('connect')
  }

  const connectDrive = async () => {
    if (!driveConfig.configured) {
      setToast('Google OAuth is not configured. Add the required server environment variables.')
      return
    }
    setModal(null)
    setAuthBusy(true)
    try {
      if (connected) {
        await fetch('/api/drive/accounts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'archive' }),
        })
      }
      if (driveConfig.preview) {
        pendingSignIn.current?.abort()
        const controller = new AbortController()
        pendingSignIn.current = controller
        const secret = await openPreviewOAuth()
        const outcome = await waitForPreviewOAuthSession(secret, controller.signal)
        if (outcome !== 'complete') throw new Error('Google sign-in expired. Please try again.')
        const response = await fetch('/api/drive/status', { cache: 'no-store' })
        const status = (await response.json()) as DriveConfig
        setConnected(status.connected)
        setDriveProfile(status.profile)
        if (!status.connected) throw new Error('Google did not return a valid Drive session.')
        await refreshDriveAccounts(true)
        setToast('Google Drive connected securely')
        router.refresh()
      } else {
        await signIn('google', { redirectTo: '/' })
      }
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : 'Google Drive connection failed')
    } finally {
      setAuthBusy(false)
    }
  }

  const switchDriveAccount = async (account: DriveAccount) => {
    if (account.status === 'reconnect') {
      await connectDrive()
      return
    }
    setAuthBusy(true)
    try {
      const response = await fetch('/api/drive/accounts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'switch', accountId: account.id }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Account could not be activated.')
      setConnected(true)
      setDriveProfile({ email: account.email, name: account.name, image: account.image })
      setModal(null)
      await refreshDriveAccounts()
      setToast(`Google Drive switched to ${account.email}`)
      router.refresh()
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : 'Account switch failed')
    } finally {
      setAuthBusy(false)
    }
  }

  const disconnectDriveAccount = async (accountId: string) => {
    setAuthBusy(true)
    try {
      const response = await fetch('/api/drive/accounts', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })
      const result = (await response.json()) as { error?: string; wasActive?: boolean }
      if (!response.ok) throw new Error(result.error || 'Account could not be disconnected.')
      if (result.wasActive) {
        setConnected(false)
        setDriveProfile(null)
      }
      await refreshDriveAccounts()
      setToast('Google account disconnected')
      router.refresh()
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : 'Disconnect failed')
    } finally {
      setAuthBusy(false)
    }
  }

  const disconnectDrive = async () => {
    if (activeDriveAccountId) {
      await disconnectDriveAccount(activeDriveAccountId)
      return
    }
    await signOut({ redirect: false })
    setConnected(false)
    setDriveProfile(null)
    setToast('Google Drive disconnected')
    router.refresh()
  }

  const title = nav.find((n) => n.id === view)?.label

  if (entry === 'welcome') {
    return (
      <WelcomeScreen
        dark={dark}
        setDark={setDark}
        onComplete={() => {
          localStorage.setItem('myspace-onboarding', 'complete')
          setEntry('app')
        }}
      />
    )
  }

  return (
    <div className="app-shell">
      <div className="android-status-bar" aria-label="Android status bar">
        <strong>{statusTime}</strong>
        <span>
          <Icon name="wifi" size={13} />
          <i className="cell-signal">
            <b />
            <b />
            <b />
            <b />
          </i>
          <i className="battery">
            <b />
          </i>
        </span>
      </div>
      <aside className="sidebar">
        <button className="brand" onClick={() => show('chat')} aria-label="Go to My Notes">
          <span className="brand-mark">
            <span>M</span>
          </span>
          <span>
            <strong>MySpace</strong>
            <small>Your private space</small>
          </span>
        </button>
        <nav className="main-nav" aria-label="Primary navigation">
          <span className="nav-label">Workspace</span>
          {nav.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? 'active' : ''}`}
              onClick={() => show(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.id === 'drive' && <span className={`nav-dot ${connected ? 'online' : ''}`} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="privacy-badge">
            <Icon name="shield" size={18} />
            <span>
              <strong>Private by design</strong>
              <small>Offline-first & encrypted</small>
            </span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="mobile-brand" onClick={() => show('chat')}>
            <span className="brand-mark">
              <span>M</span>
            </span>
            <strong>MySpace</strong>
          </button>
          <div className="page-heading">
            <small>Your Space</small>
            <strong>{title}</strong>
          </div>
          <div className="top-actions">
            <button
              className={`status-pill ${offline ? 'offline' : ''}`}
              onClick={() => setOffline(!offline)}
            >
              <span className="status-dot" />
              {offline ? 'Offline' : 'Local ready'}
            </button>
            <IconButton
              icon="search"
              label="Search everything"
              onClick={() => setGlobalSearch(true)}
            />
            <span className="mobile-more-button">
              <IconButton
                icon="grid"
                label="Open all sections"
                onClick={() => setMobileMenu(!mobileMenu)}
                active={mobileMenu}
              />
            </span>
            <IconButton
              icon={dark ? 'sun' : 'moon'}
              label="Toggle theme"
              onClick={() => setDark(!dark)}
            />
            <button className="avatar" aria-label="MySpace profile">
              M
            </button>
          </div>
        </header>

        <div className="content">
          {view === 'dashboard' && (
            <DashboardView
              onNavigate={show}
              onNote={() => setModal('note')}
              onUpload={() => setModal('media')}
            />
          )}
          {view === 'chat' && (
            <ChatView
              messages={messages}
              draft={draft}
              setDraft={setDraft}
              sendMessage={sendMessage}
              onSearch={() => setGlobalSearch(true)}
              onNote={() => setModal('note')}
              onUpload={() => setModal('media')}
            />
          )}
          {view === 'notes' && (
            <NotesView notes={notes} setNotes={setNotes} onNew={() => setModal('note')} />
          )}
          {view === 'collections' && <CollectionsView />}
          {view === 'files' && (
            <FilesView
              view={fileView}
              setView={setFileView}
              search={search}
              setSearch={setSearch}
              onUpload={() => setModal('media')}
              onDrive={() => show('drive')}
            />
          )}
          {view === 'drive' && (
            <DriveView
              connected={connected}
              offline={offline}
              tab={driveTab}
              setTab={setDriveTab}
              onConnect={() => setModal('connect')}
              onUpload={() => setModal('upload')}
              onBackup={() => setModal('backup')}
              profile={driveProfile}
              accountCount={driveAccounts.length}
              onDisconnect={disconnectDrive}
            />
          )}
          {view === 'settings' && (
            <SettingsView
              tab={settingsTab}
              setTab={setSettingsTab}
              dark={dark}
              setDark={setDark}
              accent={accent}
              setAccent={setAccent}
              fontSize={fontSize}
              setFontSize={setFontSize}
              toggles={toggles}
              setToggles={setToggles}
              connected={connected}
              profile={driveProfile}
              onConnect={() => setModal('connect')}
              onStorage={() => setModal('storage')}
              onReplayWelcome={() => setEntry('welcome')}
              themeMode={themeMode}
              setThemeMode={setThemeMode}
            />
          )}
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {mobileNav.map((item) => (
          <button
            key={item.id}
            className={view === item.id ? 'active' : ''}
            onClick={() => show(item.id)}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.id === 'chat' ? 'Chat' : item.label}</span>
          </button>
        ))}
        <span className="android-gesture-bar" />
      </nav>

      {mobileMenu && (
        <div className="mobile-more-menu">
          <div className="mobile-more-head">
            <span>
              <strong>All spaces</strong>
              <small>Go anywhere in MySpace</small>
            </span>
            <IconButton icon="x" label="Close menu" onClick={() => setMobileMenu(false)} />
          </div>
          <div>
            {[
              ['dashboard', 'Dashboard', 'grid', 'Overview and activity'],
              ['notes', 'Smart Notes', 'note', 'Write, pin and organize'],
              ['drive', 'Google Drive', 'cloud', 'Cloud files and backups'],
            ].map(([id, label, icon, detail]) => (
              <button
                key={id}
                onClick={() => {
                  show(id as View)
                  setMobileMenu(false)
                }}
              >
                <span className="setting-icon">
                  <Icon name={icon as IconName} />
                </span>
                <span>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
                <Icon name="chevron" size={16} />
              </button>
            ))}
          </div>
        </div>
      )}

      {globalSearch && (
        <SearchOverlay
          messages={messages}
          query={search}
          setQuery={setSearch}
          close={() => {
            setGlobalSearch(false)
            setSearch('')
          }}
          onResult={(target) => {
            setGlobalSearch(false)
            show(target)
          }}
        />
      )}
      {modal === 'connect' && (
        <ConnectModal
          offline={offline}
          configured={driveConfig.configured}
          busy={authBusy}
          accounts={driveAccounts}
          activeAccountId={activeDriveAccountId}
          close={() => setModal(null)}
          addAccount={connectDrive}
          selectAccount={switchDriveAccount}
          disconnectAccount={disconnectDriveAccount}
        />
      )}
      {modal === 'upload' && (
        <UploadModal
          offline={offline}
          connected={connected}
          close={() => setModal(null)}
          uploaded={(file) => {
            setToast(`Uploaded ${file.name} to Google Drive`)
            if (view === 'drive') router.refresh()
          }}
        />
      )}
      {modal === 'media' && (
        <MediaCenter
          connected={connected}
          activeEmail={driveProfile?.email || ''}
          onConnect={() => setModal('connect')}
          onChooseAccount={() => setModal('connect')}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'backup' && <BackupModal close={() => setModal(null)} />}
      {modal === 'note' && (
        <NoteModal
          close={() => setModal(null)}
          save={(title, content) => {
            setNotes([
              {
                id: Date.now(),
                title,
                preview: content,
                category: 'Personal',
                date: 'Just now',
                color: 'blue',
                pinned: false,
                favorite: false,
              },
              ...notes,
            ])
            setToast('Note saved locally')
            setModal(null)
          }}
        />
      )}
      {modal === 'storage' && (
        <StorageModal
          close={() => setModal(null)}
          connected={connected}
          onConnect={() => setModal('connect')}
        />
      )}
      {toast && (
        <div className="toast">
          <span className="toast-icon">
            <Icon name="check" size={16} />
          </span>
          {toast}
        </div>
      )}
    </div>
  )
}

function ChatView({
  messages,
  draft,
  setDraft,
  sendMessage,
  onSearch,
  onNote,
  onUpload,
}: {
  messages: Message[]
  draft: string
  setDraft: (v: string) => void
  sendMessage: (e: FormEvent) => void
  onSearch: () => void
  onNote: () => void
  onUpload: () => void
}) {
  return (
    <div className="chat-layout">
      <section className="chat-panel">
        <div className="chat-header">
          <div className="chat-identity">
            <span className="notes-avatar">
              <Icon name="sparkle" size={24} />
            </span>
            <span>
              <strong>My Notes</strong>
              <small>
                <span className="online-dot" /> Saved privately on this device
              </small>
            </span>
          </div>
          <div className="inline-actions">
            <IconButton icon="search" label="Search messages" onClick={onSearch} />
            <IconButton icon="more" label="More options" />
          </div>
        </div>
        <div className="encryption-note">
          <Icon name="lock" size={13} /> Only you can see what you save here
        </div>
        <div className="messages">
          {messages.length === 0 && (
            <EmptyState
              icon={<Icon name="message" size={24} />}
              title="No conversations yet"
              text="Your conversations will appear here."
              compact
            />
          )}
          {messages.length > 0 && <div className="date-pill">Today</div>}
          {messages.map((message) => (
            <article className={`message ${message.type}`} key={message.id}>
              <div className="message-body">
                <p>{message.text}</p>
                <div className="message-meta">
                  {message.starred && <Icon name="star" size={12} />} {message.time}
                  <Icon name="check" size={12} />
                  <Icon name="check" size={12} />
                </div>
              </div>
            </article>
          ))}
        </div>
        <form className="composer" onSubmit={sendMessage}>
          <IconButton icon="plus" label="Add attachment" onClick={onUpload} />
          <input
            aria-label="Message yourself"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message yourself…"
          />
          <IconButton icon="paperclip" label="Attach a file" onClick={onUpload} />
          <button className="send-button" type="submit" aria-label="Send message">
            <Icon name="send" size={19} />
          </button>
        </form>
      </section>
      <aside className="context-panel">
        <div className="welcome-card">
          <div className="welcome-art">
            <span className="orbit orbit-a" />
            <span className="orbit orbit-b" />
            <span className="art-mark">M</span>
          </div>
          <div>
            <span className="eyebrow">Your private corner</span>
            <h2>
              Save anything.
              <br />
              Find it in a moment.
            </h2>
            <p>Thoughts, files and memories stay organized, even when you're offline.</p>
          </div>
        </div>
        <div className="section-title">
          <span>
            <strong>Quick actions</strong>
            <small>Keep your flow moving</small>
          </span>
        </div>
        <div className="quick-grid">
          <button onClick={onNote}>
            <span className="quick-icon violet">
              <Icon name="note" />
            </span>
            <strong>New note</strong>
            <small>Capture a thought</small>
          </button>
          <button onClick={onUpload}>
            <span className="quick-icon blue">
              <Icon name="upload" />
            </span>
            <strong>Add media</strong>
            <small>Gallery or camera</small>
          </button>
          <button onClick={onSearch}>
            <span className="quick-icon cyan">
              <Icon name="search" />
            </span>
            <strong>Find anything</strong>
            <small>Smart search</small>
          </button>
          <button>
            <span className="quick-icon amber">
              <Icon name="bell" />
            </span>
            <strong>Reminder</strong>
            <small>Remember later</small>
          </button>
        </div>
      </aside>
    </div>
  )
}

function DashboardView({
  onNavigate,
  onNote,
  onUpload,
}: {
  onNavigate: (view: View) => void
  onNote: () => void
  onUpload: () => void
}) {
  return (
    <div className="page-stack dashboard-page">
      <div className="dashboard-welcome">
        <div>
          <span className="eyebrow">Welcome to MySpace</span>
          <h1>Your private workspace is ready.</h1>
          <p>Start with a note, add your own files, or connect Google Drive when you choose.</p>
        </div>
        <div className="dashboard-actions">
          <Button variant="secondary" icon="upload" onClick={onUpload}>
            Add file
          </Button>
          <Button icon="edit" onClick={onNote}>
            New note
          </Button>
        </div>
      </div>
      <div className="dashboard-stats">
        {[
          ['chat', 'message', 'My Notes', 'Capture a thought', 'blue'],
          ['notes', 'note', 'Smart Notes', 'Write and organize', 'violet'],
          ['files', 'folder', 'My Files', 'Import or upload', 'cyan'],
          ['drive', 'cloud', 'Connections', 'Connect Google Drive', 'green'],
        ].map(([target, icon, label, detail, color]) => (
          <button key={label} onClick={() => onNavigate(target as View)}>
            <span className={`stat-icon ${color}`}>
              <Icon name={icon as IconName} />
            </span>
            <span>
              <strong>{label}</strong>
              <em>{detail}</em>
            </span>
            <Icon name="arrow" size={18} />
          </button>
        ))}
      </div>
    </div>
  )
}

function NotesView({
  notes,
  setNotes,
  onNew,
}: {
  notes: Note[]
  setNotes: (notes: Note[]) => void
  onNew: () => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'All' | 'Pinned' | 'Favorites'>('All')
  const visibleNotes = notes.filter(
    (note) =>
      (filter === 'All' ||
        (filter === 'Pinned' && note.pinned) ||
        (filter === 'Favorites' && note.favorite)) &&
      `${note.title} ${note.preview} ${note.category}`.toLowerCase().includes(query.toLowerCase()),
  )
  const toggle = (id: number, key: 'pinned' | 'favorite') =>
    setNotes(notes.map((note) => (note.id === id ? { ...note, [key]: !note[key] } : note)))

  return (
    <div className="page-stack notes-page">
      <div className="hero-row compact">
        <div>
          <span className="eyebrow">Ideas, beautifully organized</span>
          <h1>Smart Notes</h1>
          <p>Write freely, pin what matters, and find every thought in seconds.</p>
        </div>
        <Button icon="plus" onClick={onNew}>
          New note
        </Button>
      </div>
      <div className="notes-toolbar">
        <label className="search-field">
          <Icon name="search" size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your notes"
          />
        </label>
        <div className="notes-filters">
          {(['All', 'Pinned', 'Favorites'] as const).map((item) => (
            <button
              key={item}
              className={filter === item ? 'active' : ''}
              onClick={() => setFilter(item)}
            >
              {item === 'Pinned' && <Icon name="bookmark" size={14} />}
              {item === 'Favorites' && <Icon name="star" size={14} />}
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="notes-grid">
        {visibleNotes.map((note) => (
          <article className="note-card" key={note.id}>
            <div className={`note-accent ${note.color}`} />
            <div className="note-card-actions">
              <IconButton
                icon="bookmark"
                label={note.pinned ? 'Unpin note' : 'Pin note'}
                active={note.pinned}
                onClick={() => toggle(note.id, 'pinned')}
              />
              <IconButton
                icon="star"
                label={note.favorite ? 'Remove favorite' : 'Add favorite'}
                active={note.favorite}
                onClick={() => toggle(note.id, 'favorite')}
              />
            </div>
            <span className="note-category">{note.category}</span>
            <h2>{note.title}</h2>
            <p>{note.preview}</p>
            <div className="note-card-footer">
              <span>{note.date}</span>
              <button onClick={onNew}>
                Edit <Icon name="arrow" size={14} />
              </button>
            </div>
          </article>
        ))}
        {visibleNotes.length === 0 && (
          <EmptyState
            icon={<Icon name="note" size={24} />}
            title={notes.length ? 'No matching notes' : 'No notes yet'}
            text={
              notes.length
                ? 'Try another phrase or clear the current filter.'
                : 'Your notes will appear here when you create them.'
            }
            action={notes.length ? undefined : { label: 'Create a note', onClick: onNew }}
          />
        )}
      </div>
    </div>
  )
}

function CollectionsView() {
  return (
    <div className="page-stack">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Curated by you</span>
          <h1>Everything has a place.</h1>
          <p>Group notes, messages, and files into spaces that make sense to you.</p>
        </div>
      </div>
      <EmptyState
        icon={<Icon name="bookmark" size={24} />}
        title="No collections yet"
        text="Create a collection when you are ready to group your notes and files."
      />
    </div>
  )
}

function FilesView({
  view,
  setView,
  search,
  setSearch,
  onUpload,
  onDrive,
}: {
  view: 'list' | 'grid'
  setView: (v: 'list' | 'grid') => void
  search: string
  setSearch: (v: string) => void
  onUpload: () => void
  onDrive: () => void
}) {
  const [category, setCategory] = useState('All files')
  const emptyCopy: Record<string, [IconName, string, string]> = {
    'All files': ['folder', 'No files yet', 'Import or upload files to get started.'],
    Images: ['image', 'No images yet', 'Images you add will appear here.'],
    Videos: ['video', 'No videos yet', 'Videos you add will appear here.'],
    Documents: ['file', 'No documents yet', 'Documents you add will appear here.'],
    Other: ['archive', 'No other files yet', 'Other file types you add will appear here.'],
  }
  const [emptyIcon, emptyTitle, emptyText] = emptyCopy[category] ?? emptyCopy['All files']
  return (
    <div className="page-stack">
      <div className="hero-row compact">
        <div>
          <span className="eyebrow">Local library</span>
          <h1>All files</h1>
          <p>Files you save stay available, with or without a connection.</p>
        </div>
        <Button icon="upload" onClick={onUpload}>
          Add photos or videos
        </Button>
      </div>
      <div className="file-categories">
        {[
          ['All files', 'folder'],
          ['Images', 'image'],
          ['Videos', 'video'],
          ['Documents', 'note'],
          ['Other', 'archive'],
          ['Google Drive', 'cloud'],
        ].map(([label, icon]) => (
          <button
            className={category === label ? 'active' : ''}
            key={label}
            onClick={() => {
              if (label === 'Google Drive') onDrive()
              else setCategory(label)
            }}
          >
            <Icon name={icon as IconName} />
            <span>
              <strong>{label}</strong>
              <small>{label === 'Google Drive' ? 'Optional connection' : '0 items'}</small>
            </span>
          </button>
        ))}
      </div>
      <section className="wide-card file-section">
        <div className="file-toolbar">
          <label className="search-field">
            <Icon name="search" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files"
            />
          </label>
          <button className="sort-button">
            Last modified <Icon name="chevron" size={15} />
          </button>
          <div className="view-toggle">
            <IconButton
              icon="list"
              label="List view"
              active={view === 'list'}
              onClick={() => setView('list')}
            />
            <IconButton
              icon="grid"
              label="Grid view"
              active={view === 'grid'}
              onClick={() => setView('grid')}
            />
          </div>
        </div>
        <div className={`files ${view}`}>
          <EmptyState
            icon={<Icon name={search ? 'search' : emptyIcon} size={24} />}
            title={search ? 'No matching files' : emptyTitle}
            text={search ? 'Try a different search.' : emptyText}
            action={search ? undefined : { label: 'Upload or import', onClick: onUpload }}
            compact
          />
        </div>
      </section>
    </div>
  )
}

type DriveItem = {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime?: string
  webViewLink?: string
}

type DriveAbout = {
  storageQuota?: {
    limit?: string
    usage?: string
  }
}

function DriveView({
  connected,
  offline,
  tab,
  setTab,
  onConnect,
  onUpload,
  onBackup,
  profile,
  accountCount,
  onDisconnect,
}: {
  connected: boolean
  offline: boolean
  tab: string
  setTab: (v: string) => void
  onConnect: () => void
  onUpload: () => void
  onBackup: () => void
  profile: DriveConfig['profile']
  accountCount: number
  onDisconnect: () => void
}) {
  const [files, setFiles] = useState<DriveItem[]>([])
  const [folder, setFolder] = useState('root')
  const [folderName, setFolderName] = useState('My Drive')
  const [about, setAbout] = useState<DriveAbout | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!connected || offline) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetch(`/api/drive/files?folder=${encodeURIComponent(folder)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as { files?: DriveItem[]; error?: string }
        if (!response.ok) throw new Error(result.error || 'Could not load Google Drive')
        setFiles(result.files ?? [])
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load Google Drive')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [connected, folder, offline])

  useEffect(() => {
    if (!connected || offline) return
    fetch('/api/drive/about', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((result: DriveAbout | null) => setAbout(result))
      .catch(() => setAbout(null))
  }, [connected, offline])

  const usedBytes = Number(about?.storageQuota?.usage || 0)
  const limitBytes = Number(about?.storageQuota?.limit || 0)
  const formatStorage = (bytes: number) =>
    bytes ? `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB` : 'Unavailable'

  if (!connected)
    return (
      <div className="center-state">
        <div className="drive-logo">
          <span />
          <span />
          <span />
        </div>
        <span className="prototype-label">Optional connection</span>
        <h1>Bring Google Drive into your space</h1>
        <p>
          Browse your cloud files and create private backups while keeping your local library
          exactly where it is.
        </p>
        <Button onClick={onConnect} icon="cloud">
          Connect Google Drive
        </Button>
        <small>
          <Icon name="shield" size={14} /> Secure Google OAuth · MySpace never asks for your
          password
        </small>
      </div>
    )
  return (
    <div className="page-stack">
      {offline && (
        <div className="offline-banner">
          <Icon name="wifi" size={18} />
          <span>
            <strong>You're offline</strong> Drive actions are paused. Local files and notes still
            work.
          </span>
          <button>Retry connection</button>
        </div>
      )}
      <div className="drive-hero">
        <div className="drive-account">
          <div className="drive-logo small">
            <span />
            <span />
            <span />
          </div>
          <div>
            <span className="eyebrow">Google Drive · Connected</span>
            <h1>Your cloud, in reach.</h1>
            <button className="drive-account-selector" onClick={onConnect}>
              <span className="online-dot" />
              {profile?.email || 'your Google account'}
              {accountCount > 1 && <em>{accountCount} accounts</em>}
              <Icon name="chevron" size={14} />
            </button>
          </div>
        </div>
        <div className="drive-actions">
          <Button variant="secondary" icon="archive" onClick={onBackup}>
            Back up
          </Button>
          <Button icon="upload" onClick={onUpload} disabled={offline}>
            Upload
          </Button>
        </div>
      </div>
      {about?.storageQuota && (
        <div className="drive-grid">
          <div className="cloud-usage-card">
            <div>
              <span className="usage-icon">
                <Icon name="cloud" />
              </span>
              <span>
                <small>Google Drive storage</small>
                <strong>
                  {formatStorage(usedBytes)}{' '}
                  {limitBytes > 0 && <em>of {formatStorage(limitBytes)}</em>}
                </strong>
              </span>
            </div>
            <div className="usage-legend">
              <span>
                <i className="dot blue" /> {files.length} items here
              </span>
              {limitBytes > usedBytes && (
                <span>
                  <i className="dot violet" /> {formatStorage(limitBytes - usedBytes)} free
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      <section className="wide-card file-section">
        <div className="drive-tabs">
          {['My Drive', 'Shared', 'Recent', 'Starred', 'Trash'].map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
          <div className="drive-tools">
            <IconButton icon="search" label="Search Drive" />
            <IconButton icon="grid" label="Change view" />
            <IconButton icon="more" label="Drive options" />
          </div>
        </div>
        <div className="breadcrumb">
          <button
            onClick={() => {
              setFolder('root')
              setFolderName('My Drive')
            }}
          >
            My Drive
          </button>
          <Icon name="chevron" size={14} />
          <span>{folderName}</span>
        </div>
        <div className="files list">
          {loading && <div className="drive-list-state">Loading your Google Drive…</div>}
          {error && <div className="drive-list-state error">{error}</div>}
          {!loading && !error && files.length === 0 && (
            <EmptyState
              icon={<Icon name="cloud" size={24} />}
              title="No files yet"
              text="Upload a file to this Google Drive folder to get started."
              action={{ label: 'Upload file', onClick: onUpload }}
              compact
            />
          )}
          {files.map((file) => {
            const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
            return (
              <button
                className="file-row"
                key={file.id}
                onClick={() => {
                  if (isFolder) {
                    setFolder(file.id)
                    setFolderName(file.name)
                  } else if (file.webViewLink) {
                    window.open(file.webViewLink, '_blank', 'noopener,noreferrer')
                  }
                }}
              >
                <span className={`file-symbol ${isFolder ? 'blue' : 'violet'}`}>
                  <Icon name={isFolder ? 'folder' : 'file'} />
                </span>
                <span className="file-name">
                  <strong>{file.name}</strong>
                  <small>{isFolder ? 'Folder' : file.mimeType.split('/').pop()}</small>
                </span>
                <span className="file-location">
                  <Icon name="cloud" size={14} /> Cloud only
                </span>
                <span className="file-size">
                  {file.size ? `${(Number(file.size) / 1024 / 1024).toFixed(1)} MB` : '—'}
                </span>
                <span className="file-date">
                  {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}
                </span>
                <Icon name="more" size={18} />
              </button>
            )
          })}
        </div>
      </section>
      <button className="disconnect-link" onClick={onDisconnect}>
        Disconnect Google Drive
      </button>
    </div>
  )
}

function SettingsView({
  tab,
  setTab,
  dark,
  setDark,
  accent,
  setAccent,
  fontSize,
  setFontSize,
  toggles,
  setToggles,
  connected,
  profile,
  onConnect,
  onStorage,
  onReplayWelcome,
  themeMode,
  setThemeMode,
}: any) {
  const tabs = [
    ['Appearance', 'sparkle'],
    ['Google Drive', 'cloud'],
    ['Storage', 'storage'],
    ['Security', 'shield'],
    ['General', 'settings'],
    ['About', 'info'],
  ]
  return (
    <div className="settings-layout">
      <aside className="settings-nav">
        <div>
          <span className="eyebrow">Preferences</span>
          <h1>Settings</h1>
        </div>
        {tabs.map(([name, icon]) => (
          <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>
            <Icon name={icon as IconName} />
            {name}
            <Icon name="chevron" size={15} />
          </button>
        ))}
      </aside>
      <section className="settings-content">
        {tab === 'Appearance' && (
          <>
            <SettingsHeading
              title="Make it feel like yours"
              text="Your display preferences are saved only on this device."
            />
            <SettingGroup title="Theme">
              <div className="theme-options">
                <button
                  className={themeMode === 'light' ? 'active' : ''}
                  onClick={() => setThemeMode('light')}
                >
                  <span className="theme-preview light-preview">
                    <i />
                    <b />
                    <b />
                  </span>
                  <span>
                    <strong>Light</strong>
                    <small>Bright and clear</small>
                  </span>
                  <span className="radio" />
                </button>
                <button
                  className={themeMode === 'dark' ? 'active' : ''}
                  onClick={() => setThemeMode('dark')}
                >
                  <span className="theme-preview dark-preview">
                    <i />
                    <b />
                    <b />
                  </span>
                  <span>
                    <strong>Dark</strong>
                    <small>Easy on the eyes</small>
                  </span>
                  <span className="radio" />
                </button>
                <button
                  className={themeMode === 'system' ? 'active' : ''}
                  onClick={() => setThemeMode('system')}
                >
                  <span className="theme-preview system-preview">
                    <i />
                    <b />
                    <b />
                  </span>
                  <span>
                    <strong>System</strong>
                    <small>Match your device</small>
                  </span>
                  <span className="radio" />
                </button>
              </div>
            </SettingGroup>
            <SettingGroup title="Accent color">
              <div className="accent-options">
                {['blue', 'violet', 'cyan', 'coral', 'emerald'].map((c) => (
                  <button
                    key={c}
                    className={`${c} ${accent === c ? 'active' : ''}`}
                    onClick={() => setAccent(c)}
                    aria-label={`${c} accent`}
                  >
                    {accent === c && <Icon name="check" size={15} />}
                  </button>
                ))}
              </div>
            </SettingGroup>
            <SettingGroup title="Text size">
              <div className="segmented">
                {['compact', 'comfortable', 'large'].map((s) => (
                  <button
                    key={s}
                    className={fontSize === s ? 'active' : ''}
                    onClick={() => setFontSize(s)}
                  >
                    {s[0].toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </SettingGroup>
            <SettingRow icon="image" title="Chat wallpaper" text="Soft aurora" action="Customize" />
          </>
        )}
        {tab === 'Google Drive' && (
          <>
            <SettingsHeading
              title="Google Drive"
              text="Cloud access is optional. Your offline library remains independent."
            />
            <div className="connection-cards">
              <div className="account-card">
                <span className="account-avatar">
                  <Icon name="user" size={19} />
                </span>
                <span>
                  <strong>Google Account</strong>
                  <small>{connected ? profile?.email || 'Connected' : 'Not Connected'}</small>
                </span>
                <Button variant="secondary" onClick={onConnect}>
                  {connected ? 'Manage' : 'Connect'}
                </Button>
              </div>
              <div className="account-card">
                <span className="account-avatar">
                  <Icon name="cloud" size={19} />
                </span>
                <span>
                  <strong>Google Drive</strong>
                  <small>{connected ? 'Connected' : 'Not Connected'}</small>
                </span>
                <Button variant="secondary" onClick={onConnect}>
                  {connected ? 'Manage' : 'Connect'}
                </Button>
              </div>
            </div>
            <SettingGroup title="Backup preferences">
              <ToggleRow
                title="Automatic backup"
                text="Back up your library every day"
                checked={toggles.backup}
                onChange={() => setToggles({ ...toggles, backup: !toggles.backup })}
              />
              <SettingRow icon="archive" title="Backup frequency" text="Not set" action="Change" />
              <ToggleRow
                title="Wi-Fi only"
                text="Pause cloud transfers on mobile data"
                checked={toggles.wifi}
                onChange={() => setToggles({ ...toggles, wifi: !toggles.wifi })}
              />
            </SettingGroup>
            <div className="privacy-callout">
              <Icon name="shield" />
              <div>
                <strong>Minimum access, always</strong>
                <p>
                  The production architecture uses the Google Drive <code>drive.file</code> scope
                  where possible. MySpace never sees or stores your Google password.
                </p>
              </div>
            </div>
          </>
        )}
        {tab === 'Storage' && (
          <>
            <SettingsHeading
              title="Storage management"
              text="Storage details appear after you add your own content."
            />
            <button className="storage-overview" onClick={onStorage}>
              <div className="storage-ring empty">
                <Icon name="storage" size={22} />
              </div>
              <span>
                <small>Local storage</small>
                <strong>No files stored</strong>
                <em>Usage will appear here</em>
              </span>
              <Icon name="arrow" />
            </button>
          </>
        )}
        {tab === 'Security' && (
          <>
            <SettingsHeading
              title="Privacy & security"
              text="Your space is protected on this device."
            />
            <ToggleRow
              title="Biometric unlock"
              text="Use your fingerprint or face to open MySpace"
              checked={toggles.biometric}
              onChange={() => setToggles({ ...toggles, biometric: !toggles.biometric })}
            />
            <SettingRow icon="lock" title="Change app PIN" text="Not configured" action="Change" />
            <SettingRow icon="shield" title="Auto-lock" text="After 2 minutes" action="Change" />
            <SettingRow
              icon="archive"
              title="Local backup & restore"
              text="Encrypted archive · Never overwrites without confirmation"
              action="Manage"
            />
          </>
        )}
        {tab === 'General' && (
          <>
            <SettingsHeading title="General" text="Tune everyday behavior and notifications." />
            <ToggleRow
              title="Local reminders"
              text="Notify me about saved reminders"
              checked={toggles.reminders}
              onChange={() => setToggles({ ...toggles, reminders: !toggles.reminders })}
            />
            <SettingRow
              icon="download"
              title="Download location"
              text="MySpace / Downloads"
              action="Change"
            />
            <SettingRow
              icon="trash"
              title="Recently deleted retention"
              text="30 days"
              action="Change"
            />
          </>
        )}
        {tab === 'About' && (
          <div className="about-panel">
            <span className="brand-mark large">
              <span>M</span>
            </span>
            <h1>MySpace</h1>
            <p>Your Space. Your Memories. Your Control.</p>
            <span>Personal workspace · Version 1.0</span>
            <div>
              <button>Privacy principles</button>
              <button>Open-source licenses</button>
              <button onClick={onReplayWelcome}>Replay welcome</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function SettingsHeading({ title, text }: { title: string; text: string }) {
  return (
    <div className="settings-heading">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  )
}
function SettingGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="setting-group">
      <span className="group-label">{title}</span>
      {children}
    </div>
  )
}
function SettingRow({
  icon,
  title,
  text,
  action,
}: {
  icon: IconName
  title: string
  text: string
  action: string
}) {
  return (
    <button className="setting-row">
      <span className="setting-icon">
        <Icon name={icon} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <em>{action}</em>
      <Icon name="chevron" size={15} />
    </button>
  )
}
function ToggleRow({
  title,
  text,
  checked,
  onChange,
}: {
  title: string
  text: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <div className="setting-row toggle-row">
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <button
        className={`toggle ${checked ? 'on' : ''}`}
        onClick={onChange}
        aria-label={`Toggle ${title}`}
      >
        <span />
      </button>
    </div>
  )
}

function Modal({
  children,
  close,
  wide = false,
}: {
  children: ReactNode
  close: () => void
  wide?: boolean
}) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <section className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        {children}
      </section>
    </div>
  )
}

function ModalHeader({
  icon,
  title,
  text,
  close,
}: {
  icon: IconName
  title: string
  text?: string
  close: () => void
}) {
  return (
    <div className="modal-header">
      <span className="modal-icon">
        <Icon name={icon} />
      </span>
      <div>
        <h2>{title}</h2>
        {text && <p>{text}</p>}
      </div>
      <IconButton icon="x" label="Close" onClick={close} />
    </div>
  )
}

function ConnectModal({
  offline,
  configured,
  busy,
  accounts,
  activeAccountId,
  close,
  addAccount,
  selectAccount,
  disconnectAccount,
}: {
  offline: boolean
  configured: boolean
  busy: boolean
  accounts: DriveAccount[]
  activeAccountId: string | null
  close: () => void
  addAccount: () => Promise<void>
  selectAccount: (account: DriveAccount) => Promise<void>
  disconnectAccount: (accountId: string) => Promise<void>
}) {
  return (
    <Modal close={close}>
      <ModalHeader
        icon="cloud"
        title={accounts.length ? 'Connected accounts' : 'Choose an account'}
        text={
          accounts.length
            ? 'Select the Google Drive account MySpace should use'
            : 'Secure Google OAuth 2.0'
        }
        close={close}
      />
      {!configured ? (
        <div className="modal-state error">
          <Icon name="settings" size={28} />
          <strong>Google OAuth needs configuration</strong>
          <p>
            Add AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, and AUTH_SECRET, then register the required
            callback URLs in Google Cloud Console.
          </p>
        </div>
      ) : offline ? (
        <div className="modal-state error">
          <Icon name="wifi" size={28} />
          <strong>You're offline</strong>
          <p>Connect to the internet to start Google authentication.</p>
        </div>
      ) : (
        <>
          {accounts.length > 0 && (
            <div className="connected-account-list">
              {accounts.map((account) => (
                <div
                  className={`connected-account-row ${
                    account.id === activeAccountId ? 'active' : ''
                  }`}
                  key={account.id}
                >
                  <button
                    className="connected-account-main"
                    disabled={busy}
                    onClick={() => selectAccount(account)}
                  >
                    {account.image ? (
                      <img src={account.image} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="connected-account-fallback">
                        {(account.name || account.email).slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span>
                      <strong>{account.name}</strong>
                      <small>{account.email}</small>
                      <em className={account.status}>
                        <i />
                        {account.id === activeAccountId
                          ? 'Active'
                          : account.status === 'reconnect'
                            ? 'Reconnect required'
                            : 'Connected'}
                      </em>
                    </span>
                    <Icon name={account.id === activeAccountId ? 'check' : 'chevron'} />
                  </button>
                  <button
                    className="connected-account-remove"
                    disabled={busy}
                    onClick={() => disconnectAccount(account.id)}
                  >
                    Disconnect
                  </button>
                </div>
              ))}
            </div>
          )}
          <button className="add-google-account" onClick={addAccount} disabled={busy}>
            <span>G</span>
            <span>
              <strong>{accounts.length ? 'Add another account' : 'Continue with Google'}</strong>
              <small>Opens Google&apos;s official account chooser</small>
            </span>
            <Icon name="plus" size={18} />
          </button>
          <div className="permission-list">
            <span className="group-label">Secure account selection</span>
            <p>
              <Icon name="check" size={15} /> Google chooses which device accounts are shown
            </p>
            <p>
              <Icon name="check" size={15} /> Drive files always use the active email shown here
            </p>
            <p>
              <Icon name="x" size={15} /> It will not see your Google password
            </p>
          </div>
          {busy && <div className="account-picker-loading">Updating Google account…</div>}
        </>
      )}
      <p className="fine-print">
        MySpace requests Google Drive access because browsing, renaming, downloading, and deleting
        existing Drive files cannot be provided by the narrower drive.file permission.
      </p>
    </Modal>
  )
}

function UploadModal({
  offline,
  connected,
  close,
  uploaded,
}: {
  offline: boolean
  connected: boolean
  close: () => void
  uploaded: (file: { id: string; name: string; webViewLink?: string }) => void
}) {
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [folder, setFolder] = useState('root')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    id: string
    name: string
    webViewLink?: string
  } | null>(null)

  useEffect(
    () => () => {
      xhrRef.current?.abort()
    },
    [],
  )

  const start = () => {
    if (!file) {
      setError('Choose a file from your phone first.')
      return
    }
    setUploading(true)
    setProgress(0)
    setError('')
    const body = new FormData()
    body.append('file', file)
    body.append('folder', folder)
    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr
    xhr.open('POST', '/api/drive/upload')
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100))
    })
    xhr.addEventListener('load', () => {
      setUploading(false)
      let response: { id?: string; name?: string; webViewLink?: string; error?: string } = {}
      try {
        response = JSON.parse(xhr.responseText) as typeof response
      } catch {
        // A non-JSON response is reported as a real failure below.
      }
      if (xhr.status >= 200 && xhr.status < 300 && response.id && response.name) {
        const confirmed = {
          id: response.id,
          name: response.name,
          webViewLink: response.webViewLink,
        }
        setProgress(100)
        setResult(confirmed)
        uploaded(confirmed)
      } else {
        setError(response.error || 'Google Drive did not confirm this upload.')
      }
    })
    xhr.addEventListener('error', () => {
      setUploading(false)
      setError('The upload was interrupted. Check your connection and retry.')
    })
    xhr.addEventListener('abort', () => setUploading(false))
    xhr.send(body)
  }

  const cancel = () => {
    if (uploading) {
      xhrRef.current?.abort()
      setError('Upload cancelled. Your local file was not changed.')
    } else {
      close()
    }
  }

  return (
    <Modal close={close}>
      <ModalHeader
        icon="upload"
        title="Upload to Google Drive"
        text="Your local copy will be kept"
        close={close}
      />
      {!connected ? (
        <div className="modal-state">
          <Icon name="cloud" size={28} />
          <strong>Connect Drive first</strong>
          <p>Google Drive is not currently connected.</p>
        </div>
      ) : offline ? (
        <div className="modal-state error">
          <Icon name="wifi" size={28} />
          <strong>Upload paused</strong>
          <p>You're offline. Local files are safe and unchanged.</p>
        </div>
      ) : (
        <>
          {result ? (
            <div className="upload-success">
              <span className="toast-icon">
                <Icon name="check" size={18} />
              </span>
              <strong>Upload confirmed by Google Drive</strong>
              <p>{result.name}</p>
              <small>Drive file ID: {result.id}</small>
              <div className="modal-actions">
                {result.webViewLink && (
                  <Button
                    variant="secondary"
                    onClick={() => window.open(result.webViewLink, '_blank', 'noopener,noreferrer')}
                  >
                    Open in Drive
                  </Button>
                )}
                <Button onClick={close}>Done</Button>
              </div>
            </div>
          ) : (
            <>
              <label className="drop-zone">
                <span>
                  <Icon name="upload" size={26} />
                </span>
                <strong>{file ? file.name : 'Choose a file to upload'}</strong>
                <small>PDF, images, Office files, TXT, ZIP and more</small>
                <input
                  type="file"
                  hidden
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null)
                    setError('')
                  }}
                />
              </label>
              <label className="field-label">
                Destination folder
                <select value={folder} onChange={(event) => setFolder(event.target.value)}>
                  <option value="root">My Drive</option>
                </select>
              </label>
              {file && (
                <div className="upload-file">
                  <span className="file-symbol rose">
                    <Icon name="file" />
                  </span>
                  <span>
                    <strong>{file.name}</strong>
                    <small>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to upload</small>
                  </span>
                  {uploading ? <b>{progress}%</b> : <Icon name="check" />}
                </div>
              )}
              {uploading && (
                <div className="progress-track">
                  <span style={{ width: `${progress}%` }} />
                </div>
              )}
              {error && <div className="upload-error">{error}</div>}
              <div className="modal-actions">
                <Button variant="ghost" onClick={cancel}>
                  {uploading ? 'Cancel' : 'Not now'}
                </Button>
                <Button icon="upload" onClick={start} disabled={uploading || !file}>
                  {uploading ? 'Uploading…' : 'Upload file'}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  )
}

function BackupModal({ close }: { close: () => void }) {
  return (
    <Modal close={close}>
      <ModalHeader
        icon="archive"
        title="Create a Drive backup"
        text="Your backup starts with your content"
        close={close}
      />
      <EmptyState
        icon={<Icon name="archive" size={24} />}
        title="Nothing to back up yet"
        text="Add your own notes or files before creating a backup."
        compact
      />
      <div className="confirm-callout">
        <Icon name="info" size={18} />
        <span>
          This creates a new dated backup. Existing backups and local data will not be overwritten.
        </span>
      </div>
      <div className="modal-actions">
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button icon="shield" disabled>
          Create backup
        </Button>
      </div>
    </Modal>
  )
}

function NoteModal({
  close,
  save,
}: {
  close: () => void
  save: (title: string, content: string) => void
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
  return (
    <Modal close={close} wide>
      <ModalHeader
        icon="note"
        title="New note"
        text="Saved locally while you write"
        close={close}
      />
      <div className="note-editor">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Note title"
          aria-label="Note title"
        />
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Start writing…"
          aria-label="Note content"
        />
        <div className="editor-tools">
          <button>
            <strong>B</strong>
          </button>
          <button>
            <em>I</em>
          </button>
          <button>• List</button>
          <span />
          <small>
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </small>
        </div>
      </div>
      <div className="modal-actions">
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button
          icon="check"
          onClick={() => save(title.trim() || 'Untitled note', content.trim())}
          disabled={!title.trim() && !content.trim()}
        >
          Save note
        </Button>
      </div>
    </Modal>
  )
}

function StorageModal({
  close,
  connected,
  onConnect,
}: {
  close: () => void
  connected: boolean
  onConnect: () => void
}) {
  return (
    <Modal close={close} wide>
      <ModalHeader
        icon="storage"
        title="Storage management"
        text="Local and cloud storage stay separate"
        close={close}
      />
      <div className="storage-comparison">
        <div className="storage-panel">
          <span className="storage-panel-icon local">
            <Icon name="storage" />
          </span>
          <div>
            <span className="eyebrow">Local storage</span>
            <h3>No files stored</h3>
            <p>Local usage appears after you add your own content.</p>
          </div>
        </div>
        <div className="storage-panel">
          <span className="storage-panel-icon cloud">
            <Icon name="cloud" />
          </span>
          <div>
            <span className="eyebrow">Google Drive</span>
            <h3>{connected ? 'Connected' : 'Not Connected'}</h3>
            <p>
              {connected
                ? 'Open Google Drive to see live storage information.'
                : 'Connect your account to see live storage information.'}
            </p>
          </div>
          {!connected && (
            <Button variant="secondary" onClick={onConnect}>
              Connect
            </Button>
          )}
        </div>
      </div>
      <div className="confirm-callout">
        <Icon name="shield" size={18} />
        <span>
          Uploading never deletes local files. MySpace asks before replacing or restoring any data.
        </span>
      </div>
      <div className="modal-actions">
        <Button onClick={close}>Done</Button>
      </div>
    </Modal>
  )
}

function SearchOverlay({
  messages,
  query,
  setQuery,
  close,
  onResult,
}: {
  messages: Message[]
  query: string
  setQuery: (v: string) => void
  close: () => void
  onResult: (v: View) => void
}) {
  const results = useMemo(
    () =>
      messages
        .map((m) => ({
          title: m.text,
          meta: `My Notes · ${m.time}`,
          icon: 'message' as IconName,
          target: 'chat' as View,
        }))
        .filter((r) => !query || r.title.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 6),
    [messages, query],
  )
  return (
    <div className="search-overlay">
      <div className="search-dialog">
        <div className="search-input">
          <Icon name="search" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, messages, files…"
          />
          <button onClick={close}>Esc</button>
        </div>
        <div className="search-filters">
          <button className="active">Everything</button>
          <button>Messages</button>
          <button>Notes</button>
          <button>Files</button>
          <button>Drive</button>
        </div>
        <div className="search-results">
          <span className="group-label">
            {query ? `${results.length} results` : 'Your content'}
          </span>
          {results.map((r) => (
            <button key={r.title} onClick={() => onResult(r.target)}>
              <span className="file-symbol blue">
                <Icon name={r.icon} />
              </span>
              <span>
                <strong>{r.title}</strong>
                <small>{r.meta}</small>
              </span>
              <Icon name="arrow" />
            </button>
          ))}
          {results.length === 0 && (
            <EmptyState
              icon={<Icon name="search" size={24} />}
              title={query ? 'No results' : 'Nothing to search yet'}
              text={
                query
                  ? 'Try a different phrase.'
                  : 'Your notes and messages will appear here as you add them.'
              }
              compact
            />
          )}
        </div>
        <div className="search-tip">
          <Icon name="sparkle" size={16} /> Search works locally, even when you're offline.
        </div>
      </div>
    </div>
  )
}

function SplashScreen() {
  return (
    <main className="splash-screen" aria-label="MySpace is opening">
      <div className="splash-glow splash-glow-one" />
      <div className="splash-glow splash-glow-two" />
      <div className="splash-brand">
        <span className="brand-mark splash-mark">
          <span>M</span>
        </span>
        <div>
          <strong>MySpace</strong>
          <small>Your Space. Your Memories. Your Control.</small>
        </div>
      </div>
      <div className="splash-loader">
        <span />
      </div>
      <small className="splash-status">
        <Icon name="shield" size={14} /> Opening your private space
      </small>
    </main>
  )
}

function WelcomeScreen({
  dark,
  setDark,
  onComplete,
}: {
  dark: boolean
  setDark: (value: boolean) => void
  onComplete: () => void
}) {
  const [step, setStep] = useState(0)
  const slides = [
    {
      eyebrow: 'Welcome to MySpace',
      title: 'A private space for everything that matters.',
      text: 'Message yourself, collect ideas, and keep important files close. Everything starts locally and stays useful offline.',
      icon: 'message' as IconName,
      stat: 'Offline first',
    },
    {
      eyebrow: 'Organized, naturally',
      title: 'Save it now. Find it when you need it.',
      text: 'Smart collections, fast search, favorites, and reminders turn a stream of thoughts into a space that feels effortless.',
      icon: 'sparkle' as IconName,
      stat: 'Search in a moment',
    },
    {
      eyebrow: 'You stay in control',
      title: 'Local by default. Cloud when you choose.',
      text: 'Connect Google Drive for uploads and backups without replacing your offline library. MySpace never asks for your Google password.',
      icon: 'shield' as IconName,
      stat: 'Private by design',
    },
  ]
  const slide = slides[step]

  const next = () => {
    if (step === slides.length - 1) onComplete()
    else setStep(step + 1)
  }

  return (
    <main className="welcome-screen">
      <div className="welcome-orb welcome-orb-one" />
      <div className="welcome-orb welcome-orb-two" />
      <header className="welcome-nav">
        <div className="welcome-logo">
          <span className="brand-mark">
            <span>M</span>
          </span>
          <span>
            <strong>MySpace</strong>
            <small>Your private digital home</small>
          </span>
        </div>
        <div>
          <IconButton
            icon={dark ? 'sun' : 'moon'}
            label="Toggle theme"
            onClick={() => setDark(!dark)}
          />
          <Button variant="ghost" onClick={onComplete}>
            Skip introduction
          </Button>
        </div>
      </header>

      <section className="welcome-content">
        <div className="welcome-copy" key={`copy-${step}`}>
          <span className="welcome-step-icon">
            <Icon name={slide.icon} size={22} />
          </span>
          <span className="eyebrow">{slide.eyebrow}</span>
          <h1>{slide.title}</h1>
          <p>{slide.text}</p>
          <div className="welcome-actions">
            <Button onClick={next} icon={step === slides.length - 1 ? 'check' : 'arrow'}>
              {step === slides.length - 1 ? 'Enter MySpace' : 'Continue'}
            </Button>
            <span>
              <Icon name="lock" size={14} /> No account required
            </span>
          </div>
          <div className="welcome-pagination" aria-label={`Step ${step + 1} of ${slides.length}`}>
            {slides.map((item, index) => (
              <button
                key={item.title}
                className={index === step ? 'active' : ''}
                onClick={() => setStep(index)}
                aria-label={`Go to welcome step ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="welcome-device-wrap" key={`device-${step}`}>
          <div className="device-halo" />
          <div className="welcome-device">
            <div className="device-top">
              <span>9:41</span>
              <span>
                <Icon name="wifi" size={13} /> 100%
              </span>
            </div>
            <div className="device-appbar">
              <span className="notes-avatar">
                <Icon name={slide.icon} size={20} />
              </span>
              <span>
                <strong>
                  {step === 0 ? 'My Notes' : step === 1 ? 'Your library' : 'Your privacy'}
                </strong>
                <small>{slide.stat}</small>
              </span>
              <Icon name="more" size={18} />
            </div>
            {step === 0 && (
              <div className="device-chat">
                <EmptyState
                  icon={<Icon name="message" size={24} />}
                  title="No conversations yet"
                  text="Your conversations will appear here."
                  compact
                />
              </div>
            )}
            {step === 1 && (
              <div className="device-library">
                <label>
                  <Icon name="search" size={16} />
                  <span>Search anything…</span>
                </label>
                <EmptyState
                  icon={<Icon name="folder" size={24} />}
                  title="No files yet"
                  text="Your library is ready for your content."
                  compact
                />
              </div>
            )}
            {step === 2 && (
              <div className="device-security">
                <span className="security-shield">
                  <Icon name="shield" size={32} />
                </span>
                <strong>Your space is protected</strong>
                <p>Local content stays available without an internet connection.</p>
                <div>
                  <span>
                    <Icon name="storage" size={17} /> Local storage
                  </span>
                  <b>Ready</b>
                </div>
                <div>
                  <span>
                    <Icon name="cloud" size={17} /> Google Drive
                  </span>
                  <b>Optional</b>
                </div>
              </div>
            )}
            <div className="device-compose">
              <Icon name="plus" size={16} />
              <span>Message yourself…</span>
              <Icon name="send" size={16} />
            </div>
          </div>
          <div className="welcome-float-card">
            <span>
              <Icon name={slide.icon} size={16} />
            </span>
            <div>
              <strong>{slide.stat}</strong>
              <small>{step === 2 ? 'You choose what syncs' : 'Always ready for you'}</small>
            </div>
            <Icon name="check" size={15} />
          </div>
        </div>
      </section>

      <footer className="welcome-footer">
        <span>
          <Icon name="shield" size={14} /> Private by design
        </span>
        <span>MySpace · Personal workspace</span>
      </footer>
    </main>
  )
}

export default App
