import { describe, expect, it } from 'vitest'

import { streamLines } from './streamer'

function createMockFile(chunks: string[]): { cancelCalls: () => number; file: File } {
  const encoder = new TextEncoder()
  let index = 0
  let cancelCount = 0
  const encodedChunks = chunks.map((chunk) => encoder.encode(chunk))
  const size = encodedChunks.reduce((total, chunk) => total + chunk.byteLength, 0)

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = encodedChunks[index]
      if (chunk) {
        index += 1
        controller.enqueue(chunk)
        return
      }

      controller.close()
    },
    cancel() {
      cancelCount += 1
    },
  })

  return {
    cancelCalls: () => cancelCount,
    file: {
      size,
      stream: () => stream,
    } as File,
  }
}

describe('streamLines', () => {
  it('cancels the reader when iteration stops early', async () => {
    const { cancelCalls, file } = createMockFile(['header\n', 'row\n'])
    const lines: string[] = []

    for await (const line of streamLines(file)) {
      lines.push(line)
      break
    }

    expect(lines).toEqual(['header'])
    expect(cancelCalls()).toBe(1)
  })

  it('defers 100% progress until iteration completes', async () => {
    const { file } = createMockFile(['header\nrow'])
    const progressEvents: Array<{ bytesProcessed: number; totalBytes: number }> = []
    const iterator = streamLines(file, {
      onProgress: (progress) => {
        progressEvents.push(progress)
      },
    })

    expect(await iterator.next()).toEqual({ done: false, value: 'header' })
    expect(progressEvents).toEqual([{ bytesProcessed: file.size - 1, totalBytes: file.size }])

    expect(await iterator.next()).toEqual({ done: false, value: 'row' })
    expect(progressEvents).toEqual([{ bytesProcessed: file.size - 1, totalBytes: file.size }])

    expect(await iterator.next()).toEqual({ done: true, value: undefined })
    expect(progressEvents.at(-1)).toEqual({ bytesProcessed: file.size, totalBytes: file.size })
  })
})
