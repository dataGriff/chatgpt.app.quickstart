import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { TodoService } from "./services/todoService.js";

const todoHtml = readFileSync("public/todo-widget.html", "utf8");

const addTodoInputSchema = {
  title: z.string().min(1),
};

const completeTodoInputSchema = {
  id: z.string().min(1),
};

const completeTodoByIndexInputSchema = {
  index: z.number().int().min(1),
};

const completeTodoByTitleInputSchema = {
  title: z.string().min(1),
};

const dataFile = process.env.TODO_DATA_FILE ?? "data/todos.json";
const todoService = await TodoService.create(dataFile);

const replyWithTodos = (message, tasks) => ({
  content: message ? [{ type: "text", text: message }] : [],
  structuredContent: { tasks },
});

function createTodoServer() {
  const server = new McpServer({ name: "todo-app", version: "0.1.0" });

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
    async (args) => {
      const title = args?.title?.trim?.() ?? "";
      if (!title) return replyWithTodos("Missing title.", todoService.list());
      const todo = await todoService.add(title);
      return replyWithTodos(`Added "${todo.title}".`, todoService.list());
    }
  );

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
    async (args) => {
      const id = args?.id;
      if (!id) return replyWithTodos("Missing todo id.", todoService.list());
      const result = await todoService.completeById(id);
      if (!result.ok) {
        return replyWithTodos(`Todo ${id} was not found.`, todoService.list());
      }

      return replyWithTodos(
        `Completed "${result.todo.title}".`,
        todoService.list()
      );
    }
  );

  registerAppTool(
    server,
    "list_todos",
    {
      title: "List todos",
      description: "Returns a list of all todos with their IDs and completion status.",
      inputSchema: {},
      _meta: {
        ui: { resourceUri: "ui://widget/todo.html" },
      },
    },
    async () => {
      const list = todoService.list();
      if (list.length === 0) {
        return replyWithTodos("No todos yet.", list);
      }
      const completed = list.filter(t => t.completed).length;
      const total = list.length;
      const summary = `You have ${total} task${total !== 1 ? 's' : ''} (${completed} completed, ${total - completed} remaining)`;
      return {
        content: [{ type: "text", text: summary }],
        structuredContent: { tasks: list },
      };
    }
  );

  registerAppTool(
    server,
    "complete_todo_by_index",
    {
      title: "Complete todo by position",
      description: "Marks a todo as done by its position in the list (1 = first task, 2 = second, etc).",
      inputSchema: completeTodoByIndexInputSchema,
      _meta: {
        ui: { resourceUri: "ui://widget/todo.html" },
      },
    },
    async (args) => {
      const index = args?.index;
      if (!index) {
        return replyWithTodos("Missing todo index.", todoService.list());
      }

      const result = await todoService.completeByIndex(index);
      if (!result.ok && result.reason === "invalid_index") {
        return replyWithTodos(
          `Invalid index. There are only ${todoService.list().length} todo(s).`,
          todoService.list()
        );
      }

      if (result.todo.completed) {
        return replyWithTodos(
          `"${result.todo.title}" is already completed.`,
          todoService.list()
        );
      }

      return replyWithTodos(
        `Completed "${result.todo.title}" (task #${index}).`,
        todoService.list()
      );
    }
  );

  registerAppTool(
    server,
    "complete_todo_by_title",
    {
      title: "Complete todo by title",
      description: "Marks a todo as done by searching for a matching title (partial match supported).",
      inputSchema: completeTodoByTitleInputSchema,
      _meta: {
        ui: { resourceUri: "ui://widget/todo.html" },
      },
    },
    async (args) => {
      const searchTitle = args?.title?.trim?.() ?? "";
      if (!searchTitle) {
        return replyWithTodos("Missing search title.", todoService.list());
      }

      const result = await todoService.completeByTitle(searchTitle);
      if (!result.ok) {
        return replyWithTodos(
          `No incomplete todo found matching "${searchTitle}".`,
          todoService.list()
        );
      }

      return replyWithTodos(
        `Completed "${result.todo.title}".`,
        todoService.list()
      );
    }
  );

  return server;
}

const port = Number(process.env.PORT ?? 8787);
const MCP_PATH = "/mcp";
const API_BASE = "/api/todos";

// Helper to parse JSON request body
const parseJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });

// Helper to send JSON response
const sendJson = (res, statusCode, data) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data, null, 2));
};

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

  // REST API endpoints
  if (url.pathname === API_BASE) {
    if (req.method === "GET") {
      // List all todos
      const todos = todoService.list();
      sendJson(res, 200, { todos });
      return;
    }

    if (req.method === "POST") {
      // Add a new todo
      try {
        const body = await parseJsonBody(req);
        const title = body.title?.trim?.();
        if (!title) {
          sendJson(res, 400, { error: "Missing or empty title" });
          return;
        }
        const todo = await todoService.add(title);
        sendJson(res, 201, { todo, todos: todoService.list() });
      } catch (error) {
        console.error("Error adding todo:", error);
        sendJson(res, 400, { error: "Invalid request body" });
      }
      return;
    }
  }

  // Match /api/todos/:id pattern
  const apiIdMatch = url.pathname.match(/^\/api\/todos\/([^/]+)$/);
  if (apiIdMatch) {
    const id = apiIdMatch[1];

    if (req.method === "PUT") {
      // Complete a todo by id
      const result = await todoService.completeById(id);
      if (!result.ok) {
        sendJson(res, 404, { error: `Todo ${id} not found` });
        return;
      }
      sendJson(res, 200, { todo: result.todo, todos: todoService.list() });
      return;
    }

    if (req.method === "DELETE") {
      // Delete a todo by id
      const todo = todoService.list().find((t) => t.id === id);
      if (!todo) {
        sendJson(res, 404, { error: `Todo ${id} not found` });
        return;
      }
      todoService.todos = todoService.list().filter((t) => t.id !== id);
      await todoService.save();
      sendJson(res, 200, { todo, todos: todoService.list() });
      return;
    }
  }

  const MCP_METHODS = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && MCP_METHODS.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    const server = createTodoServer();
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