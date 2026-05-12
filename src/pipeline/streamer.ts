export interface StreamProgress {
  bytesProcessed: number
  totalBytes: number
}

export interface StreamLineOptions {
  onProgress?: (progress: StreamProgress) => void
}

export async function* streamLines(file: File, options?: StreamLineOptions): AsyncGenerator<string> {
  const reader = file.stream().getReader()
  const decoder = new TextDecoder()
  let carry = ''
  let bytesProcessed = 0
  const totalBytes = file.size
  let completed = false

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }

      if (!value) {
        continue
      }

      bytesProcessed += value.byteLength
      carry += decoder.decode(value, { stream: true })
      const parts = carry.split(/\r?\n/)
      carry = parts.pop() ?? ''

      const hasPendingLines = parts.length > 0 || carry.length > 0
      const progressBytes = bytesProcessed === totalBytes && hasPendingLines && totalBytes > 0
        ? totalBytes - 1
        : bytesProcessed

      options?.onProgress?.({ bytesProcessed: progressBytes, totalBytes })

      for (const part of parts) {
        yield part
      }
    }

    carry += decoder.decode()

    if (carry) {
      yield carry
    }

    options?.onProgress?.({ bytesProcessed, totalBytes })
    completed = true
  } finally {
    if (!completed) {
      await reader.cancel()
    }

    reader.releaseLock()
  }
}
