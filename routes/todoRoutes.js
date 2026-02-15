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

/**
 * REST API route handler for todo operations
 * @param {object} todoService - The TodoService instance
 * @param {string} apiBase - The base path for the API (e.g., "/api/todos")
 */
export const createTodoRoutes = (todoService, apiBase) => {
  return async (req, res, url) => {
    // List all todos
    if (url.pathname === apiBase && req.method === "GET") {
      const todos = todoService.list();
      sendJson(res, 200, { todos });
      return true;
    }

    // Add a new todo
    if (url.pathname === apiBase && req.method === "POST") {
      try {
        const body = await parseJsonBody(req);
        const title = body.title?.trim?.();
        if (!title) {
          sendJson(res, 400, { error: "Missing or empty title" });
          return true;
        }
        const todo = await todoService.add(title);
        sendJson(res, 201, { todo, todos: todoService.list() });
      } catch (error) {
        console.error("Error adding todo:", error);
        sendJson(res, 400, { error: "Invalid request body" });
      }
      return true;
    }

    // Complete todo by index endpoint
    if (url.pathname === `${apiBase}/complete-by-index` && req.method === "POST") {
      try {
        const body = await parseJsonBody(req);
        const index = body.index;
        if (!Number.isInteger(index) || index < 1) {
          sendJson(res, 400, { error: "Invalid index" });
          return true;
        }
        const result = await todoService.completeByIndex(index);
        if (!result.ok) {
          sendJson(res, 400, { error: "Invalid index" });
          return true;
        }
        sendJson(res, 200, { todo: result.todo, todos: todoService.list() });
      } catch (error) {
        console.error("Error completing todo by index:", error);
        sendJson(res, 400, { error: "Invalid request body" });
      }
      return true;
    }

    // Complete todo by title endpoint
    if (url.pathname === `${apiBase}/complete-by-title` && req.method === "POST") {
      try {
        const body = await parseJsonBody(req);
        const searchTitle = body.title?.trim?.();
        if (!searchTitle) {
          sendJson(res, 400, { error: "Missing search title" });
          return true;
        }
        const result = await todoService.completeByTitle(searchTitle);
        if (!result.ok) {
          sendJson(res, 400, { error: "No incomplete todo found matching this title" });
          return true;
        }
        sendJson(res, 200, { todo: result.todo, todos: todoService.list() });
      } catch (error) {
        console.error("Error completing todo by title:", error);
        sendJson(res, 400, { error: "Invalid request body" });
      }
      return true;
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
          return true;
        }
        sendJson(res, 200, { todo: result.todo, todos: todoService.list() });
        return true;
      }

      if (req.method === "DELETE") {
        // Delete a todo by id
        const todo = todoService.list().find((t) => t.id === id);
        if (!todo) {
          sendJson(res, 404, { error: `Todo ${id} not found` });
          return true;
        }
        todoService.todos = todoService.list().filter((t) => t.id !== id);
        await todoService.save();
        sendJson(res, 200, { todo, todos: todoService.list() });
        return true;
      }
    }

    // Route not handled
    return false;
  };
};
