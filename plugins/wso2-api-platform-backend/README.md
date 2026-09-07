# WSO2 API Manager Backend Plugin

This is the backend plugin for **WSO2 API Manager** in Backstage. It acts as a secure bridge between the frontend plugin and your WSO2 API Manager (and Gateway) instances.

> [!IMPORTANT] > **This package is part of the WSO2 suite.**
> Please see the [Main Plugin Page](https://npmjs.com/package/@wso2/backstage-plugin-wso2-api-platform) for full installation and configuration instructions.

## Responsibilities

The backend plugin is responsible for handling sensitive operations that cannot be safely executed directly from the frontend browser:

1. **Secure API Key Generation:** Securely generates temporary access tokens for the API Gateway using your configured OAuth2 or Basic Auth credentials.
2. **Real-time Data Fetching:** Fetches dynamic, real-time data like active API deployments and revisions that are not stored in the static Backstage Software Catalog.
3. **File Streaming:** Streams binary files (like PDF documents and WSDL archives) directly from WSO2 to the user's browser, bypassing cross-origin (CORS) restrictions.
4. **API Proxying:** Proxies requests to WSO2 Developer Portal and Publisher APIs.

## Internal API Routes

The frontend plugin fetches data dynamically from this backend plugin. The following table outlines the key internal routes exposed by this backend:

| HTTP Method | Backend Route                                                                          | Frontend JavaScript Trigger           | Purpose                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **POST**    | `/api/wso2-api-platform/apis/:apiId/generate-key`                                      | `wso2Api.generateApiKey(...)`         | Generates a temporary access token for the Gateway via Basic Auth/OAuth credentials.                       |
| **GET**     | `/api/wso2-api-platform/apis/:apiId/revisions`                                         | `wso2Api.getRevisions(...)`           | Lists deployment revisions of an API in real-time.                                                         |
| **GET**     | `/api/wso2-api-platform/apis/:apiId/wsdl`                                              | `wso2Api.getApiWsdl(...)`             | Downloads the SOAP API WSDL file/archive payload.                                                          |
| **GET**     | `/api/wso2-api-platform/apis/:apiId/documents/:documentId/content`                     | _Direct Link URL in UI_               | Streams document file downloads (PDF, MD, TXT, etc.) on-demand. On-prem APIM only — unchanged legacy path. |
| **GET**     | `/api/wso2-api-platform/entities/:kind/:namespace/:name/documents`                     | `wso2Api.listDocuments(...)`          | Lists documents for an entity.                                                                             |
| **POST**    | `/api/wso2-api-platform/entities/:kind/:namespace/:name/documents`                     | `wso2Api.createDocument(...)`         | Creates a document (JSON for INLINE/MARKDOWN/URL, multipart for FILE).                                     |
| **GET**     | `/api/wso2-api-platform/entities/:kind/:namespace/:name/documents/:documentId`         | `wso2Api.getDocument(...)`            | Fetches one document's metadata.                                                                           |
| **PUT**     | `/api/wso2-api-platform/entities/:kind/:namespace/:name/documents/:documentId`         | `wso2Api.updateDocumentMetadata(...)` | Edits document metadata only.                                                                              |
| **DELETE**  | `/api/wso2-api-platform/entities/:kind/:namespace/:name/documents/:documentId`         | `wso2Api.deleteDocument(...)`         | Hard-deletes a document.                                                                                   |
| **GET**     | `/api/wso2-api-platform/entities/:kind/:namespace/:name/documents/:documentId/content` | `wso2Api.getDocumentContentUrl(...)`  | Streams/redirects to document content.                                                                     |

## Document storage

APIs discovered from self-hosted WSO2 gateways and OpenChoreo have no document
store of their own — the gateway only exposes runtime API config. This plugin
therefore owns a small relational store for their documents (create, view,
edit metadata, hard delete). On-prem APIM documents are unaffected: they
remain read-only, served from the catalog's `wso2.com/api-documents`
annotation and the legacy content-proxy route above.

### Enabling and configuring

```yaml
wso2ApiPlatform:
  storage:
    enabled: true # master switch; false disables the routes (501) and the Add/Actions UI
    documents:
      maxFileSizeMb: 10 # FILE uploads
      maxInlineSizeKb: 512 # INLINE / MARKDOWN bodies
      allowedExtensions:
        [
          pdf,
          txt,
          doc,
          docx,
          xls,
          xlsx,
          odt,
          ods,
          json,
          yaml,
          yml,
          md,
          png,
          jpg,
          jpeg,
          svg,
        ]
    binary:
      backend: database # only backend implemented in this release
```

### Database

Documents live in a Knex-backed store obtained via Backstage's
`coreServices.database`, scoped to this plugin's own logical database
(`backstage_plugin_wso2-api-platform`). It **inherits `backend.database`**, so
it defaults to SQLite with zero extra configuration and automatically follows
the instance to PostgreSQL if you switch `backend.database.client: pg`.

To put documents on a _different_ database than the rest of the instance, use
Backstage's native per-plugin override — no plugin-specific connection config
exists or is needed:

```yaml
backend:
  database:
    plugin:
      wso2-api-platform:
        client: pg
        connection:
          host: ${WSO2_DOC_DB_HOST}
          port: 5432
          user: ${WSO2_DOC_DB_USER}
          password: ${WSO2_DOC_DB_PASSWORD}
          database: backstage_plugin_wso2_api_platform
```

Migrations (`migrations/*.js`) run automatically once at plugin init via
`knex.migrate.latest()`. Rolling back requires running the corresponding
`down` migration manually — there is no automatic rollback path.

**Backup:** document content now lives in this database (a file under
`backstage-data` on SQLite, or the configured PostgreSQL database) — make
sure it is included in your backup scope. This is the single most likely
operational surprise when adopting this feature.

### Known limitations / residual risk

- **Authorization.** Writes (create/edit/delete) are gated only on
  "authenticated Backstage user" — there is no per-API or per-team permission
  check yet. Any signed-in user can modify or hard-delete any gateway API's
  documents. `created_by`/`updated_by` are recorded and every mutation is
  logged for audit purposes, and all writes go through a single
  `authorizeWrite` helper so wiring in `@backstage/plugin-permission-node`
  later is a one-file change. Treat this as a real exposure until permissions
  ship, and document it for adopters.
- **OpenChoreo `api_id` stability.** Documents are keyed by
  `(source_kind, gateway_id, api_id)`, where `api_id` comes from whatever the
  gateway's `RestApi` discovery reports (`status.id`, falling back to
  `metadata.name`). For self-hosted gateway-controller discovery this is
  expected to be stable; for OpenChoreo specifically, id stability across
  `RestApi` CRD redeploys has not been empirically verified. If it turns out
  to be unstable, a redeploy could orphan a gateway API's documents (they are
  not deleted, just unreachable under the new id).

## License

Apache-2.0
