import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createHttpServer } from './http-server'
import { createMcpServer } from './server'

const PORT = 4747
const HOST = process.env.MADE_REFINE_MCP_HOST || '127.0.0.1'

async function main() {
  const httpServer = createHttpServer()
  httpServer.listen(PORT, HOST, () => {
    console.error(`[made-refine-mcp] HTTP server listening on http://${HOST}:${PORT}`)
  })

  const mcpServer = createMcpServer()
  const transport = new StdioServerTransport()
  await mcpServer.connect(transport)
  console.error('[made-refine-mcp] MCP server connected via stdio')
}

main().catch((err) => {
  console.error('[made-refine-mcp] Fatal error:', err)
  process.exit(1)
})
