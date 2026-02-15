import { afterEach, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from './server'
import { store } from './store'
import type { VisualAnnotation } from './types'

function makeAnnotation(overrides: Partial<VisualAnnotation> = {}): VisualAnnotation {
  return {
    id: `ann-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    status: 'pending',
    type: 'edit',
    element: {
      tagName: 'div',
      id: null,
      classList: [],
      domSelector: 'div',
      targetHtml: '<div></div>',
      textPreview: '',
    },
    source: null,
    reactStack: [],
    changes: [],
    exportMarkdown: '',
    ...overrides,
  } as VisualAnnotation
}

function extractText(result: unknown): string {
  if (!result || typeof result !== 'object' || !('content' in result)) return ''
  const content = (result as { content?: Array<{ type?: string; text?: string }> }).content
  if (!Array.isArray(content) || content.length === 0) return ''
  const first = content[0]
  if (first?.type !== 'text') return ''
  return first.text ?? ''
}

async function setupMcpClient() {
  const mcpServer = createMcpServer()
  const client = new Client({ name: 'test-client', version: '0.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  await Promise.all([
    mcpServer.connect(serverTransport),
    client.connect(clientTransport),
  ])

  return { mcpServer, client }
}

describe('MCP server tools', () => {
  afterEach(() => {
    store.clear()
  })

  it('registers export_all_annotations in tools list', async () => {
    const { mcpServer, client } = await setupMcpClient()
    try {
      const tools = await client.listTools()
      expect(tools.tools.some((tool) => tool.name === 'export_all_annotations')).toBe(true)
    } finally {
      await Promise.all([client.close(), mcpServer.close()])
    }
  })

  it('returns empty-state text when there are no exportable annotations', async () => {
    const { mcpServer, client } = await setupMcpClient()
    try {
      const result = await client.callTool({ name: 'export_all_annotations', arguments: {} })
      expect(extractText(result)).toBe('No exportable annotations.')
    } finally {
      await Promise.all([client.close(), mcpServer.close()])
    }
  })

  it('exports all annotations by default and applies status filtering', async () => {
    store.add(
      makeAnnotation({
        id: 'exp-edit',
        type: 'edit',
        exportMarkdown: '@<Button>\n\nedits:\npadding-top: 12px',
      })
    )
    store.add(
      makeAnnotation({
        id: 'exp-comment',
        type: 'comment',
        status: 'acknowledged',
        commentText: 'Increase contrast',
        replies: [],
        exportMarkdown: '@<Card>\n\ncomment: Increase contrast',
      })
    )

    const { mcpServer, client } = await setupMcpClient()
    try {
      const all = await client.callTool({ name: 'export_all_annotations', arguments: {} })
      const allText = extractText(all)
      expect(allText).toContain('implement the visual edits')
      expect(allText).toContain('padding-top: 12px')
      expect(allText).toContain('comment: Increase contrast')

      const pendingOnly = await client.callTool({
        name: 'export_all_annotations',
        arguments: { status: 'pending' },
      })
      const pendingText = extractText(pendingOnly)
      expect(pendingText).toContain('padding-top: 12px')
      expect(pendingText).not.toContain('Increase contrast')
    } finally {
      await Promise.all([client.close(), mcpServer.close()])
    }
  })
})
