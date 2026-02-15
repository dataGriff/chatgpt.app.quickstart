# Building an MCP Server with REST API and UI Widget

This tutorial teaches you how to build a complete [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that integrates with ChatGPT, provides a REST API, and includes an interactive UI widget. We'll use the Todo MCP Server as our reference implementation, then show you how to adapt it for your own use cases.

## Table of Contents

1. [What You'll Build](#what-youll-build)
2. [Prerequisites](#prerequisites)
3. [Understanding the Architecture](#understanding-the-architecture)
4. [Step-by-Step Build Guide](#step-by-step-build-guide)
5. [Adapting for Your Use Case](#adapting-for-your-use-case)
6. [Best Practices](#best-practices)
7. [Testing and Deployment](#testing-and-deployment)

---

## What You'll Build

By the end of this tutorial, you'll understand how to create a system with:

- **MCP Tools** that AI assistants (like ChatGPT) can call via JSON-RPC
- **REST API** for standard HTTP/JSON integrations
- **Interactive UI Widget** that embeds in ChatGPT as an iframe
- **Shared Service Layer** ensuring consistent state across all interfaces
- **JSON File Persistence** for data storage

### Why This Architecture?

This architecture provides:
- **Dual Interface**: AI-native (MCP) + traditional (REST) access to the same data
- **Interactive UI**: Rich user experience beyond text-only chat
- **Separation of Concerns**: Clear layers (transport → tools → service → storage)
- **Template-Ready**: Easy to adapt for other capabilities (notes, calendar, CRM, etc.)

---

## Prerequisites

### Required Knowledge

- **JavaScript/Node.js**: Async/await, ES modules, HTTP servers
- **REST APIs**: HTTP methods, JSON, status codes
- **Basic TypeScript/Zod**: Input validation (patterns will be provided)

### Required Tools

```bash
# Node.js 18+ with ES modules support
node --version  # Should be v18 or higher

# npm for package management
npm --version

# curl or similar for testing
curl --version
```

### Key Dependencies

- `@modelcontextprotocol/sdk` — MCP protocol implementation
- `@modelcontextprotocol/ext-apps` — ChatGPT Apps extensions (widgets)
- `zod` — Schema validation

---

## Understanding the Architecture

### System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                         CLIENTS                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   ChatGPT   │  │  Todo Widget │  │ HTTP Client  │       │
│  │ (MCP Client)│  │  (iframe)    │  │  (curl/API)  │       │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘       │
└─────────┼────────────────┼──────────────────┼───────────────┘
          │ JSON-RPC       │ postMessage      │ REST
          │                │   JSON-RPC       │
┌─────────▼────────────────▼──────────────────▼───────────────┐
│                    HTTP SERVER (server.js)                   │
│                          port 8787                           │
│  ┌───────────────────┐              ┌────────────────────┐  │
│  │   MCP ENDPOINT    │              │    REST API        │  │
│  │     /mcp          │              │   /api/todos       │  │
│  │ ┌───────────────┐ │              │ ┌────────────────┐ │  │
│  │ │ McpServer     │ │              │ │ todoRoutes.js  │ │  │
│  │ │ + Transport   │ │              │ │ GET/POST/PUT/  │ │  │
│  │ │ + 6 Tools     │ │              │ │ DELETE handlers│ │  │
│  │ │ + 1 Resource  │ │              │ └────────────────┘ │  │
│  │ └───────┬───────┘ │              └──────────┬─────────┘  │
│  └─────────┼─────────┘                         │            │
└────────────┼───────────────────────────────────┼────────────┘
             │                                   │
         ┌───▼───────────────────────────────────▼───┐
         │         SERVICE LAYER                     │
         │       TodoService (todoService.js)        │
         │  ┌─────────────────────────────────────┐  │
         │  │ add() / list() / completeById()     │  │
         │  │ completeByIndex() / completeByTitle()│ │
         │  │ deleteById()                        │  │
         │  └─────────────┬───────────────────────┘  │
         └────────────────┼──────────────────────────┘
                          │
         ┌────────────────▼──────────────────────────┐
         │            STORAGE                        │
         │  ┌──────────────────┐  ┌────────────────┐│
         │  │  In-Memory Array │  │ data/todos.json││
         │  │  (this.todos)    │◄─┤  (persistent)  ││
         │  └──────────────────┘  └────────────────┘│
         └───────────────────────────────────────────┘
```

### Request Flow Examples

#### MCP Tool Call (from ChatGPT)
```
1. ChatGPT → POST /mcp with JSON-RPC: {"method": "tools/call", "params": {"name": "add_todo", ...}}
2. server.js → Creates McpServer + Transport per request
3. McpServer → Routes to add_todo tool handler
4. Tool Handler → Calls todoService.add(title)
5. TodoService → Saves to memory + disk
6. Response → Returns {tasks: [...]} with structured content
7. ChatGPT → Displays todo list in widget
```

#### REST API Call (from curl)
```
1. curl → POST /api/todos with JSON: {"title": "Buy milk"}
2. server.js → Routes to todoRoutes handler
3. todoRoutes → Parses JSON body, calls todoService.add(title)
4. TodoService → Saves to memory + disk
5. Response → Returns {ok: true, todo: {...}}
```

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Stateless MCP Server** | New server per request; simpler than session management |
| **Shared Service Layer** | Single source of truth for business logic |
| **Atomic Save Pattern** | Write to disk *before* updating in-memory state |
| **No Internal HTTP** | MCP tools call service directly (not via REST) |
| **Zod Schemas** | Type-safe input validation for MCP tools |

---

## Step-by-Step Build Guide

### Step 1: Project Setup

```bash
# Create project directory
mkdir my-mcp-server
cd my-mcp-server

# Initialize package.json
npm init -y

# Install dependencies
npm install @modelcontextprotocol/sdk @modelcontextprotocol/ext-apps zod

# Set to ES modules
npm pkg set type=module
```

Create the directory structure:
```bash
mkdir -p data mcp routes services public docs
touch server.js
```

### Step 2: Build the Service Layer

**File: `services/todoService.js`**

The service layer contains all business logic and data persistence. This is the single source of truth.

```javascript
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export class TodoService {
  constructor(dataFile, todos, nextId) {
    this.dataFile = dataFile;      // Path to JSON file
    this.todos = todos;             // In-memory array
    this.nextId = nextId;           // Auto-increment ID
  }

  // Factory method: load from file or create new
  static async create(dataFile) {
    const resolvedPath = resolve(process.cwd(), dataFile);
    try {
      const contents = await readFile(resolvedPath, "utf8");
      const parsed = JSON.parse(contents);
      const todos = Array.isArray(parsed.todos) ? parsed.todos : [];
      const nextId = Number.isInteger(parsed.nextId)
        ? parsed.nextId
        : todos.length + 1;
      return new TodoService(resolvedPath, todos, nextId);
    } catch (error) {
      // File doesn't exist — create new
      if (error?.code !== "ENOENT") throw error;
      await mkdir(dirname(resolvedPath), { recursive: true });
      const service = new TodoService(resolvedPath, [], 1);
      await service.save();
      return service;
    }
  }

  list() {
    return this.todos;
  }

  async add(title) {
    const todo = { id: `todo-${this.nextId++}`, title, completed: false };
    const newTodos = [...this.todos, todo];
    await this.#saveAtomically(newTodos);
    return todo;
  }

  async completeById(id) {
    const exists = this.todos.find((task) => task.id === id);
    if (!exists) return { ok: false, reason: "not_found" };
    if (exists.completed) return { ok: true, todo: exists };

    const newTodos = this.todos.map((task) =>
      task.id === id ? { ...task, completed: true } : task
    );
    await this.#saveAtomically(newTodos);
    const updated = this.todos.find((task) => task.id === id);
    return { ok: true, todo: updated };
  }

  async deleteById(id) {
    const exists = this.todos.find((task) => task.id === id);
    if (!exists) return { ok: false, reason: "not_found" };

    const newTodos = this.todos.filter((task) => task.id !== id);
    await this.#saveAtomically(newTodos);
    return { ok: true };
  }

  // Atomic save: write to disk BEFORE updating memory
  async #saveAtomically(newTodos) {
    await this.save(newTodos);
    this.todos = newTodos;
  }

  async save(todosToSave = this.todos) {
    const data = JSON.stringify(
      { todos: todosToSave, nextId: this.nextId },
      null,
      2
    );
    await writeFile(this.dataFile, data, "utf8");
  }
}
```

**Key Pattern: Atomic Save**
```javascript
// ✅ CORRECT: Save to disk first
await this.save(newTodos);
this.todos = newTodos;

// ❌ WRONG: Update memory first (lose data if save fails)
this.todos = newTodos;
await this.save(newTodos);
```

### Step 3: Build the REST API Layer

**File: `routes/todoRoutes.js`**

Standard HTTP/JSON API with CRUD operations.

```javascript
import { parse } from "node:url";

const MAX_BODY_SIZE = 1024 * 1024; // 1 MB
const JSON_MIME = "application/json";

// Parse JSON body from request stream
async function parseJsonBody(req, maxSize) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxSize) {
        req.destroy();
        reject(new Error("Body too large"));
        return;
      }
      data += chunk.toString();
    });

    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

export function createTodoRoutes(todoService, basePath) {
  return async function handleTodoRoutes(req, res, url) {
    const { pathname } = url;

    // CORS headers for all responses
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": JSON_MIME,
    };

    // GET /api/todos — list all
    if (req.method === "GET" && pathname === basePath) {
      const todos = todoService.list();
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({ todos }));
      return true;
    }

    // POST /api/todos — add new
    if (req.method === "POST" && pathname === basePath) {
      try {
        const body = await parseJsonBody(req, MAX_BODY_SIZE);
        if (!body.title || typeof body.title !== "string") {
          res.writeHead(400, corsHeaders);
          res.end(JSON.stringify({ ok: false, error: "Missing title" }));
          return true;
        }

        const todo = await todoService.add(body.title.trim());
        res.writeHead(201, corsHeaders);
        res.end(JSON.stringify({ ok: true, todo }));
      } catch (error) {
        res.writeHead(400, corsHeaders);
        res.end(JSON.stringify({ ok: false, error: error.message }));
      }
      return true;
    }

    // PUT /api/todos/:id — complete by ID
    const completeMatcher = new RegExp(`^${basePath}/([^/]+)$`);
    const completeMatch = pathname.match(completeMatcher);
    if (req.method === "PUT" && completeMatch) {
      const id = completeMatch[1];
      const result = await todoService.completeById(id);

      if (!result.ok) {
        res.writeHead(404, corsHeaders);
        res.end(JSON.stringify({ ok: false, error: "Not found" }));
        return true;
      }

      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({ ok: true, todo: result.todo }));
      return true;
    }

    // DELETE /api/todos/:id — delete by ID
    const deleteMatch = pathname.match(completeMatcher);
    if (req.method === "DELETE" && deleteMatch) {
      const id = deleteMatch[1];
      const result = await todoService.deleteById(id);

      if (!result.ok) {
        res.writeHead(404, corsHeaders);
        res.end(JSON.stringify({ ok: false, error: "Not found" }));
        return true;
      }

      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({ ok: true }));
      return true;
    }

    // Not handled by this router
    return false;
  };
}
```

### Step 4: Build the MCP Tools Layer

**File: `mcp/todoTools.js`**

Register MCP tools that ChatGPT can call. Each tool calls the service layer directly.

```javascript
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Zod schemas for input validation
const addTodoInputSchema = {
  title: z.string().min(1),
};

