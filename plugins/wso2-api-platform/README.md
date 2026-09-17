# WSO2 API Manager Frontend Plugin (`@wso2/backstage-plugin-wso2-api-platform`)

This plugin provides the frontend React UI integration for **WSO2 API Manager** in Backstage. It includes a comprehensive discovery dashboard for browsing APIs, API Products, and MCP Servers, as well as specialized Catalog Entity Cards for detailed exploration and interactive API testing.

## Technical Features

### 1. Global API Discovery Dashboard (`<Wso2ApiPlatformPage>`)

A standalone route (typically accessible at `/wso2-api-platform`) that acts as a global discovery portal. It queries the Backstage Software Catalog to aggregate all entities ingested by the WSO2 Catalog Module.

- **Unified Tables:** Distinct tabs for exploring native APIs, API Products, MCP Servers, and Services.
- **Advanced Filtering:** Built-in search and dropdown filters to narrow down APIs by Gateway environment and API Type (e.g., HTTP, GraphQL, WebSocket).
- **Interactive Data Rendering:** Utilizes custom table renderers to display dynamic chip-based API types, gateways, and version information.

### 2. Entity Tabs & Overview Cards

When viewing a specific WSO2 API or Service entity within the Backstage Catalog, this plugin provides several specialized cards and tabs:

- **`EntityWso2ApiOverviewCard` & `EntityWso2ServiceOverviewCard`**: Renders critical metadata such as API status, context paths, business owners, and associated gateway environments.
- **`EntityWso2ApiDocumentsCard`**: Fetches and lists all associated documents (PDF, MD, TXT, etc.) and integrates with the backend plugin to stream document downloads seamlessly.
- **`EntityWso2ApiPoliciesTab`**: Visualizes API-level request and response policies.
- **`EntityWso2McpToolsCard`**: Dedicated card for exploring Model Context Protocol (MCP) server definitions and instructions.

### 3. Interactive API Try-Out Consoles (`<EntityWso2ApiTryOutTab>`)

A powerful, built-in testing environment allowing developers to test WSO2 APIs directly from the Backstage portal without needing external API clients like Postman.

- **Dynamic Credential Generation:** Integrates with the backend plugin to dynamically request temporary access tokens via Basic Auth or OAuth grants.
- **Multi-Protocol Consoles:** Custom-built React consoles for interacting with:
  - **REST / SOAP:** Swagger UI integration.
  - **GraphQL:** GraphiQL integration.
  - **Async APIs:** Dedicated consoles for SSE (Server-Sent Events), WebSockets, and WebSub.

### 4. Client API (`Wso2ApiPlatformClient`)

Provides a heavily typed TypeScript API client (`wso2ApiPlatformApiRef`) that standardizes all communication between the React frontend and the backend plugin. It handles dynamic data fetching for revisions, WSDL payloads, and authorization token negotiation.

## Gateway Write Operations Lock

The Policies tab has an "editable" mode for gateway-discovered APIs, gated (among other things) on `wso2ApiPlatformGateway.enableWriteOperations` being `true` — see `usePolicyAccessMode`. **For this initial release, that mode is hard-locked off**: `isGatewayWriteOperationsEnabled()` in [`src/utils/gatewayWriteAccess.ts`](./src/utils/gatewayWriteAccess.ts) always returns `false` via a `GATEWAY_WRITE_OPERATIONS_LOCKED` constant, regardless of what `enableWriteOperations` is set to in config. The backend plugin enforces an identical lock independently, so this isn't just a UI-level restriction.

**Why:** enabling Full Sync Mode today would let any authenticated Backstage user who holds valid gateway credentials modify **any** API on the gateway, not just ones they own — there is no per-API or per-team authorization model yet. See the [backend plugin's README](../wso2-api-platform-backend/README.md#gateway-write-operations-lock) for the full rationale and the plan for re-enabling this in a future release.

## Setup & Routing

To integrate this frontend plugin into your Backstage app, you need to configure the routing for the global discovery page and the individual catalog entity cards.

## Installation and Configuration

> **Note:** This package is part of the broader WSO2 integration suite.
> For full installation and configuration instructions, please refer to the official [WSO2 API Manager Documentation](https://apim.docs.wso2.com).

## License

Apache-2.0
