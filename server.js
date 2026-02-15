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
      const todoList = list
        .map((task) => `[${task.id}] ${task.completed ? "✓" : " "} ${task.title}`)
        .join("\n");
      return {
        content: [{ type: "text", text: todoList }],
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

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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
    `Todo MCP server listening on http://localhost:${port}${MCP_PATH}`
  );
});