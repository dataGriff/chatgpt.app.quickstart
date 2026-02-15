# REST API Reference

Base URL: `http://localhost:8787/api/todos`

All endpoints return JSON with `Content-Type: application/json` and `Access-Control-Allow-Origin: *`.

Request bodies are limited to 1 MB. Payloads exceeding this limit receive a `413` response.

---

## List Todos

```
GET /api/todos
```

**Response** `200 OK`

```json
{
  "todos": [
    { "id": "todo-1", "title": "Buy groceries", "completed": false },
    { "id": "todo-2", "title": "Walk the dog", "completed": true }
  ]
}
```

---

## Add Todo

```
POST /api/todos
Content-Type: application/json
```

**Request body**

```json
{ "title": "Buy groceries" }
```

**Response** `201 Created`

```json
{
  "todo": { "id": "todo-1", "title": "Buy groceries", "completed": false },
  "todos": [ ... ]
}
```

**Errors**

| Status | Body | Cause |
|--------|------|-------|
| `400` | `{ "error": "Missing or empty title" }` | Title is blank or missing |
| `400` | `{ "error": "Invalid request body" }` | Malformed JSON |
| `413` | `{ "error": "Request body too large" }` | Body exceeds 1 MB |

---

## Complete Todo by ID

```
PUT /api/todos/:id
```

Marks the todo as `completed: true`. Idempotent — completing an already-completed todo is a no-op.

**Response** `200 OK`

```json
{
  "todo": { "id": "todo-1", "title": "Buy groceries", "completed": true },
  "todos": [ ... ]
}
```

**Errors**

| Status | Body | Cause |
|--------|------|-------|
| `404` | `{ "error": "Todo todo-99 not found" }` | No todo with that ID |

---

## Complete Todo by Index

```
POST /api/todos/complete-by-index
Content-Type: application/json
```

**Request body**

```json
{ "index": 1 }
```

Index is 1-based (1 = first todo, 2 = second, etc.).

**Response** `200 OK`

```json
{
  "todo": { "id": "todo-1", "title": "Buy groceries", "completed": true },
  "todos": [ ... ]
}
```

**Errors**

| Status | Body | Cause |
|--------|------|-------|
| `400` | `{ "error": "Invalid index" }` | Not a positive integer or out of range |

---

## Complete Todo by Title

```
POST /api/todos/complete-by-title
Content-Type: application/json
```

**Request body**

```json
{ "title": "groceries" }
```

Finds the first incomplete todo whose title contains the search string (case-insensitive) and marks it completed.

**Response** `200 OK`

```json
{
  "todo": { "id": "todo-1", "title": "Buy groceries", "completed": true },
  "todos": [ ... ]
}
```

**Errors**

| Status | Body | Cause |
|--------|------|-------|
| `400` | `{ "error": "Missing search title" }` | Title is blank or missing |
| `400` | `{ "error": "No incomplete todo found matching this title" }` | No match |

---

## Delete Todo

```
DELETE /api/todos/:id
```

Permanently removes a todo.

**Response** `200 OK`

```json
{
  "todo": { "id": "todo-1", "title": "Buy groceries", "completed": false },
  "todos": [ ... ]
}
```

**Errors**

| Status | Body | Cause |
|--------|------|-------|
| `404` | `{ "error": "Todo todo-99 not found" }` | No todo with that ID |

---

## Common Response Shape

All mutation endpoints return the affected `todo` plus the full `todos` array so the client can update its UI in a single round trip.

```json
{
  "todo": { "id": "...", "title": "...", "completed": true },
  "todos": [ ... ]
}
```
