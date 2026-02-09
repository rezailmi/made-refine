import * as React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DirectEditProvider, useDirectEdit } from './provider'

const { sendEditToAgentMock, sendCommentToAgentMock } = vi.hoisted(() => ({
  sendEditToAgentMock: vi.fn<(...args: unknown[]) => Promise<{ ok: boolean; id: string }>>().mockResolvedValue({ ok: true, id: 'edit-1' }),
  sendCommentToAgentMock: vi.fn<(...args: unknown[]) => Promise<{ ok: boolean; id: string }>>().mockResolvedValue({ ok: true, id: 'comment-1' }),
}))

vi.mock('./mcp-client', () => ({
  sendEditToAgent: sendEditToAgentMock,
  sendCommentToAgent: sendCommentToAgentMock,
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DirectEditProvider>{children}</DirectEditProvider>
)

function cssValue(numericValue: number) {
  return {
    numericValue,
    unit: 'px' as const,
    raw: `${numericValue}px`,
  }
}

function createTarget(id: string, styleText = ''): HTMLElement {
  const el = document.createElement('div')
  el.id = id
  el.textContent = `target-${id}`
  if (styleText) el.style.cssText = styleText
  document.body.appendChild(el)
  return el
}

function mockClipboard() {
  const writeText = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
  return writeText
}

function resetStorage() {
  const keys = [
    'direct-edit-theme',
    'direct-edit-guidelines',
    'direct-edit-rulers-visible',
    'direct-edit-toolbar-dock',
    'direct-edit-panel-position',
  ]
  for (const key of keys) {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore storage access issues in test envs
    }
  }
}

describe('DirectEditProvider', () => {
  beforeEach(() => {
    resetStorage()
    document.documentElement.removeAttribute('data-direct-edit-disable-styles')
  })

  afterEach(() => {
    sendEditToAgentMock.mockClear()
    sendCommentToAgentMock.mockClear()
    vi.restoreAllMocks()
    document.documentElement.removeAttribute('data-direct-edit-disable-styles')
    document.body.innerHTML = ''
    resetStorage()
  })

  it('selects an element, updates styles, supports undo, and resets to original', async () => {
    const target = createTarget('card', 'padding-top: 8px; margin-left: 4px;')
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(target)
    })

    await waitFor(() => {
      expect(result.current.isOpen).toBe(true)
      expect(result.current.selectedElement).toBe(target)
      expect(result.current.elementInfo?.id).toBe('card')
    })

    act(() => {
      result.current.updateSpacingProperty('paddingTop', cssValue(24))
    })

    expect(target.style.getPropertyValue('padding-top')).toBe('24px')
    expect(result.current.pendingStyles['padding-top']).toBe('24px')

    act(() => {
      result.current.undo()
    })

    expect(target.style.getPropertyValue('padding-top')).toBe('8px')
    expect(result.current.pendingStyles['padding-top']).toBe('8px')

    act(() => {
      result.current.updateSpacingProperty('paddingTop', cssValue(16))
    })

    expect(target.style.getPropertyValue('padding-top')).toBe('16px')

    act(() => {
      result.current.resetToOriginal()
    })

    expect(target.style.getPropertyValue('padding-top')).toBe('8px')
    expect(Object.keys(result.current.pendingStyles)).toHaveLength(0)
  })

  it('handles keyboard toggles and applies persisted theme to the shadow host', async () => {
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '.', code: 'Period', ctrlKey: true }))
    })
    expect(result.current.editModeActive).toBe(true)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(result.current.editModeActive).toBe(false)

    const host = await waitFor(() => {
      const node = document.querySelector('[data-direct-edit-host]') as HTMLElement | null
      expect(node).not.toBeNull()
      return node as HTMLElement
    })

    act(() => {
      result.current.setTheme('dark')
    })

    await waitFor(() => {
      expect(host.getAttribute('data-theme')).toBe('dark')
      expect(localStorage.getItem('direct-edit-theme')).toBe('dark')
    })
  })

  it('supports code-based period toggle and ignores shift/alt variants', () => {
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', code: 'Period', ctrlKey: true }))
    })
    expect(result.current.editModeActive).toBe(true)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(result.current.editModeActive).toBe(false)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '>', code: 'Period', ctrlKey: true, shiftKey: true }))
    })
    expect(result.current.editModeActive).toBe(false)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '.', code: 'Period', ctrlKey: true, altKey: true }))
    })
    expect(result.current.editModeActive).toBe(false)
  })

  it('exports and sends edits for a selected element', async () => {
    const clipboardWrite = mockClipboard()
    const target = createTarget('button', 'padding-top: 4px;')
    target.setAttribute('data-direct-edit-source', 'src/App.tsx:10:2')

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(target)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(target)
    })

    act(() => {
      result.current.updateSpacingProperty('paddingTop', cssValue(12))
    })

    const copied = await result.current.exportEdits()
    expect(copied).toBe(true)
    expect(clipboardWrite).toHaveBeenCalledTimes(1)
    expect(String(clipboardWrite.mock.calls[0][0])).toContain('padding-top: 12px')

    const sent = await result.current.sendEditToAgent()
    expect(sent).toBe(true)
    expect(sendEditToAgentMock).toHaveBeenCalledTimes(1)

    const payload = sendEditToAgentMock.mock.calls[0][0] as {
      changes: Array<{ cssProperty: string; cssValue: string; tailwindClass: string }>
      source: { file?: string } | null
    }
    expect(payload.source?.file).toBe('src/App.tsx')
    expect(payload.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cssProperty: 'padding-top',
          cssValue: '12px',
        }),
      ]),
    )
  })

  it('supports comments lifecycle, clipboard export, and agent send', async () => {
    const clipboardWrite = mockClipboard()
    const target = createTarget('comment-target', 'padding-top: 8px;')
    target.setAttribute('data-direct-edit-source', 'src/App.tsx:22:4')

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.addComment(target, { x: 12, y: 20 })
    })

    expect(result.current.comments).toHaveLength(1)
    const commentId = result.current.comments[0].id

    act(() => {
      result.current.updateCommentText(commentId, 'Need more visual hierarchy')
      result.current.addCommentReply(commentId, 'Will update spacing and contrast.')
    })

    expect(result.current.comments[0].text).toBe('Need more visual hierarchy')
    expect(result.current.comments[0].replies).toHaveLength(1)

    const copied = await result.current.exportComment(commentId)
    expect(copied).toBe(true)
    expect(clipboardWrite).toHaveBeenCalledTimes(1)
    expect(String(clipboardWrite.mock.calls[0][0])).toContain('comment: Need more visual hierarchy')

    const sent = await result.current.sendCommentToAgent(commentId)
    expect(sent).toBe(true)
    expect(sendCommentToAgentMock).toHaveBeenCalledTimes(1)
  })

  it('tracks session edits, exports all edits, and can clear them', async () => {
    const clipboardWrite = mockClipboard()
    const target = createTarget('session-target', 'padding-top: 6px;')
    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(target)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(target)
    })

    act(() => {
      result.current.updateSpacingProperty('paddingTop', cssValue(20))
    })

    await waitFor(() => {
      expect(result.current.sessionEditCount).toBe(1)
    })

    const edits = result.current.getSessionEdits()
    expect(edits).toHaveLength(1)
    expect(edits[0].pendingStyles['padding-top']).toBe('20px')

    const copied = await result.current.exportAllEdits()
    expect(copied).toBe(true)
    expect(clipboardWrite).toHaveBeenCalledTimes(1)
    expect(String(clipboardWrite.mock.calls[0][0])).toContain('padding-top: 20px')

    act(() => {
      result.current.clearSessionEdits()
    })

    expect(result.current.sessionEditCount).toBe(0)
    expect(target.style.getPropertyValue('padding-top')).toBe('6px')
  })

  it('restores text edit session state when undoing after reverting to original', async () => {
    const target = createTarget('text-target')
    target.textContent = 'Original text'

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(target)
    })

    await waitFor(() => {
      expect(result.current.selectedElement).toBe(target)
    })

    act(() => {
      result.current.startTextEditing(target)
    })

    await waitFor(() => {
      expect(result.current.textEditingElement).toBe(target)
    })

    act(() => {
      target.textContent = 'Edited text'
      result.current.commitTextEditing()
    })

    await waitFor(() => {
      expect(result.current.sessionEditCount).toBe(1)
    })

    act(() => {
      result.current.startTextEditing(target)
    })

    await waitFor(() => {
      expect(result.current.textEditingElement).toBe(target)
    })

    act(() => {
      target.textContent = 'Original text'
      result.current.commitTextEditing()
    })

    await waitFor(() => {
      expect(result.current.sessionEditCount).toBe(0)
    })

    act(() => {
      result.current.undo()
    })

    await waitFor(() => {
      expect(result.current.sessionEditCount).toBe(1)
    })
    expect(target.textContent).toBe('Edited text')

    const edits = result.current.getSessionEdits()
    expect(edits).toHaveLength(1)
    expect(edits[0].textEdit).toEqual({
      originalText: 'Original text',
      newText: 'Edited text',
    })
  })

  it('commits text editing and clears contenteditable when turning edit mode off', async () => {
    const target = createTarget('toggle-text-target')
    target.textContent = 'Before'

    const { result } = renderHook(() => useDirectEdit(), { wrapper })

    act(() => {
      result.current.selectElement(target)
      result.current.toggleEditMode()
    })

    await waitFor(() => {
      expect(result.current.editModeActive).toBe(true)
    })

    act(() => {
      result.current.startTextEditing(target)
    })

    await waitFor(() => {
      expect(result.current.textEditingElement).toBe(target)
    })
    expect(target.getAttribute('contenteditable')).toBe('true')

    act(() => {
      target.textContent = 'After'
      result.current.toggleEditMode()
    })

    await waitFor(() => {
      expect(result.current.editModeActive).toBe(false)
      expect(result.current.textEditingElement).toBeNull()
      expect(target.hasAttribute('contenteditable')).toBe(false)
      expect(result.current.sessionEditCount).toBe(1)
    })
    expect(target.textContent).toBe('After')
  })
})