const completeTodoInputSchema = {
  id: z.string().min(1),
};

const deleteTodoInputSchema = {
  id: z.string().min(1),
};

// Helper: format response with structured content
const replyWithTodos = (message, tasks) => ({
  content: message ? [{ type: "text", text: message }] : [],
  structuredContent: { tasks },
});

/**
 * Creates an MCP server with todo tools registered.
 * @param {string} todoHtml - HTML content for the widget
 * @param {TodoService} todoService - Service instance
 */
export function createTodoServer(todoHtml, todoService) {
  const server = new McpServer({ name: "todo-app", version: "0.1.0" });

  // Register the UI widget as an app resource
  registerAppResource(
    server,
    "todo-widget",
    "ui://widget/todo.html",
    {},
    async () => ({
      contents: [
        {
          uri: "ui://widget/todo.html",
          mimeType: RESOURCE_MIME_TYPE,
          text: todoHtml,
        },
      ],
    })
  );

  // Tool: add_todo
  registerAppTool(
    server,
    "add_todo",
    {
      title: "Add todo",
      description: "Creates a todo item with the given title.",
      inputSchema: addTodoInputSchema,
      _meta: {
        ui: { resourceUri: "ui://widget/todo.html" },
      },
    },
    async ({ title }) => {
      const todo = await todoService.add(title.trim());
      return replyWithTodos(`Added "${todo.title}".`, todoService.list());
    }
  );

  // Tool: complete_todo
  registerAppTool(
    server,
    "complete_todo",
    {
      title: "Complete todo",
      description: "Marks a todo as done by id.",
      inputSchema: completeTodoInputSchema,
      _meta: {
        ui: { resourceUri: "ui://widget/todo.html" },
      },
    },
    async ({ id }) => {
      const result = await todoService.completeById(id);
      if (!result.ok) {
        return replyWithTodos("Todo not found.", todoService.list());
      }
      return replyWithTodos(
        `Completed "${result.todo.title}".`,
        todoService.list()
      );
    }
  );

  // Tool: delete_todo
  registerAppTool(
    server,
    "delete_todo",
    {
      title: "Delete todo",
      description: "Deletes a todo by id.",
      inputSchema: deleteTodoInputSchema,
      _meta: {
        ui: { resourceUri: "ui://widget/todo.html" },
      },
    },
    async ({ id }) => {
      const result = await todoService.deleteById(id);
      if (!result.ok) {
        return replyWithTodos("Todo not found.", todoService.list());
      }
      return replyWithTodos("Deleted todo.", todoService.list());
    }
  );

  // Tool: list_todos
  registerAppTool(
    server,
    "list_todos",
    {
      title: "List todos",
      description: "Returns all todos.",
      inputSchema: {},
      _meta: {
        ui: { resourceUri: "ui://widget/todo.html" },
      },
    },
    async () => {
      return replyWithTodos(null, todoService.list());
    }
  );

  return server;
}
```

**Key Pattern: Structured Content**
```javascript
// Return both text message and structured data
return {
  content: [{ type: "text", text: "Added todo" }],
  structuredContent: { tasks: [...] }  // Powers the widget
};
```

### Step 5: Build the HTTP Server

**File: `server.js`**

The main entry point that routes requests to MCP or REST handlers.

```javascript
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { TodoService } from "./services/todoService.js";
import { createTodoRoutes } from "./routes/todoRoutes.js";
import { createTodoServer } from "./mcp/todoTools.js";

