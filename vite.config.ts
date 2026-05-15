/// <reference types="vitest/config" />
import { execFileSync } from 'node:child_process'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const buildVersion = resolveBuildVersion()
const buildTime = new Date().toISOString()

function resolveBuildVersion() {
  const versionFromEnvironment = process.env.GITHUB_SHA ?? process.env.VITE_APP_VERSION
  if (versionFromEnvironment) {
    return versionFromEnvironment
  }

  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch (error) {
    console.warn('Unable to read git commit for app version; using build timestamp instead.', error)
    return `local-${Date.now()}`
  }
}

function versionManifestPlugin(): Plugin {
  return {
    name: 'app-version-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: `${JSON.stringify({ version: buildVersion, builtAt: buildTime }, null, 2)}\n`,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion),
  },
  plugins: [versionManifestPlugin(), tailwindcss(), react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
