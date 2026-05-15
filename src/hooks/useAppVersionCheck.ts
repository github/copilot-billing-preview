import { useCallback, useEffect, useRef, useState } from 'react'

const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000
const VERSION_CHECK_TIMEOUT_MS = 10 * 1000
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
  const isUpdateAvailableRef = useRef(false)

  const checkForUpdate = useCallback(async () => {
    if (import.meta.env.DEV || isCheckingRef.current || isUpdateAvailableRef.current) {
      return
    }

    isCheckingRef.current = true
    const abortController = new AbortController()
    const timeoutId = window.setTimeout(() => {
      abortController.abort()
    }, VERSION_CHECK_TIMEOUT_MS)

    try {
      const response = await fetch(getVersionManifestUrl(), {
        cache: 'no-store',
        signal: abortController.signal,
      })
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
        isUpdateAvailableRef.current = true
        setIsUpdateAvailable(true)
      }
    } catch (error) {
      console.warn('App version check failed.', error)
    } finally {
      window.clearTimeout(timeoutId)
      isCheckingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (import.meta.env.DEV || isUpdateAvailable) {
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
  }, [checkForUpdate, isUpdateAvailable])

  const reloadApp = useCallback(() => {
    window.location.reload()
  }, [])

  return { isUpdateAvailable, reloadApp }
}