// Load widget HTML
const todoHtml = readFileSync("public/todo-widget.html", "utf8");

// Configuration
const dataFile = process.env.TODO_DATA_FILE ?? "data/todos.json";
const port = Number(process.env.PORT ?? 8787);
const MCP_PATH = "/mcp";
const API_BASE = "/api/todos";

// Initialize service
const todoService = await TodoService.create(dataFile);

// Create REST API handler
const handleTodoRoutes = createTodoRoutes(todoService, API_BASE);

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    res.end();
    return;
  }

  // Health check
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("Todo MCP server");
    return;
  }

  // Try REST API routes
  const handled = await handleTodoRoutes(req, res, url);
  if (handled) return;

  // MCP endpoint (stateless mode)
  const MCP_METHODS = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && MCP_METHODS.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    // Create new server + transport per request
    const server = createTodoServer(todoHtml, todoService);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
      enableJsonResponse: true,
    });

    // Cleanup on request end
    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.writeHead(500).end("Internal server error");
      }
    }
    return;
  }

  // 404
  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`MCP endpoint: http://localhost:${port}${MCP_PATH}`);
  console.log(`REST API: http://localhost:${port}${API_BASE}`);
});
```

**Key Pattern: Stateless MCP Server**
```javascript
// Create NEW server + transport per request
const server = createTodoServer(todoHtml, todoService);
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,  // stateless mode
  enableJsonResponse: true,
});

