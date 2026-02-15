# Using the OpenAPI Specification

The Todo API is documented using [OpenAPI 3.0.0](https://spec.openapis.org/oas/v3.0.0) in the [openapi.yaml](openapi.yaml) file. This standard specification enables integration with various API documentation and testing tools.

## View Interactive API Documentation

### Option 1: Swagger UI (Recommended)

The easiest way to explore the API interactively:

```bash
# Install Swagger UI globally
npm install -g http-server

# In another terminal, start your server
node server.js

# Serve Swagger UI with the OpenAPI spec
# Visit: http://localhost:3000/swagger-ui.html?url=http://localhost:8787/docs/openapi.yaml
```

Or use the [online Swagger UI editor](https://editor.swagger.io/) and paste the contents of `openapi.yaml`.

### Option 2: ReDoc

For beautiful, responsive API documentation:

```bash
npm install -g redoc-cli
redoc-cli serve docs/openapi.yaml --port 8080
```

Then visit: `http://localhost:8080`

### Option 3: Stoplight Elements

Interactive API explorer with best-in-class UX:

```bash
npm install -g @stoplight/cli
stoplight preview docs/openapi.yaml
```

## Integration with API Clients

### Insomnia

1. Open Insomnia
2. Create a new **Request** → **Import** → **From URL**
3. Paste: `file:///path/to/docs/openapi.yaml`
4. All endpoints will be imported as pre-configured requests

### Postman

1. Click **Import** in Postman
2. Select **Upload Files** → choose `docs/openapi.yaml`
3. Collections with all endpoints will be created

### VS Code REST Client

Use the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension to test endpoints directly in the editor.

## Automated Testing

### Generate Client SDKs

Use [OpenAPI Generator](https://openapi-generator.tech/) to generate client libraries:

```bash
# Generate TypeScript client
openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g typescript \
  -o ./generated/typescript-client

# Generate Python client
openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g python \
  -o ./generated/python-client
```

### Contract Testing

Validate server responses against the OpenAPI spec:

```bash
# Using Dredd for contract testing
npm install -g dredd
dredd docs/openapi.yaml http://localhost:8787
```

### Prism Mock Server

Create a mock server for testing without running the real server:

```bash
npm install -g @stoplight/prism-cli
prism mock docs/openapi.yaml
```

## Validation

Ensure the specification and implementation stay in sync:

```bash
# Using Spectacle for spec validation
npm install -g spectacle-docs
spectacle docs/openapi.yaml -d ./docs/spectacle-docs
```

## Best Practices

✅ **Specification First**: Keep the OpenAPI spec as the source of truth  
✅ **Regular Validation**: Run automated tests to verify compliance (see [API_COMPLIANCE.md](API_COMPLIANCE.md))  
✅ **Version Control**: Track the OpenAPI spec in git alongside the implementation  
✅ **Documentation**: Reference the spec in your README and API docs  

## Spec Updates

When the API changes:

1. Update `docs/openapi.yaml` with the new endpoint/parameter definitions
2. Implement the corresponding code changes
3. Run tests to verify compliance
4. Update [API_COMPLIANCE.md](API_COMPLIANCE.md) with validation results
5. Commit both files together

The [API Compliance Report](API_COMPLIANCE.md) documents that the current implementation fully adheres to this specification.
