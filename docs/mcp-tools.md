# MCP Tools Reference

The MCP server exposes 6 tools and 1 app resource at the `/mcp` endpoint. Tools are registered using the `@modelcontextprotocol/sdk` and `@modelcontextprotocol/ext-apps` packages.

All tools return:

- `content` — a text message describing what happened
- `structuredContent.tasks` — the full todo list for UI rendering

---

## Tools

### `add_todo`

Creates a new todo item.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | `string` | Yes (min 1 char) | The todo title |

**Example response**

```json
{
  "content": [{ "type": "text", "text": "Added \"Buy groceries\"." }],
  "structuredContent": { "tasks": [ ... ] }
}
```

---

### `list_todos`

Returns all todos with a summary count.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| *(none)* | — | — | — |

**Example response**

```json
{
  "content": [{ "type": "text", "text": "You have 3 tasks (1 completed, 2 remaining)" }],
  "structuredContent": { "tasks": [ ... ] }
}
```

---

### `complete_todo`

Marks a todo as done by its ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes (min 1 char) | The todo ID (e.g., `"todo-1"`) |

---

### `complete_todo_by_index`

Marks a todo as done by its position in the list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `index` | `integer` | Yes (min 1) | 1-based position (1 = first task) |

---

### `complete_todo_by_title`

Marks a todo as done by searching for a matching title (partial, case-insensitive).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | `string` | Yes (min 1 char) | Search text to match against todo titles |

---

### `delete_completed`

Removes all completed todos from the list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| *(none)* | — | — | — |

---

## App Resource

### `todo-widget`

An interactive HTML/JS widget rendered in the ChatGPT UI as an iframe.

| Property | Value |
|----------|-------|
| URI | `ui://widget/todo.html` |
| MIME type | MCP Apps resource type |

The widget communicates with the MCP server via the [MCP Apps bridge protocol](https://github.com/nicholasgriffintn/mcp-apps) — JSON-RPC messages over `postMessage`. It supports:

- Adding todos via a form
- Completing todos via checkboxes
- Refreshing the list
- Clearing completed todos

Tools are linked to the widget via `_meta.ui.resourceUri`, so the widget is shown alongside tool results in the ChatGPT UI.

---

## Input Validation

All tool inputs are validated by [Zod](https://zod.dev/) schemas before the handler runs. The MCP SDK enforces these schemas automatically — invalid inputs are rejected with a protocol-level error before reaching tool code.

| Tool | Schema |
|------|--------|
| `add_todo` | `{ title: z.string().min(1) }` |
| `complete_todo` | `{ id: z.string().min(1) }` |
| `complete_todo_by_index` | `{ index: z.number().int().min(1) }` |
| `complete_todo_by_title` | `{ title: z.string().min(1) }` |
| `list_todos` | `{}` |
| `delete_completed` | `{}` |

---

## Transport

The MCP endpoint uses `StreamableHTTPServerTransport` in **stateless mode** (`sessionIdGenerator: undefined`). A new `McpServer` instance is created per request because the SDK only supports one transport connection per server instance.
