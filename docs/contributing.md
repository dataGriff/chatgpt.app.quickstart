# Contributing

## Getting Started

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Start the server: `node server.js`
4. The server runs at `http://localhost:8787`

## Project Structure

```
server.js              → HTTP server & request routing
mcp/todoTools.js       → MCP tool & resource definitions
routes/todoRoutes.js   → REST API handlers
services/todoService.js → Business logic & persistence
public/todo-widget.html → Interactive UI widget
```

## Code Standards

- **ES modules** — the project uses `"type": "module"` (use `import`/`export`, not `require`)
- **No framework** — raw `node:http` to keep the template minimal
- **Zod schemas** — all MCP tool inputs are validated via Zod; don't duplicate validation in handlers
- **Service layer** — all data mutations go through `TodoService` methods; never mutate `todoService.todos` directly
- **Atomic save** — `TodoService` writes to disk before updating in-memory state

## Conventional Commits

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>
```

### Types

| Type | Use for |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, semicolons, etc. |
| `refactor` | Code change that isn't a fix or feature |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `chore` | Build process, dependencies, tooling |
| `ci` | CI/CD changes |

### Examples

```
feat: add delete_completed MCP tool
fix(service): return updated todo after completion
docs: add API reference
refactor(routes): extract body parser with size limit
```

### Scope

Use a scope when the change targets a specific area:

```
feat(server): add MCP endpoint
fix(widget): resolve memory leak in event handler
```

## Pull Requests

- Keep PRs focused and atomic — one logical change per PR
- Write a clear description of what and why
- Test changes before submitting (`node server.js` + manual curl/widget testing)
- Ensure the server starts without errors

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8787` | Server listen port |
| `TODO_DATA_FILE` | `data/todos.json` | Path to the data file |
