# AI Agent Directives

## Conventional Commits

All commits to this repository must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (formatting, semicolons, etc.)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to build process, dependencies, or other non-code items
- **ci**: Changes to CI/CD configuration files and scripts

### Examples

- `feat: add support for environment variables`
- `fix: correct calculation in widget initialization`
- `docs: update README with setup instructions`
- `chore: upgrade dependencies to latest versions`

### Scope

Include a scope when the change affects a specific part of the codebase:
- `feat(server): add MCP endpoint`
- `fix(widget): resolve memory leak in event handler`

## Project Guidelines

- This is a template Todo MCP Server built with Node.js and ES modules (`"type": "module"`)
- Dependencies: `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`, `zod`
- Entry point: `server.js` — HTTP server with request routing
- MCP tools: `mcp/todoTools.js` — tool and resource registration
- REST API: `routes/todoRoutes.js` — HTTP route handlers
- Business logic: `services/todoService.js` — TodoService class
- UI widget: `public/todo-widget.html` — interactive HTML/JS widget
- Data: `data/todos.json` — persisted todo state (gitignored)
- Docs: `docs/` — architecture, API reference, MCP tools, contributing

## Code Standards

- All data mutations go through `TodoService` methods — never mutate `todoService.todos` directly
- MCP tools call `TodoService` directly — no internal HTTP simulation
- Zod schemas handle MCP input validation — don't duplicate checks in tool handlers
- Atomic save pattern — write to disk before updating in-memory state
- Body size limit (1 MB) on all POST endpoints
- Follow the existing code style
- Keep commits focused and atomic
- Write clear, descriptive commit messages
- Test changes before committing (`node server.js` + curl testing)
