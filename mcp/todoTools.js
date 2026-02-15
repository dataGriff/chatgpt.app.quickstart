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
 * Creates an MCP server with todo tools registered.
 * Tools call TodoService directly — no internal HTTP simulation.
 * @param {string} todoHtml - HTML content for the todo widget
 * @param {import("../services/todoService.js").TodoService} todoService
 */
export function createTodoServer(todoHtml, todoService) {
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
    async ({ title }) => {
      const todo = await todoService.add(title.trim());
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
    async ({ id }) => {
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
    async ({ index }) => {
      const result = await todoService.completeByIndex(index);
      if (!result.ok) {
        const list = todoService.list();
        return replyWithTodos(
          `Invalid index. There are only ${list.length} todo(s).`,
          list
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
    async ({ title }) => {
      const result = await todoService.completeByTitle(title.trim());
      if (!result.ok) {
        return replyWithTodos(
          `No incomplete todo found matching "${title}".`,
          todoService.list()
        );
      }
      return replyWithTodos(
        `Completed "${result.todo.title}".`,
        todoService.list()
      );
    }
  );

  registerAppTool(
    server,
    "delete_completed",
    {
      title: "Delete completed todos",
      description: "Removes all completed todos from the list.",
      inputSchema: {},
      _meta: {
        ui: { resourceUri: "ui://widget/todo.html" },
      },
    },
    async () => {
      const result = await todoService.deleteCompleted();
      const count = result.deleted.length;
      if (count === 0) {
        return replyWithTodos("No completed todos to clear.", todoService.list());
      }
      return replyWithTodos(
        `Cleared ${count} completed todo${count !== 1 ? 's' : ''}.`,
        todoService.list()
      );
    }
  );

  return server;
}
