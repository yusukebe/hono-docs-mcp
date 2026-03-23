# hono-docs-mcp

An MCP server built with Hono that provides search and retrieval of [Hono](https://hono.dev) documentation.

## Tools

### `search`

Search Hono documentation via Algolia.

- `query` (string, required) — Search query
- `limit` (number, optional, default: 5) — Number of results (1–20)

### `docs`

Fetch Hono documentation content as Markdown.

- `path` (string, optional) — Documentation path (e.g., `docs/concepts/motivation`)
- Returns `llms.txt` if no path is provided

## Setup

```sh
bun install
```

Create a `.env` file:

```sh
ALGOLIA_APP_ID=your_algolia_app_id
ALGOLIA_API_KEY=your_algolia_api_key
```

## Development

```sh
bun run dev
```

## Deploy

```sh
wrangler secret bulk .env
bun run deploy
```
