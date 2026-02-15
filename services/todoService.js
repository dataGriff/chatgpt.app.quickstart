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
    this.todos = [...this.todos, todo];
    await this.save();
    return todo;
  }

  async completeById(id) {
    const todo = this.todos.find((task) => task.id === id);
    if (!todo) return { ok: false, reason: "not_found" };

    if (!todo.completed) {
      this.todos = this.todos.map((task) =>
        task.id === id ? { ...task, completed: true } : task
      );
      await this.save();
    }

    return { ok: true, todo };
  }

  async completeByIndex(index) {
    if (index < 1 || index > this.todos.length) {
      return { ok: false, reason: "invalid_index" };
    }

    const todo = this.todos[index - 1];
    if (!todo.completed) {
      this.todos = this.todos.map((task, i) =>
        i === index - 1 ? { ...task, completed: true } : task
      );
      await this.save();
    }

    return { ok: true, todo, index };
  }

  async completeByTitle(searchTitle) {
    const normalizedTitle = searchTitle.toLowerCase();
    const todo = this.todos.find(
      (task) =>
        !task.completed && task.title.toLowerCase().includes(normalizedTitle)
    );

    if (!todo) return { ok: false, reason: "not_found" };

    this.todos = this.todos.map((task) =>
      task.id === todo.id ? { ...task, completed: true } : task
    );
    await this.save();

    return { ok: true, todo };
  }

  async save() {
    const payload = JSON.stringify(
      { todos: this.todos, nextId: this.nextId },
      null,
      2
    );
    await writeFile(this.dataFile, payload, "utf8");
  }
}
