# chatgpt.app.quickstart

Following [chatgpt quick start](https://developers.openai.com/apps-sdk/quickstart/).

Looks good [mcpjam](https://www.mcpjam.com/).

Good medium blogs:

- [Start building your first ChatGPT app](https://medium.com/@kenzic/getting-started-building-your-first-chatgpt-app-a3ab54d45f23)
## Architecture

```mermaid
graph TB
    subgraph Client ["Client Layer"]
        MCP["MCP Client<br/>(ChatGPT App)"]
        Widget["Todo Widget<br/>(HTML/JS)"]
    end
    
    subgraph Transport ["Transport Layer"]
        HTTPS["HTTP/StreamableTransport<br/>Port 8787"]
    end
    
    subgraph Server ["MCP Server Layer"]
        McpServer["MCP Server<br/>(todo-app v0.1.0)"]
    end
    
    subgraph Resources ["Resources & Tools"]
        WidgetResource["Resource:<br/>todo-widget<br/>ui://widget/todo.html"]
        
        Tools["Tools:"]
        AddTodo["add_todo<br/>- title"]
        ListTodos["list_todos<br/>- no params"]
        CompleteTodo["complete_todo<br/>- id"]
        CompleteByIndex["complete_todo_by_index<br/>- index 1,2,3..."]
        CompleteByTitle["complete_todo_by_title<br/>- title search"]
    end
    
    subgraph State ["State Management"]
        TodosArray["todos array<br/>(in-memory)"]
        NextId["nextId counter"]
    end
    
    MCP -->|JSON-RPC| HTTPS
    Widget -->|postMessage<br/>JSON-RPC| HTTPS
    HTTPS -->|StreamableHTTPServerTransport| McpServer
    McpServer --> WidgetResource
    McpServer --> AddTodo
    McpServer --> ListTodos
    McpServer --> CompleteTodo
    McpServer --> CompleteByIndex
    McpServer --> CompleteByTitle
    
    AddTodo --> TodosArray
    ListTodos --> TodosArray
    CompleteTodo --> TodosArray
    CompleteByIndex --> TodosArray
    CompleteByTitle --> TodosArray
    AddTodo --> NextId
    
    style Client fill:#0277bd,color:#fff,stroke:#01579b,stroke-width:2px
    style Transport fill:#7b1fa2,color:#fff,stroke:#4a148c,stroke-width:2px
    style Server fill:#00796b,color:#fff,stroke:#004d40,stroke-width:2px
    style Resources fill:#f57f17,color:#fff,stroke:#e65100,stroke-width:2px
    style State fill:#c2185b,color:#fff,stroke:#880e4f,stroke-width:2px
    style WidgetResource fill:#f57f17,color:#fff
    style Tools fill:#f57f17,color:#fff
    style AddTodo fill:#ff9800,color:#fff
    style ListTodos fill:#ff9800,color:#fff
    style CompleteTodo fill:#ff9800,color:#fff
    style CompleteByIndex fill:#ff9800,color:#fff
    style CompleteByTitle fill:#ff9800,color:#fff
    style TodosArray fill:#e91e63,color:#fff
    style NextId fill:#e91e63,color:#fff
```

## Architecture (with Service/API Layer)

```mermaid
graph TB
    subgraph Client ["Client Layer"]
        MCP["MCP Client<br/>(ChatGPT App)"]
        Widget["Todo Widget<br/>(HTML/JS)"]
    end

    subgraph Transport ["Transport Layer"]
        HTTPS["HTTP/StreamableTransport<br/>Port 8787"]
    end

    subgraph Server ["MCP Server Layer"]
        McpServer["MCP Server<br/>(todo-app v0.1.0)"]
    end

    subgraph Resources ["Resources & Tools"]
        WidgetResource["Resource:<br/>todo-widget<br/>ui://widget/todo.html"]
        AddTodo["add_todo"]
        ListTodos["list_todos"]
        CompleteTodo["complete_todo"]
        CompleteByIndex["complete_todo_by_index"]
        CompleteByTitle["complete_todo_by_title"]
    end

    subgraph Services ["Service/API Layer"]
        TodoService["TodoService<br/>(business rules)"]
    end

    subgraph State ["State Management"]
        TodosArray["todos array<br/>(in-memory)"]
        NextId["nextId counter"]
    end

    MCP -->|JSON-RPC| HTTPS
    Widget -->|postMessage<br/>JSON-RPC| HTTPS
    HTTPS -->|StreamableHTTPServerTransport| McpServer
    McpServer --> WidgetResource
    McpServer --> AddTodo
    McpServer --> ListTodos
    McpServer --> CompleteTodo
    McpServer --> CompleteByIndex
    McpServer --> CompleteByTitle

    AddTodo --> TodoService
    ListTodos --> TodoService
    CompleteTodo --> TodoService
    CompleteByIndex --> TodoService
    CompleteByTitle --> TodoService

    TodoService --> TodosArray
    TodoService --> NextId

    style Client fill:#0277bd,color:#fff,stroke:#01579b,stroke-width:2px
    style Transport fill:#7b1fa2,color:#fff,stroke:#4a148c,stroke-width:2px
    style Server fill:#00796b,color:#fff,stroke:#004d40,stroke-width:2px
    style Resources fill:#f57f17,color:#fff,stroke:#e65100,stroke-width:2px
    style Services fill:#5d4037,color:#fff,stroke:#3e2723,stroke-width:2px
    style State fill:#c2185b,color:#fff,stroke:#880e4f,stroke-width:2px
```

> **Tip:** Install the [Markdown Preview Mermaid Support](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) extension to render Mermaid diagrams in VS Code's markdown preview.

### Components

- **Client Layer**: MCP client (ChatGPT App) and interactive todo widget
- **Transport**: HTTP server on port 8787 using StreamableTransport for MCP communication
- **MCP Server**: Serves resources and tools following the Model Context Protocol
- **Resource**: Interactive todo widget UI served at `ui://widget/todo.html`
- **Tools** (5 available):
  - `add_todo` - Add a new todo with a title
  - `list_todos` - List all todos with IDs and completion status
  - `complete_todo` - Complete a todo by ID
  - `complete_todo_by_index` - Complete a todo by position (1, 2, 3...)
  - `complete_todo_by_title` - Complete a todo by searching title
- **State**: In-memory todos array and ID counter (stored in memory)