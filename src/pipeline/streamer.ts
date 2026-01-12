export async function* streamLines(file: File): AsyncGenerator<string> {
  const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader()
  let carry = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    carry += value ?? ''
    const parts = carry.split(/\r?\n/)
    carry = parts.pop() ?? ''

    for (const part of parts) {
      yield part
    }
  }

  if (carry) {
    yield carry
  }
}
