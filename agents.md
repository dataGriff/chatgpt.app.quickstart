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

- This is a Node.js project with ES modules (`"type": "module"`)
- Dependencies: Model Context Protocol SDK, type validation with Zod
- Server runs in `server.js`
- UI widget in `public/todo-widget.html`

## Code Standards

- Follow the existing code style
- Keep commits focused and atomic
- Write clear, descriptive commit messages
- Test changes before committing
