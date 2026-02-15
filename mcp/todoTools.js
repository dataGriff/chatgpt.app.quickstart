import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

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

const replyWithTodos = (message, tasks) => ({
  content: message ? [{ type: "text", text: message }] : [],
  structuredContent: { tasks },
});

/**
 * Creates an MCP server with todo tools registered
 * @param {string} todoHtml - HTML content for the todo widget
 * @param {Function} callInternalApi - Function to call internal API
 */
export function createTodoServer(todoHtml, callInternalApi) {
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
      const result = await callInternalApi("POST", "/api/todos", { title });
      if (!result.ok) {
        return replyWithTodos("Missing title.", result.todos ?? []);
      }
      return replyWithTodos(`Added "${result.todo.title}".`, result.todos);
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
      if (!id) {
        const list = await callInternalApi("GET", "/api/todos");
        return replyWithTodos("Missing todo id.", list.todos);
      }
      const result = await callInternalApi("PUT", `/api/todos/${id}`);
      if (!result.ok) {
        return replyWithTodos(`Todo ${id} was not found.`, result.todos ?? []);
      }

      return replyWithTodos(
        `Completed "${result.todo.title}".`,
        result.todos
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
      const result = await callInternalApi("GET", "/api/todos");
      const list = result.todos;
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
        const list = await callInternalApi("GET", "/api/todos");
        return replyWithTodos("Missing todo index.", list.todos);
      }

      const result = await callInternalApi("POST", "/api/todos/complete-by-index", { index });
      if (!result.ok) {
        const list = await callInternalApi("GET", "/api/todos");
        return replyWithTodos(
          `Invalid index. There are only ${list.todos.length} todo(s).`,
          list.todos
        );
      }

      return replyWithTodos(
        `Completed "${result.todo.title}" (task #${index}).`,
        result.todos
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
        const list = await callInternalApi("GET", "/api/todos");
        return replyWithTodos("Missing search title.", list.todos);
      }

      const result = await callInternalApi("POST", "/api/todos/complete-by-title", { title: searchTitle });
      if (!result.ok) {
        const list = await callInternalApi("GET", "/api/todos");
        return replyWithTodos(
          `No incomplete todo found matching "${searchTitle}".`,
          list.todos
        );
      }

      return replyWithTodos(
        `Completed "${result.todo.title}".`,
        result.todos
      );
    }
  );

  return server;
}