// Cleanup when request ends
res.on("close", () => {
  transport.close();
  server.close();
});
```

### Step 6: Create the UI Widget

**File: `public/todo-widget.html`**

Simple interactive HTML widget that communicates with the MCP server via `postMessage`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Todo Widget</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 16px;
      margin: 0;
    }
    .todo-list { list-style: none; padding: 0; }
    .todo-item {
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .todo-item.completed { opacity: 0.6; text-decoration: line-through; }
    button {
      padding: 8px 16px;
      background: #0066cc;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover { background: #0052a3; }
    button.delete { background: #dc3545; }
    button.delete:hover { background: #c82333; }
    input {
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      flex: 1;
    }
  </style>
</head>
<body>
  <div id="app">
    <div style="display: flex; gap: 8px; margin-bottom: 16px;">
      <input id="newTodo" type="text" placeholder="What needs to be done?" />
      <button onclick="addTodo()">Add</button>
    </div>
    <ul id="todoList" class="todo-list"></ul>
  </div>

  <script>
    // MCP communication via postMessage
    function callTool(name, args) {
      window.parent.postMessage({
        type: "mcp_call_tool_request",
        data: { method: "tools/call", params: { name, arguments: args } }
      }, "*");
    }

    // Handle incoming messages from parent (ChatGPT)
    window.addEventListener("message", (event) => {
      if (event.data?.type === "mcp_structured_content") {
        const tasks = event.data.structuredContent?.tasks || [];
        renderTodos(tasks);
      }
    });

    function renderTodos(tasks) {
      const list = document.getElementById("todoList");
      list.innerHTML = tasks.map(task => `
        <li class="todo-item ${task.completed ? 'completed' : ''}">
          <input type="checkbox" 
                 ${task.completed ? 'checked' : ''} 
                 onchange="completeTodo('${task.id}')" />
          <span style="flex: 1;">${escapeHtml(task.title)}</span>
          <button class="delete" onclick="deleteTodo('${task.id}')">Delete</button>
        </li>
      `).join("");
    }

    function addTodo() {
      const input = document.getElementById("newTodo");
      const title = input.value.trim();
      if (title) {
        callTool("add_todo", { title });
        input.value = "";
      }
    }

    function completeTodo(id) {
      callTool("complete_todo", { id });
    }

    function deleteTodo(id) {
      callTool("delete_todo", { id });
    }

    function escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    // Load initial todos
    callTool("list_todos", {});
  </script>
</body>
</html>
```

