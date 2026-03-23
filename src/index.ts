import { Hono } from 'hono'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPTransport } from '@hono/mcp'
import { z } from 'zod'

interface AlgoliaHit {
  title?: string
  url: string
  content?: string
  hierarchy?: {
    lvl0?: string
    lvl1?: string
    lvl2?: string
    lvl3?: string
  }
  _highlightResult?: {
    hierarchy?: {
      lvl1?: { value: string }
    }
  }
}

interface AlgoliaResponse {
  hits: AlgoliaHit[]
}

const app = new Hono<{ Bindings: CloudflareBindings }>()

const transport = new StreamableHTTPTransport()
let server: McpServer | null = null

function createServer(env: CloudflareBindings) {
  const server = new McpServer({ name: 'hono-docs', version: '1.0.0' })

  server.registerTool(
    'search',
    {
      description: 'Search Hono documentation',
      inputSchema: {
        query: z.string().describe('Search query'),
        limit: z.number().min(1).max(20).default(5).describe('Number of results')
      }
    },
    async ({ query, limit }) => {
      const response = await fetch(`https://${env.ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/hono/query`, {
        method: 'POST',
        headers: {
          'X-Algolia-API-Key': env.ALGOLIA_API_KEY,
          'X-Algolia-Application-Id': env.ALGOLIA_APP_ID,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, hitsPerPage: limit })
      })

      if (!response.ok) {
        return {
          content: [{ type: 'text' as const, text: `Search failed: ${response.status} ${response.statusText}` }]
        }
      }

      const data: AlgoliaResponse = await response.json()
      const cleanHighlight = (text: string) => text.replace(/<[^>]*>/g, '')

      const results = data.hits.map((hit) => {
        let title = hit.title
        if (!title && hit._highlightResult?.hierarchy?.lvl1) {
          title = cleanHighlight(hit._highlightResult.hierarchy.lvl1.value)
        }
        if (!title) {
          title = hit.hierarchy?.lvl1 || hit.hierarchy?.lvl0 || 'Untitled'
        }

        const hierarchyParts: string[] = []
        if (hit.hierarchy?.lvl0 && hit.hierarchy.lvl0 !== 'Documentation') {
          hierarchyParts.push(hit.hierarchy.lvl0)
        }
        if (hit.hierarchy?.lvl1 && hit.hierarchy.lvl1 !== title) {
          hierarchyParts.push(cleanHighlight(hit.hierarchy.lvl1))
        }
        if (hit.hierarchy?.lvl2) {
          hierarchyParts.push(cleanHighlight(hit.hierarchy.lvl2))
        }

        const urlPath = new URL(hit.url).pathname

        return { title, category: hierarchyParts.join(' > '), url: hit.url, path: urlPath }
      })

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ query, total: results.length, results }, null, 2) }]
      }
    }
  )

  server.registerTool(
    'docs',
    {
      description: 'Get Hono documentation content. Returns llms.txt if no path is provided.',
      inputSchema: { path: z.string().optional().describe('Documentation path (e.g., docs/concepts/motivation)') }
    },
    async ({ path }) => {
      let url: string
      if (!path) {
        url = 'https://hono.dev/llms.txt'
      } else {
        const normalizedPath = path.startsWith('/') ? path.slice(1) : path
        url = `https://raw.githubusercontent.com/honojs/website/refs/heads/main/${normalizedPath}.md`
      }

      const response = await fetch(url)
      if (!response.ok) {
        return {
          content: [
            { type: 'text' as const, text: `Failed to fetch documentation: ${response.status} ${response.statusText}` }
          ]
        }
      }

      const content = await response.text()
      return { content: [{ type: 'text' as const, text: content }] }
    }
  )

  return server
}

app.all('/mcp', async (c) => {
  if (!server || !server.isConnected()) {
    server = createServer(c.env)
    await server.connect(transport)
  }
  return transport.handleRequest(c)
})

export default app
