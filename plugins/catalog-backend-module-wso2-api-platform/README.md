# WSO2 API Manager Catalog Backend Module

This is the catalog backend module for the **WSO2 API Manager** integration. It provides a Backstage `EntityProvider` that automatically discovers and ingests APIs, API Products, Services, and MCP Servers from WSO2 directly into the Backstage Software Catalog.

> [!IMPORTANT] > **This package is part of the WSO2 suite.**
> Please see the [Main Plugin Page](https://npmjs.com/package/@wso2/backstage-plugin-wso2-api-platform) for full installation and configuration instructions.

## Polling and Scheduling

The ingestion process runs on a customizable schedule, ensuring your Backstage Catalog is always synchronized with your WSO2 environments. The following parameters configure this task:

- **Frequency:** The periodic interval between each catalog ingestion sweep (e.g., `20 minutes`).
- **Timeout:** The maximum allowed duration for a single ingestion task before it is automatically aborted (e.g., `5 minutes`).
- **Initial Delay:** Delays the very first ingestion after the Backstage backend boots up, giving the system time to stabilize (e.g., `15 seconds`).
- **Scope:** Set to `global`. This ensures that only one server or replica in your entire cluster runs the sync task at any given time, preventing race conditions or duplicated API calls.
- **Concurrency:** The provider uses a pool of **5 concurrent workers** to fetch detailed metadata (like swagger definitions or documents) in parallel, dramatically speeding up the ingestion process.

## Discovered REST APIs

During an ingestion sweep, this module connects to multiple WSO2 APIs to discover and build the Backstage entities. The following tables outline the specific endpoints accessed:

_Note: `{publisherBasePath}` typically resolves to `/api/am/publisher/v4`, and `{serviceCatalogBasePath}` resolves to `/api/am/service-catalog/v1`._

| Domain                | HTTP Method | Endpoint Pattern                                               | Purpose                                                        |
| --------------------- | ----------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| **Settings**          | GET         | `{publisherBasePath}/settings`                                 | Fetches global APIM environment settings.                      |
| **APIs**              | GET         | `{publisherBasePath}/apis?limit=1000&offset={offset}`          | Retrieves the paginated list of all APIs.                      |
| **APIs**              | GET         | `{publisherBasePath}/apis/{apiId}`                             | Fetches detailed metadata for a specific API.                  |
| **APIs**              | GET         | `{publisherBasePath}/apis/{apiId}/documents`                   | Discovers documents attached to the API.                       |
| **APIs**              | GET         | `{publisherBasePath}/apis/{apiId}/swagger`                     | Retrieves the OpenAPI definition payload.                      |
| **APIs**              | GET         | `{publisherBasePath}/apis/{apiId}/asyncapi`                    | Retrieves the AsyncAPI definition payload.                     |
| **APIs**              | GET         | `{publisherBasePath}/apis/{apiId}/wsdl`                        | Retrieves the SOAP WSDL payload.                               |
| **API Products**      | GET         | `{publisherBasePath}/api-products`                             | Retrieves the list of API Products.                            |
| **API Products**      | GET         | `{publisherBasePath}/api-products/{productId}`                 | Fetches detailed metadata for a product.                       |
| **API Products**      | GET         | `{publisherBasePath}/api-products/{productId}/swagger`         | Retrieves the Product's OpenAPI definition.                    |
| **MCP Servers**       | GET         | `{publisherBasePath}/mcp-servers`                              | Retrieves the list of MCP Servers.                             |
| **MCP Servers**       | GET         | `{publisherBasePath}/mcp-servers/{mcpId}`                      | Fetches detailed metadata for an MCP Server.                   |
| **MCP Servers**       | GET         | `{publisherBasePath}/mcp-servers/{mcpId}/documents`            | Discovers documents attached to the MCP Server.                |
| **Service Catalog**   | GET         | `{serviceCatalogBasePath}/services?limit=1000&offset={offset}` | Retrieves the paginated list of backend Services.              |
| **Service Catalog**   | GET         | `{serviceCatalogBasePath}/services/{serviceId}/usage`          | Determines which APIs use a specific Service.                  |
| **Service Catalog**   | GET         | `{serviceCatalogBasePath}/services/{serviceId}/definition`     | Retrieves the OpenAPI definition of the backend service.       |
| **Platform Gateways** | GET         | `{discoveryUrl}`                                               | Discovers gateway-level APIs deployed on self-hosted gateways. |
| **Platform Gateways** | GET         | `{discoveryUrl}/{gatewayApiId}`                                | Fetches details for a discovered gateway API.                  |

## Gateway-only Discovery

Self-hosted gateway discovery (`wso2ApiPlatformGateway`) can run on its own, without the API Manager integration. When `wso2ApiPlatform.enabled` is `false` (or the `wso2ApiPlatform` block is omitted entirely), the provider still sweeps every configured gateway `discoveryUrl` and ingests the discovered APIs; only the API Manager publisher/service-catalog ingestion is skipped. The `catalog.providers.wso2ApiPlatform.schedule` block is still required, as it drives the discovery schedule for both sources.

In gateway-only mode, discovery requests verify TLS with the default system trust store (`wso2ApiPlatform.tls.rejectUnauthorized` only applies to the API Manager client).

## 📜 License

Apache-2.0