**Key Pattern: Widget Communication**
```javascript
// Send tool call to parent (ChatGPT)
window.parent.postMessage({
  type: "mcp_call_tool_request",
  data: { method: "tools/call", params: { name: "add_todo", arguments: {title: "..."} } }
}, "*");

// Receive structured content from parent
window.addEventListener("message", (event) => {
  if (event.data?.type === "mcp_structured_content") {
    const tasks = event.data.structuredContent?.tasks || [];
    renderTodos(tasks);
  }
});
```

### Step 7: Test the System

```bash
# Start the server
node server.js

# In another terminal, test the REST API
curl http://localhost:8787/api/todos

curl -X POST http://localhost:8787/api/todos \
  -H 'Content-Type: application/json' \
  -d '{"title": "Test todo"}'

curl -X PUT http://localhost:8787/api/todos/todo-1

curl -X DELETE http://localhost:8787/api/todos/todo-1
```

For MCP testing, you'll need to register the server with ChatGPT using the Apps SDK.

---

## Adapting for Your Use Case

### Example 1: Notes App

Let's adapt this for a notes application.

#### 1. Update the Service Layer

**File: `services/noteService.js`**

```javascript
export class NoteService {
  constructor(dataFile, notes, nextId) {
    this.dataFile = dataFile;
    this.notes = notes;
    this.nextId = nextId;
  }

  static async create(dataFile) {
    // ... similar to TodoService.create()
  }

  async createNote(title, content) {
    const note = {
      id: `note-${this.nextId++}`,
      title,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const newNotes = [...this.notes, note];
    await this.#saveAtomically(newNotes);
    return note;
  }

  async updateNote(id, updates) {
    const exists = this.notes.find((n) => n.id === id);
    if (!exists) return { ok: false, reason: "not_found" };

    const newNotes = this.notes.map((n) =>
      n.id === id
        ? { ...n, ...updates, updatedAt: new Date().toISOString() }
        : n
    );
    await this.#saveAtomically(newNotes);
    return { ok: true, note: newNotes.find((n) => n.id === id) };
  }

  searchNotes(query) {
    const lowerQuery = query.toLowerCase();
    return this.notes.filter(
      (n) =>
        n.title.toLowerCase().includes(lowerQuery) ||
        n.content.toLowerCase().includes(lowerQuery)
    );
  }

  // ... #saveAtomically(), save(), delete(), etc.
}
```

