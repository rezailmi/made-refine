import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { store } from './store'

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'made-refine',
    version: '0.1.0',
  })

  server.tool('get_pending_edits', 'Return all pending visual edits and comments from the Made-Refine browser overlay', {}, async () => {
    const pending = store.getPending()
    return {
      content: [
        {
          type: 'text' as const,
          text: pending.length === 0
            ? 'No pending edits.'
            : JSON.stringify(pending, null, 2),
        },
      ],
    }
  })

  server.tool(
    'get_edit_details',
    'Get full structured data for a single visual edit or comment by ID',
    { id: z.string().describe('The annotation ID') },
    async ({ id }) => {
      const annotation = store.getById(id)
      if (!annotation) {
        return {
          content: [{ type: 'text' as const, text: `No annotation found with id: ${id}` }],
          isError: true,
        }
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(annotation, null, 2) }],
      }
    }
  )

  server.tool(
    'acknowledge_edit',
    'Mark an edit as acknowledged (agent is working on it)',
    { id: z.string().describe('The annotation ID') },
    async ({ id }) => {
      const success = store.updateStatus(id, 'acknowledged')
      return {
        content: [
          {
            type: 'text' as const,
            text: success ? `Acknowledged: ${id}` : `Not found: ${id}`,
          },
        ],
        isError: !success,
      }
    }
  )

  server.tool(
    'resolve_edit',
    'Mark an edit as applied/resolved',
    {
      id: z.string().describe('The annotation ID'),
      message: z.string().optional().describe('Optional message about what was done'),
    },
    async ({ id, message }) => {
      const success = store.updateStatus(id, 'applied')
      return {
        content: [
          {
            type: 'text' as const,
            text: success
              ? `Resolved: ${id}${message ? ` (${message})` : ''}`
              : `Not found: ${id}`,
          },
        ],
        isError: !success,
      }
    }
  )

  server.tool(
    'dismiss_edit',
    'Reject/dismiss an edit with an optional reason',
    {
      id: z.string().describe('The annotation ID'),
      reason: z.string().optional().describe('Reason for dismissal'),
    },
    async ({ id, reason }) => {
      const success = store.updateStatus(id, 'dismissed')
      return {
        content: [
          {
            type: 'text' as const,
            text: success
              ? `Dismissed: ${id}${reason ? ` (${reason})` : ''}`
              : `Not found: ${id}`,
          },
        ],
        isError: !success,
      }
    }
  )

  server.tool(
    'watch_edits',
    'Block until a new visual edit or comment arrives from the browser (hands-free mode)',
    {
      timeout_ms: z
        .number()
        .optional()
        .default(30000)
        .describe('Max time to wait in ms (default 30s)'),
    },
    async ({ timeout_ms }) => {
      const pending = store.getPending()
      if (pending.length > 0) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(pending, null, 2) }],
        }
      }

      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          unsubscribe()
          resolve({
            content: [{ type: 'text' as const, text: 'Timeout: no new edits arrived.' }],
          })
        }, timeout_ms)

        const unsubscribe = store.onUpdate((annotation) => {
          clearTimeout(timer)
          unsubscribe()
          resolve({
            content: [{ type: 'text' as const, text: JSON.stringify(annotation, null, 2) }],
          })
        })
      })
    }
  )

  server.tool(
    'list_all_annotations',
    'List all visual edits and comments, optionally filtered by status',
    {
      status: z
        .enum(['pending', 'acknowledged', 'applied', 'dismissed'])
        .optional()
        .describe('Filter by status'),
    },
    async ({ status }) => {
      let annotations = store.getAll()
      if (status) {
        annotations = annotations.filter((a) => a.status === status)
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: annotations.length === 0
              ? `No annotations${status ? ` with status: ${status}` : ''}.`
              : JSON.stringify(annotations, null, 2),
          },
        ],
      }
    }
  )

  return server
}
