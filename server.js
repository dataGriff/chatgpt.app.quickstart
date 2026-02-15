import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { TodoService } from "./services/todoService.js";
import { createTodoRoutes } from "./routes/todoRoutes.js";
import { createTodoServer } from "./mcp/todoTools.js";

const todoHtml = readFileSync("public/todo-widget.html", "utf8");
const dataFile = process.env.TODO_DATA_FILE ?? "data/todos.json";
const todoService = await TodoService.create(dataFile);
const port = Number(process.env.PORT ?? 8787);
const MCP_PATH = "/mcp";
const API_BASE = "/api/todos";

// Internal API call helper for MCP tools
// Makes direct calls to REST API logic without HTTP overhead
const callInternalApi = async (method, path, body = null) => {
  if (method === "GET" && path === "/api/todos") {
    return { ok: true, todos: todoService.list() };
  }

  if (method === "POST" && path === "/api/todos") {
    const title = body?.title?.trim?.();
    if (!title) {
      return { ok: false, error: "Missing or empty title" };
    }
    const todo = await todoService.add(title);
    return { ok: true, todo, todos: todoService.list() };
  }

  if (method === "POST" && path === "/api/todos/complete-by-index") {
    const index = body?.index;
    if (!Number.isInteger(index) || index < 1) {
      return { ok: false, error: "Invalid index" };
    }
    const result = await todoService.completeByIndex(index);
    if (!result.ok) {
      return { ok: false, error: "Invalid index" };
    }
    return { ok: true, todo: result.todo, todos: todoService.list() };
  }

  if (method === "POST" && path === "/api/todos/complete-by-title") {
    const searchTitle = body?.title?.trim?.();
    if (!searchTitle) {
      return { ok: false, error: "Missing search title" };
    }
    const result = await todoService.completeByTitle(searchTitle);
    if (!result.ok) {
      return { ok: false, error: "No match found" };
    }
    return { ok: true, todo: result.todo, todos: todoService.list() };
  }

  const apiIdMatch = path.match(/^\/api\/todos\/([^/]+)$/);
  if (apiIdMatch) {
    const id = apiIdMatch[1];

    if (method === "PUT") {
      const result = await todoService.completeById(id);
      if (!result.ok) {
        return { ok: false, error: `Todo ${id} not found` };
      }
      return { ok: true, todo: result.todo, todos: todoService.list() };
    }

    if (method === "DELETE") {
      const todo = todoService.list().find((t) => t.id === id);
      if (!todo) {
        return { ok: false, error: `Todo ${id} not found` };
      }
      todoService.todos = todoService.list().filter((t) => t.id !== id);
      await todoService.save();
      return { ok: true, todo, todos: todoService.list() };
    }
  }

  return { ok: false, error: "Not found" };
};

// Create REST API route handler
const handleTodoRoutes = createTodoRoutes(todoService, API_BASE);

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  // Handle CORS preflight for both API and MCP
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

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/plain" }).end("Todo MCP server");
    return;
  }

  // Try handling with REST API routes
  const handled = await handleTodoRoutes(req, res, url);
  if (handled) {
    return;
  }

  // MCP endpoint
  const MCP_METHODS = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && MCP_METHODS.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    const server = createTodoServer(todoHtml, callInternalApi);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode
      enableJsonResponse: true,
    });

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

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(
    `Todo server listening on http://localhost:${port}`
  );
  console.log(
    `  MCP endpoint: http://localhost:${port}${MCP_PATH}`
  );
  console.log(
    `  REST API: http://localhost:${port}${API_BASE}`
  );
});