#### 2. Update MCP Tools

**File: `mcp/noteTools.js`**

```javascript
const createNoteInputSchema = {
  title: z.string().min(1),
  content: z.string(),
};

const updateNoteInputSchema = {
  id: z.string().min(1),
  title: z.string().optional(),
  content: z.string().optional(),
};

const searchNotesInputSchema = {
  query: z.string().min(1),
};

export function createNoteServer(noteHtml, noteService) {
  const server = new McpServer({ name: "notes-app", version: "0.1.0" });

  registerAppResource(server, "note-widget", "ui://widget/notes.html", {}, async () => ({
    contents: [{ uri: "ui://widget/notes.html", mimeType: RESOURCE_MIME_TYPE, text: noteHtml }],
  }));

  registerAppTool(
    server,
    "create_note",
    {
      title: "Create note",
      description: "Creates a new note",
      inputSchema: createNoteInputSchema,
      _meta: { ui: { resourceUri: "ui://widget/notes.html" } },
    },
    async ({ title, content }) => {
      const note = await noteService.createNote(title, content);
      return {
        content: [{ type: "text", text: `Created note "${note.title}".` }],
        structuredContent: { notes: noteService.notes },
      };
    }
  );

  registerAppTool(
    server,
    "update_note",
    {
      title: "Update note",
      description: "Updates an existing note",
      inputSchema: updateNoteInputSchema,
      _meta: { ui: { resourceUri: "ui://widget/notes.html" } },
    },
    async ({ id, title, content }) => {
      const result = await noteService.updateNote(id, { title, content });
      if (!result.ok) {
        return {
          content: [{ type: "text", text: "Note not found." }],
          structuredContent: { notes: noteService.notes },
        };
      }
      return {
        content: [{ type: "text", text: `Updated "${result.note.title}".` }],
        structuredContent: { notes: noteService.notes },
      };
    }
  );

  registerAppTool(
    server,
    "search_notes",
    {
      title: "Search notes",
      description: "Search notes by title or content",
      inputSchema: searchNotesInputSchema,
      _meta: { ui: { resourceUri: "ui://widget/notes.html" } },
    },
    async ({ query }) => {
      const results = noteService.searchNotes(query);
      return {
        content: [{ type: "text", text: `Found ${results.length} notes.` }],
        structuredContent: { notes: results },
      };
    }
  );

  // Add list_notes, delete_note, etc.

  return server;
}
```

### Example 2: Event Calendar App

#### 1. Service Layer

**File: `services/eventService.js`**

