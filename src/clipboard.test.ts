import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildAgentClipboardText, copyText } from './clipboard'

const restores: Array<() => void> = []

function mockNavigatorClipboard(
  writeText: ((text: string) => Promise<void>) | undefined
) {
  const descriptor = Object.getOwnPropertyDescriptor(window.navigator, 'clipboard')

  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  })

  restores.push(() => {
    if (descriptor) {
      Object.defineProperty(window.navigator, 'clipboard', descriptor)
      return
    }
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
  })
}

function mockExecCommand(impl: ((command: string) => boolean) | undefined) {
  const descriptor = Object.getOwnPropertyDescriptor(document, 'execCommand')

  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: impl,
  })

  restores.push(() => {
    if (descriptor) {
      Object.defineProperty(document, 'execCommand', descriptor)
      return
    }
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: undefined,
    })
  })
}

describe('clipboard', () => {
  afterEach(() => {
    while (restores.length > 0) {
      const restore = restores.pop()
      restore?.()
    }
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('builds the agent-ready clipboard prefix', () => {
    expect(buildAgentClipboardText('## edits')).toBe('implement the visual edits\n\n## edits')
  })

  it('uses navigator clipboard when available', async () => {
    const writeText = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
    const execCommand = vi.fn<(...args: unknown[]) => boolean>().mockReturnValue(true)
    mockNavigatorClipboard(async (text: string) => {
      await writeText(text)
    })
    mockExecCommand((command: string) => execCommand(command))

    await expect(copyText('hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith('hello')
    expect(execCommand).not.toHaveBeenCalled()
  })

  it('falls back to execCommand when navigator clipboard rejects', async () => {
    const writeText = vi.fn<(...args: unknown[]) => Promise<void>>().mockRejectedValue(new Error('denied'))
    const execCommand = vi.fn<(...args: unknown[]) => boolean>().mockReturnValue(true)
    mockNavigatorClipboard(async (text: string) => {
      await writeText(text)
    })
    mockExecCommand((command: string) => execCommand(command))

    await expect(copyText('hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('falls back to execCommand when navigator clipboard is unavailable', async () => {
    const execCommand = vi.fn<(...args: unknown[]) => boolean>().mockReturnValue(true)
    mockNavigatorClipboard(undefined)
    mockExecCommand((command: string) => execCommand(command))

    await expect(copyText('hello')).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('returns false when clipboard and fallback both fail', async () => {
    const writeText = vi.fn<(...args: unknown[]) => Promise<void>>().mockRejectedValue(new Error('denied'))
    const execCommand = vi.fn<(...args: unknown[]) => boolean>().mockReturnValue(false)
    mockNavigatorClipboard(async (text: string) => {
      await writeText(text)
    })
    mockExecCommand((command: string) => execCommand(command))

    await expect(copyText('hello')).resolves.toBe(false)
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('restores prior focus after execCommand fallback', async () => {
    const writeText = vi.fn<(...args: unknown[]) => Promise<void>>().mockRejectedValue(new Error('denied'))
    const execCommand = vi.fn<(...args: unknown[]) => boolean>().mockReturnValue(true)
    mockNavigatorClipboard(async (text: string) => {
      await writeText(text)
    })
    mockExecCommand((command: string) => execCommand(command))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    expect(document.activeElement).toBe(input)

    await expect(copyText('hello')).resolves.toBe(true)

    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.activeElement).toBe(input)
    expect(document.querySelectorAll('textarea[readonly]').length).toBe(0)
  })
})
