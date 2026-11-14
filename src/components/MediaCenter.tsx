'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type MediaKind = 'photo' | 'video'
type UploadStatus = 'ready' | 'uploading' | 'uploaded' | 'error'

type SelectedMedia = {
  id: string
  file: File
  kind: MediaKind
  preview: string
  progress: number
  status: UploadStatus
  error?: string
  driveId?: string
  webViewLink?: string
}

type StoredMedia = {
  id: string
  name: string
  mimeType: string
  size?: string
  createdTime?: string
  webViewLink?: string
  appProperties?: { myspaceMediaKind?: MediaKind }
}

function MediaGlyph({
  name,
}: {
  name:
    | 'camera'
    | 'gallery'
    | 'video'
    | 'close'
    | 'upload'
    | 'trash'
    | 'download'
    | 'check'
    | 'back'
}) {
  const paths = {
    camera: (
      <>
        <path d="M5 7h3l1.5-2h5L16 7h3a2 2 0 0 1 2 2v9H3V9a2 2 0 0 1 2-2Z" />
        <circle cx="12" cy="13" r="3.5" />
      </>
    ),
    gallery: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9" r="1.5" />
        <path d="m4 17 5-5 3 3 2-2 6 5" />
      </>
    ),
    video: (
      <>
        <rect x="3" y="6" width="13" height="12" rx="2" />
        <path d="m16 10 5-3v10l-5-3Z" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    upload: <path d="M12 16V4m0 0L8 8m4-4 4 4M5 20h14" />,
    trash: <path d="M4 7h16M9 3h6l1 4H8zM7 7l1 14h8l1-14M10 11v6m4-6v6" />,
    download: <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    back: <path d="m15 18-6-6 6-6" />,
  }
  return (
    <svg
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

function formatSize(bytes?: string | number) {
  const value = Number(bytes || 0)
  if (!value) return 'Unknown size'
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

export default function MediaCenter({
  connected,
  activeEmail,
  onConnect,
  onChooseAccount,
  onClose,
}: {
  connected: boolean
  activeEmail: string
  onConnect: () => void
  onChooseAccount: () => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'select' | 'camera' | 'library'>('select')
  const [selected, setSelected] = useState<SelectedMedia[]>([])
  const [preview, setPreview] = useState<SelectedMedia | StoredMedia | null>(null)
  const [cameraMode, setCameraMode] = useState<MediaKind>('photo')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [recording, setRecording] = useState(false)
  const [permissionError, setPermissionError] = useState('')
  const [permissionHelp, setPermissionHelp] = useState(false)
  const [library, setLibrary] = useState<StoredMedia[]>([])
  const [libraryFilter, setLibraryFilter] = useState<'all' | MediaKind>('all')
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryError, setLibraryError] = useState('')
  const [uploadingAll, setUploadingAll] = useState(false)
  const [deletePending, setDeletePending] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const galleryInput = useRef<HTMLInputElement | null>(null)
  const photoCaptureInput = useRef<HTMLInputElement | null>(null)
  const videoCaptureInput = useRef<HTMLInputElement | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const recordedChunks = useRef<Blob[]>([])
  const activeUpload = useRef<XMLHttpRequest | null>(null)
  const cancelRequested = useRef(false)
  const selectedRef = useRef<SelectedMedia[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const stopCamera = useCallback(() => {
    recorder.current?.state === 'recording' && recorder.current.stop()
    stream?.getTracks().forEach((track) => track.stop())
    setStream(null)
    setRecording(false)
  }, [stream])

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream
  }, [stream])

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    streamRef.current = stream
  }, [stream])

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      activeUpload.current?.abort()
      selectedRef.current.forEach((item) => URL.revokeObjectURL(item.preview))
    },
    [],
  )

  const addFiles = useCallback((files: File[]) => {
    const accepted = files.filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
    )
    const additions = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      kind: (file.type.startsWith('video/') ? 'video' : 'photo') as MediaKind,
      preview: URL.createObjectURL(file),
      progress: 0,
      status: 'ready' as UploadStatus,
    }))
    setSelected((current) => [...current, ...additions])
    if (additions.length) setPreview(additions[0])
  }, [])

  const openCamera = async (mode: MediaKind) => {
    stopCamera()
    setCameraMode(mode)
    setPermissionError('')
    setPermissionHelp(false)
    setTab('camera')
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionError('Live camera access is not available in this browser preview.')
      return
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: mode === 'video',
      })
      setStream(mediaStream)
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : ''
      setPermissionError(
        name === 'NotAllowedError'
          ? `Camera${mode === 'video' ? ' and microphone' : ''} permission was denied.`
          : 'The camera could not be opened on this device.',
      )
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video?.videoWidth || !video.videoHeight) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `MySpace-${Date.now()}.jpg`, { type: 'image/jpeg' })
        addFiles([file])
        stopCamera()
        setTab('select')
      },
      'image/jpeg',
      0.92,
    )
  }

  const startRecording = () => {
    if (!stream || typeof MediaRecorder === 'undefined') {
      setPermissionError('Video recording is not supported by this browser.')
      return
    }
    const mediaRecorder = new MediaRecorder(stream)
    recordedChunks.current = []
    mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data.size) recordedChunks.current.push(event.data)
    })
    mediaRecorder.addEventListener('stop', () => {
      const mimeType = mediaRecorder.mimeType || 'video/webm'
      const blob = new Blob(recordedChunks.current, { type: mimeType })
      const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
      addFiles([new File([blob], `MySpace-${Date.now()}.${extension}`, { type: mimeType })])
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
      setTab('select')
    })
    recorder.current = mediaRecorder
    mediaRecorder.start(1000)
    setRecording(true)
  }

  const stopRecording = () => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
    setRecording(false)
  }

  const removeSelected = (id: string) => {
    setSelected((current) => {
      const item = current.find((entry) => entry.id === id)
      if (item) URL.revokeObjectURL(item.preview)
      return current.filter((entry) => entry.id !== id)
    })
    setPreview(null)
  }

  const uploadOne = (item: SelectedMedia) =>
    new Promise<void>((resolve) => {
      const body = new FormData()
      body.append('file', item.file)
      body.append('folder', 'root')
      body.append('mediaKind', item.kind)
      const xhr = new XMLHttpRequest()
      activeUpload.current = xhr
      xhr.open('POST', '/api/drive/upload')
      setSelected((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, status: 'uploading', progress: 0, error: undefined }
            : entry,
        ),
      )
      xhr.upload.addEventListener('progress', (event) => {
        if (!event.lengthComputable) return
        const progress = Math.round((event.loaded / event.total) * 100)
        setSelected((current) =>
          current.map((entry) => (entry.id === item.id ? { ...entry, progress } : entry)),
        )
      })
      xhr.addEventListener('load', () => {
        let response: { id?: string; webViewLink?: string; error?: string } = {}
        try {
          response = JSON.parse(xhr.responseText) as typeof response
        } catch {}
        const success = xhr.status >= 200 && xhr.status < 300 && response.id
        setSelected((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  status: success ? 'uploaded' : 'error',
                  progress: success ? 100 : entry.progress,
                  driveId: response.id,
                  webViewLink: response.webViewLink,
                  error: success
                    ? undefined
                    : response.error || 'Google Drive rejected the upload.',
                }
              : entry,
          ),
        )
        resolve()
      })
      xhr.addEventListener('error', () => {
        setSelected((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: 'error', error: 'Upload interrupted. Tap retry.' }
              : entry,
          ),
        )
        resolve()
      })
      xhr.addEventListener('abort', () => {
        setSelected((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: 'error', error: 'Upload cancelled. Tap retry.' }
              : entry,
          ),
        )
        resolve()
      })
      xhr.send(body)
    })

  const uploadSelected = async () => {
    if (!connected) {
      onConnect()
      return
    }
    cancelRequested.current = false
    setUploadingAll(true)
    for (const item of selected.filter((entry) => entry.status !== 'uploaded')) {
      if (cancelRequested.current) break
      await uploadOne(item)
    }
    setUploadingAll(false)
  }

  const loadLibrary = useCallback(async () => {
    if (!connected) return
    setLibraryLoading(true)
    setLibraryError('')
    try {
      const query = libraryFilter === 'all' ? '' : `?kind=${libraryFilter}`
      const response = await fetch(`/api/media/files${query}`, { cache: 'no-store' })
      const result = (await response.json()) as { files?: StoredMedia[]; error?: string }
      if (!response.ok) throw new Error(result.error || 'Media library could not be loaded.')
      setLibrary(result.files ?? [])
    } catch (cause) {
      setLibraryError(cause instanceof Error ? cause.message : 'Media library could not be loaded.')
    } finally {
      setLibraryLoading(false)
    }
  }, [connected, libraryFilter])

  useEffect(() => {
    if (tab === 'library') void loadLibrary()
  }, [loadLibrary, tab])

  const deleteMedia = async (id: string) => {
    if (!window.confirm('Delete this media from Google Drive? This cannot be undone.')) return
    setDeletePending(id)
    const response = await fetch(`/api/media/${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (response.ok) {
      setLibrary((current) => current.filter((item) => item.id !== id))
      setPreview(null)
    } else {
      const result = (await response.json()) as { error?: string }
      setLibraryError(result.error || 'Media could not be deleted.')
    }
    setDeletePending('')
  }

  return (
    <div className="media-center" role="dialog" aria-modal="true" aria-label="Photos and videos">
      <header className="media-center-header">
        <button aria-label="Close media center" onClick={onClose}>
          <MediaGlyph name="back" />
        </button>
        <span>
          <strong>Photos & videos</strong>
          <small>
            {connected ? 'Private · Google Drive' : 'Select locally, connect to upload'}
          </small>
        </span>
        <button aria-label="Close" onClick={onClose}>
          <MediaGlyph name="close" />
        </button>
      </header>

      <nav className="media-tabs" aria-label="Media sections">
        {[
          ['select', 'New'],
          ['camera', 'Camera'],
          ['library', 'Library'],
        ].map(([id, label]) => (
          <button
            className={tab === id ? 'active' : ''}
            key={id}
            onClick={() => {
              if (id === 'camera') void openCamera('photo')
              else {
                stopCamera()
                setTab(id as typeof tab)
              }
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {connected && (
        <button className="media-active-account" onClick={onChooseAccount}>
          <span>Uploading to</span>
          <strong>{activeEmail || 'Google Drive'}</strong>
          <small>Change</small>
        </button>
      )}

      <input
        ref={galleryInput}
        hidden
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
      />
      <input
        ref={photoCaptureInput}
        hidden
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
      />
      <input
        ref={videoCaptureInput}
        hidden
        type="file"
        accept="video/*"
        capture="environment"
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
      />

      <div className="media-center-body">
        {tab === 'select' && (
          <>
            <div className="media-source-grid">
              <button onClick={() => galleryInput.current?.click()}>
                <span className="media-source-icon blue">
                  <MediaGlyph name="gallery" />
                </span>
                <strong>Gallery</strong>
                <small>Select multiple</small>
              </button>
              <button onClick={() => openCamera('photo')}>
                <span className="media-source-icon violet">
                  <MediaGlyph name="camera" />
                </span>
                <strong>Take photo</strong>
                <small>Rear camera</small>
              </button>
              <button onClick={() => openCamera('video')}>
                <span className="media-source-icon cyan">
                  <MediaGlyph name="video" />
                </span>
                <strong>Record video</strong>
                <small>Camera + mic</small>
              </button>
            </div>
            <div className="media-section-heading">
              <span>
                <strong>Selected media</strong>
                <small>
                  {selected.length ? `${selected.length} ready` : 'Nothing selected yet'}
                </small>
              </span>
              {selected.length > 0 && (
                <button
                  onClick={() => {
                    selected.forEach((item) => URL.revokeObjectURL(item.preview))
                    setSelected([])
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {selected.length ? (
              <div className="selected-media-grid">
                {selected.map((item) => (
                  <button key={item.id} onClick={() => setPreview(item)}>
                    {item.kind === 'photo' ? (
                      <img src={item.preview} alt={item.file.name} />
                    ) : (
                      <video src={item.preview} muted playsInline />
                    )}
                    {item.kind === 'video' && (
                      <span className="media-kind">
                        <MediaGlyph name="video" />
                      </span>
                    )}
                    <span className={`media-upload-state ${item.status}`}>
                      {item.status === 'uploading'
                        ? `${item.progress}%`
                        : item.status === 'uploaded'
                          ? 'Saved'
                          : item.status === 'error'
                            ? 'Retry'
                            : formatSize(item.file.size)}
                    </span>
                    {item.status === 'uploading' && (
                      <i style={{ width: `${item.progress}%` }} aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="media-empty">
                <MediaGlyph name="gallery" />
                <strong>Your picks will appear here</strong>
                <p>The browser only shares media you explicitly choose.</p>
              </div>
            )}

            {selected.some((item) => item.error) && (
              <div className="media-error-list">
                {selected
                  .filter((item) => item.error)
                  .map((item) => (
                    <button key={item.id} onClick={() => void uploadOne(item)}>
                      <span>
                        <strong>{item.file.name}</strong>
                        <small>{item.error}</small>
                      </span>
                      Retry
                    </button>
                  ))}
              </div>
            )}
          </>
        )}

        {tab === 'camera' && (
          <div className="camera-stage">
            <div className="camera-mode-switch">
              <button
                className={cameraMode === 'photo' ? 'active' : ''}
                onClick={() => openCamera('photo')}
              >
                Photo
              </button>
              <button
                className={cameraMode === 'video' ? 'active' : ''}
                onClick={() => openCamera('video')}
              >
                Video
              </button>
            </div>
            {stream ? (
              <>
                <video ref={videoRef} autoPlay muted playsInline className="camera-preview" />
                <div className="camera-controls">
                  <button onClick={stopCamera}>Cancel</button>
                  {cameraMode === 'photo' ? (
                    <button
                      className="camera-shutter"
                      onClick={capturePhoto}
                      aria-label="Capture photo"
                    >
                      <span />
                    </button>
                  ) : recording ? (
                    <button
                      className="camera-shutter recording"
                      onClick={stopRecording}
                      aria-label="Stop recording"
                    >
                      <span />
                    </button>
                  ) : (
                    <button
                      className="camera-shutter video"
                      onClick={startRecording}
                      aria-label="Start recording"
                    >
                      <span />
                    </button>
                  )}
                  <span>
                    {recording ? 'Recording…' : cameraMode === 'photo' ? 'Capture' : 'Record'}
                  </span>
                </div>
              </>
            ) : (
              <div className="camera-permission">
                <span>
                  <MediaGlyph name={cameraMode === 'photo' ? 'camera' : 'video'} />
                </span>
                <strong>{permissionError || 'Camera is ready when you are'}</strong>
                <p>
                  {cameraMode === 'video'
                    ? 'Video recording requests camera and microphone access.'
                    : 'Photo capture requests camera access only.'}
                </p>
                <button onClick={() => openCamera(cameraMode)}>Try camera again</button>
                <button
                  className="permission-help-button"
                  onClick={() => setPermissionHelp(!permissionHelp)}
                >
                  Permission help
                </button>
                {permissionHelp && (
                  <small>
                    In a web app, open the browser&apos;s site controls or Android Settings → Apps →
                    your browser → Permissions. Directly opening device settings requires a native
                    Android wrapper.
                  </small>
                )}
                <div className="native-capture-fallback">
                  <button onClick={() => photoCaptureInput.current?.click()}>
                    Use photo picker
                  </button>
                  <button onClick={() => videoCaptureInput.current?.click()}>
                    Use video picker
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'library' && (
          <div className="media-library">
            {!connected ? (
              <div className="media-connect-state">
                <span>
                  <MediaGlyph name="upload" />
                </span>
                <strong>Connect Google Drive</strong>
                <p>Your uploaded photos and videos are stored privately in your Drive.</p>
                <button onClick={onConnect}>Connect securely</button>
              </div>
            ) : (
              <>
                <div className="media-library-filters">
                  {(['all', 'photo', 'video'] as const).map((filter) => (
                    <button
                      className={libraryFilter === filter ? 'active' : ''}
                      key={filter}
                      onClick={() => setLibraryFilter(filter)}
                    >
                      {filter === 'all' ? 'All media' : filter === 'photo' ? 'Photos' : 'Videos'}
                    </button>
                  ))}
                </div>
                {libraryLoading && <div className="media-empty">Loading your media…</div>}
                {libraryError && <div className="media-library-error">{libraryError}</div>}
                {!libraryLoading && !libraryError && library.length === 0 && (
                  <div className="media-empty">
                    <MediaGlyph name="gallery" />
                    <strong>No uploaded media yet</strong>
                    <p>Select a photo or video to begin.</p>
                  </div>
                )}
                <div className="stored-media-grid">
                  {library.map((item) => (
                    <button key={item.id} onClick={() => setPreview(item)}>
                      {item.mimeType.startsWith('image/') ? (
                        <img src={`/api/media/${encodeURIComponent(item.id)}`} alt={item.name} />
                      ) : (
                        <video
                          src={`/api/media/${encodeURIComponent(item.id)}`}
                          muted
                          preload="metadata"
                        />
                      )}
                      <span>{item.mimeType.startsWith('video/') ? 'Video' : 'Photo'}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {tab === 'select' && selected.length > 0 && (
        <footer className="media-upload-bar">
          <span>
            <strong>{selected.filter((item) => item.status === 'uploaded').length} saved</strong>
            <small>{selected.length} selected</small>
          </span>
          {uploadingAll ? (
            <button
              className="media-cancel-upload"
              onClick={() => {
                cancelRequested.current = true
                activeUpload.current?.abort()
                setUploadingAll(false)
              }}
            >
              Cancel upload
            </button>
          ) : (
            <button onClick={uploadSelected}>
              <MediaGlyph name="upload" />
              {connected ? 'Upload media' : 'Connect to upload'}
            </button>
          )}
        </footer>
      )}

      {preview && (
        <div className="media-preview-overlay">
          <header>
            <button onClick={() => setPreview(null)} aria-label="Close preview">
              <MediaGlyph name="close" />
            </button>
            <strong>{'file' in preview ? preview.file.name : preview.name}</strong>
          </header>
          <div className="media-preview-content">
            {'file' in preview ? (
              preview.kind === 'photo' ? (
                <img src={preview.preview} alt={preview.file.name} />
              ) : (
                <video src={preview.preview} controls autoPlay playsInline />
              )
            ) : preview.mimeType.startsWith('image/') ? (
              <img src={`/api/media/${encodeURIComponent(preview.id)}`} alt={preview.name} />
            ) : (
              <video
                src={`/api/media/${encodeURIComponent(preview.id)}`}
                controls
                autoPlay
                playsInline
              />
            )}
          </div>
          <footer>
            {'file' in preview ? (
              <>
                <button
                  onClick={() => {
                    const mode = preview.kind
                    removeSelected(preview.id)
                    void openCamera(mode)
                  }}
                >
                  Retake
                </button>
                <button className="primary" onClick={() => setPreview(null)}>
                  <MediaGlyph name="check" /> Confirm
                </button>
              </>
            ) : (
              <>
                <a href={`/api/media/${encodeURIComponent(preview.id)}?download=1`}>
                  <MediaGlyph name="download" /> Download
                </a>
                <button
                  className="danger"
                  disabled={deletePending === preview.id}
                  onClick={() => void deleteMedia(preview.id)}
                >
                  <MediaGlyph name="trash" />
                  {deletePending === preview.id ? 'Deleting…' : 'Delete'}
                </button>
              </>
            )}
          </footer>
          <small className="media-preview-meta">
            {'file' in preview
              ? `${preview.kind === 'photo' ? 'Photo' : 'Video'} · ${formatSize(preview.file.size)}`
              : `${formatSize(preview.size)} · ${
                  preview.createdTime
                    ? new Date(preview.createdTime).toLocaleDateString()
                    : 'Uploaded media'
                }`}
          </small>
        </div>
      )}
    </div>
  )
}