```javascript
export class EventService {
  async addEvent(title, startTime, endTime, location) {
    const event = {
      id: `event-${this.nextId++}`,
      title,
      startTime,
      endTime,
      location,
      attendees: [],
    };
    const newEvents = [...this.events, event];
    await this.#saveAtomically(newEvents);
    return event;
  }

  getEventsInRange(startDate, endDate) {
    return this.events.filter((e) => {
      const eventStart = new Date(e.startTime);
      return eventStart >= startDate && eventStart <= endDate;
    });
  }

  async addAttendee(eventId, email) {
    const event = this.events.find((e) => e.id === eventId);
    if (!event) return { ok: false, reason: "not_found" };

    const newEvents = this.events.map((e) =>
      e.id === eventId
        ? { ...e, attendees: [...e.attendees, email] }
        : e
    );
    await this.#saveAtomically(newEvents);
    return { ok: true, event: newEvents.find((e) => e.id === eventId) };
  }
}
```

#### 2. MCP Tools

```javascript
const addEventInputSchema = {
  title: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().optional(),
};

registerAppTool(
  server,
  "add_event",
  {
    title: "Add event",
    description: "Adds an event to the calendar",
    inputSchema: addEventInputSchema,
    _meta: { ui: { resourceUri: "ui://widget/calendar.html" } },
  },
  async ({ title, startTime, endTime, location }) => {
    const event = await eventService.addEvent(title, startTime, endTime, location);
    return {
      content: [{ type: "text", text: `Added event "${event.title}".` }],
      structuredContent: { events: eventService.events },
    };
  }
);
```

### Adaptation Checklist

When adapting this architecture for your use case:

- [ ] **Define your data model** (what properties does each entity have?)
- [ ] **Create Service class** with CRUD operations
- [ ] **Implement atomic save pattern** (save to disk before updating memory)
- [ ] **Define Zod schemas** for input validation
- [ ] **Register MCP tools** with clear names and descriptions
- [ ] **Return structured content** for the widget to display
- [ ] **Create REST API routes** (optional, but recommended for testing)
- [ ] **Build UI widget** with `postMessage` communication
- [ ] **Update server.js** to use your service and tools
- [ ] **Test with curl** before integrating with ChatGPT

---

## Best Practices

### 1. Data Integrity

**Always save atomically:**
```javascript
// ✅ CORRECT
async #saveAtomically(newState) {
  await this.save(newState);  // Disk first
  this.state = newState;       // Memory second
}

// ❌ WRONG
async updateState(newState) {
  this.state = newState;
  await this.save();  // If this fails, memory is corrupt
}
```

### 2. Input Validation

**Use Zod schemas for MCP tools:**
```javascript
const inputSchema = {
  email: z.string().email(),
  age: z.number().int().min(0).max(120),
  role: z.enum(["admin", "user", "guest"]),
};

registerAppTool(server, "tool_name", { inputSchema }, handler);
```

**Validate in REST API handlers:**
```javascript
if (!body.email || typeof body.email !== "string") {
  res.writeHead(400, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "Invalid email" }));
  return;
}
```

### 3. Error Handling

**Service layer returns result objects:**
```javascript
async deleteById(id) {
  const exists = this.items.find((item) => item.id === id);
  if (!exists) return { ok: false, reason: "not_found" };
  
  // ... perform deletion
  return { ok: true };
}
```

**MCP tool handlers check results:**
```javascript
async ({ id }) => {
  const result = await service.deleteById(id);
  if (!result.ok) {
    return replyWithData("Item not found.", service.list());
  }
  return replyWithData("Deleted item.", service.list());
}
```

### 4. Structured Content

**Always return structured data for widgets:**
```javascript
return {
  content: [{ type: "text", text: "Human-readable message" }],
  structuredContent: { items: service.list() }  // Powers the widget
};
```

### 5. CORS Configuration

**Enable CORS for all endpoints:**
```javascript
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "content-type, mcp-session-id");
res.setHeader("Access-Control-Expose-Headers": "Mcp-Session-Id");
```

### 6. Security Considerations

- **Body size limits** to prevent memory exhaustion
- **Input sanitization** for user-provided strings (use Zod)
- **Path traversal protection** if accepting file paths
- **Rate limiting** for production deployments
- **Authentication** if exposing sensitive data

### 7. Code Organization

