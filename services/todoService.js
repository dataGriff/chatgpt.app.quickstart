import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export class TodoService {
  constructor(dataFile, todos, nextId) {
    this.dataFile = dataFile;
    this.todos = todos;
    this.nextId = nextId;
  }

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
      if (error?.code !== "ENOENT") {
        throw error;
      }
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

    if (exists.completed) {
      return { ok: true, todo: exists };
    }

    const newTodos = this.todos.map((task) =>
      task.id === id ? { ...task, completed: true } : task
    );
    await this.#saveAtomically(newTodos);
    const updated = this.todos.find((task) => task.id === id);
    return { ok: true, todo: updated };
  }

  async completeByIndex(index) {
    if (index < 1 || index > this.todos.length) {
      return { ok: false, reason: "invalid_index" };
    }

    const existing = this.todos[index - 1];
    if (existing.completed) {
      return { ok: true, todo: existing, index };
    }

    const newTodos = this.todos.map((task, i) =>
      i === index - 1 ? { ...task, completed: true } : task
    );
    await this.#saveAtomically(newTodos);
    const updated = this.todos[index - 1];
    return { ok: true, todo: updated, index };
  }

  async completeByTitle(searchTitle) {
    const normalizedTitle = searchTitle.toLowerCase();
    const match = this.todos.find(
      (task) =>
        !task.completed && task.title.toLowerCase().includes(normalizedTitle)
    );

    if (!match) return { ok: false, reason: "not_found" };

    const newTodos = this.todos.map((task) =>
      task.id === match.id ? { ...task, completed: true } : task
    );
    await this.#saveAtomically(newTodos);
    const updated = this.todos.find((task) => task.id === match.id);
    return { ok: true, todo: updated };
  }

  async deleteById(id) {
    const todo = this.todos.find((task) => task.id === id);
    if (!todo) return { ok: false, reason: "not_found" };

    const newTodos = this.todos.filter((task) => task.id !== id);
    await this.#saveAtomically(newTodos);
    return { ok: true, todo };
  }

  async deleteCompleted() {
    const completed = this.todos.filter((task) => task.completed);
    if (completed.length === 0) {
      return { ok: true, deleted: [], todos: this.todos };
    }

    const newTodos = this.todos.filter((task) => !task.completed);
    await this.#saveAtomically(newTodos);
    return { ok: true, deleted: completed, todos: this.todos };
  }

  /** Write to disk first, then update in-memory state on success. */
  async #saveAtomically(newTodos) {
    const payload = JSON.stringify(
      { todos: newTodos, nextId: this.nextId },
      null,
      2
    );
    await writeFile(this.dataFile, payload, "utf8");
    this.todos = newTodos;
  }

  async save() {
    await this.#saveAtomically(this.todos);
  }
}
