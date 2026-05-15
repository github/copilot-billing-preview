import { useCallback, useEffect, useRef, useState } from 'react'

const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000
const CURRENT_APP_VERSION = __APP_VERSION__

type VersionManifest = {
  version: string
}

function isVersionManifest(value: unknown): value is VersionManifest {
  return (
    typeof value === 'object'
    && value !== null
    && 'version' in value
    && typeof value.version === 'string'
    && value.version.length > 0
  )
}

function getVersionManifestUrl() {
  const url = new URL(`${import.meta.env.BASE_URL}version.json`, window.location.origin)
  url.searchParams.set('v', Date.now().toString())
  return url
}

export function useAppVersionCheck() {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false)
  const isCheckingRef = useRef(false)

  const checkForUpdate = useCallback(async () => {
    if (import.meta.env.DEV || isCheckingRef.current) {
      return
    }

    isCheckingRef.current = true

    try {
      const response = await fetch(getVersionManifestUrl(), { cache: 'no-store' })
      if (!response.ok) {
        console.warn(`App version check failed with status ${response.status}.`)
        return
      }

      const manifest: unknown = await response.json()
      if (!isVersionManifest(manifest)) {
        console.warn('App version check received an invalid version manifest.')
        return
      }

      if (manifest.version !== CURRENT_APP_VERSION) {
        setIsUpdateAvailable(true)
      }
    } catch (error) {
      console.warn('App version check failed.', error)
    } finally {
      isCheckingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (import.meta.env.DEV) {
      return
    }

    const initialCheckId = window.setTimeout(() => {
      void checkForUpdate()
    }, 0)

    const intervalId = window.setInterval(() => {
      void checkForUpdate()
    }, VERSION_CHECK_INTERVAL_MS)

    const handleFocus = () => {
      void checkForUpdate()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdate()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearTimeout(initialCheckId)
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkForUpdate])

  const reloadApp = useCallback(() => {
    window.location.reload()
  }, [])

  return { isUpdateAvailable, reloadApp }
}