```
my-mcp-server/
├── server.js              # HTTP server + routing
├── mcp/
│   └── toolsName.js      # MCP tools registration
├── routes/
│   └── routesName.js     # REST API handlers
├── services/
│   └── serviceName.js    # Business logic + persistence
├── public/
│   └── widget.html       # UI widget
├── data/
│   └── state.json        # Persistent storage (gitignore this)
├── docs/
│   └── *.md              # Documentation
└── package.json
```

---

## Testing and Deployment

### Local Testing

#### 1. REST API Testing with curl

```bash
# List items
curl http://localhost:8787/api/items

# Create item
curl -X POST http://localhost:8787/api/items \
  -H 'Content-Type: application/json' \
  -d '{"name": "Test Item"}'

# Update item
curl -X PUT http://localhost:8787/api/items/item-1 \
  -H 'Content-Type: application/json' \
  -d '{"name": "Updated Name"}'

# Delete item
curl -X DELETE http://localhost:8787/api/items/item-1
```

#### 2. MCP Testing with ChatGPT Apps SDK

Follow the [ChatGPT Apps Quickstart](https://developers.openai.com/apps-sdk/quickstart/):

1. Install the Apps SDK CLI
2. Register your server: `chatgpt-apps register http://localhost:8787/mcp`
3. Open ChatGPT and test tool calls
4. Check the widget renders correctly

#### 3. Automated Testing

**Example test with Node.js:**
```javascript
import assert from "node:assert/strict";
import { TodoService } from "./services/todoService.js";

// Test service layer
const service = await TodoService.create("test-data.json");
const todo = await service.add("Test todo");
assert.equal(todo.title, "Test todo");
assert.equal(todo.completed, false);

const result = await service.completeById(todo.id);
assert.equal(result.ok, true);
assert.equal(result.todo.completed, true);

console.log("✅ All tests passed");
```

### Production Deployment

#### Environment Variables

```bash
export PORT=8787
export TODO_DATA_FILE=/var/data/todos.json
export NODE_ENV=production
```

#### Process Management

Use a process manager like PM2:
```bash
npm install -g pm2
pm2 start server.js --name mcp-server
pm2 save
pm2 startup
```

#### Docker Deployment

**Dockerfile:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8787
CMD ["node", "server.js"]
```

**Build and run:**
```bash
docker build -t mcp-server .
docker run -p 8787:8787 -v $(pwd)/data:/app/data mcp-server
```

#### Monitoring

```javascript
// Add to server.js
httpServer.on("error", (error) => {
  console.error("Server error:", error);
  // Send to your monitoring service
});

// Log all requests
const httpServer = createServer(async (req, res) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  // ... rest of handler
});
```

---

## Next Steps

1. **Read the Docs**: Check `docs/architecture.md`, `docs/api-reference.md`, and `docs/mcp-tools.md`
2. **Explore the Code**: Review the complete implementation in this repository
3. **Build Your Own**: Adapt this template for your specific use case
4. **Join the Community**: [MCP Specification](https://spec.modelcontextprotocol.io/)
5. **Deploy**: Follow the deployment guide above for production hosting

## Additional Resources

- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [ChatGPT Apps SDK Documentation](https://developers.openai.com/apps-sdk/)
- [Zod Documentation](https://zod.dev/)
- [Node.js HTTP Server Guide](https://nodejs.org/en/docs/guides/anatomy-of-an-http-transaction/)

---

## Troubleshooting

### Widget not rendering
- Check that `RESOURCE_MIME_TYPE` is used for widget content
- Verify `_meta.ui.resourceUri` points to correct widget resource
- Check browser console for postMessage errors

### MCP tools not found
- Ensure tools are registered before `server.connect(transport)`
- Check tool names match exactly in call requests
- Verify Zod schemas don't reject valid inputs

### Data not persisting
- Check file permissions on data directory
- Verify atomic save pattern (disk before memory)
- Look for uncaught exceptions during save

### CORS errors
- Add CORS headers to all responses (including errors)
- Handle OPTIONS preflight requests
- Check `Access-Control-Expose-Headers` for custom headers

---

**Happy building! 🚀**
