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

| HTTP Method | Backend Route                                                                          | Frontend JavaScript Trigger                 | Purpose                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **POST**    | `/api/wso2-api-platform/apis/:apiId/generate-key`                                      | `wso2Api.generateApiKey(...)`               | Generates a temporary access token for the Gateway via Basic Auth/OAuth credentials.                       |
| **GET**     | `/api/wso2-api-platform/apis/:apiId/revisions`                                         | `wso2Api.getRevisions(...)`                 | Lists deployment revisions of an API in real-time.                                                         |
| **GET**     | `/api/wso2-api-platform/apis/:apiId/wsdl`                                              | `wso2Api.getApiWsdl(...)`                   | Downloads the SOAP API WSDL file/archive payload.                                                          |
| **GET**     | `/api/wso2-api-platform/apis/:apiId/documents/:documentId/content`                     | _Direct Link URL in UI_                     | Streams document file downloads (PDF, MD, TXT, etc.) on-demand. On-prem APIM only — unchanged legacy path. |
| **GET**     | `/api/wso2-api-platform/entities/:kind/:namespace/:name/documents`                     | `wso2Api.listDocuments(...)`                | Lists documents for an entity.                                                                             |
| **POST**    | `/api/wso2-api-platform/entities/:kind/:namespace/:name/documents`                     | `wso2Api.createDocument(...)`               | Creates a document (JSON for INLINE/MARKDOWN/URL, multipart for FILE).                                     |
| **GET**     | `/api/wso2-api-platform/entities/:kind/:namespace/:name/documents/:documentId`         | `wso2Api.getDocument(...)`                  | Fetches one document's metadata.                                                                           |
| **PUT**     | `/api/wso2-api-platform/entities/:kind/:namespace/:name/documents/:documentId`         | `wso2Api.updateDocumentMetadata(...)`       | Edits document metadata only.                                                                              |
| **DELETE**  | `/api/wso2-api-platform/entities/:kind/:namespace/:name/documents/:documentId`         | `wso2Api.deleteDocument(...)`               | Hard-deletes a document.                                                                                   |
| **GET**     | `/api/wso2-api-platform/entities/:kind/:namespace/:name/documents/:documentId/content` | `wso2Api.getDocumentContentUrl(...)`        | Streams/redirects to document content.                                                                     |
| **GET**     | `/api/wso2-api-platform/entities/:kind/:namespace/:name/api-portal`                    | _(frontend, planned)_                       | API Portal publish capability check. OpenChoreo only.                                                      |
| **POST**    | `/api/wso2-api-platform/entities/:kind/:namespace/:name/api-portal/preview`            | _(frontend, planned)_                       | Builds the metadata payload and document publish/skip plan without calling the API Portal.                 |
| **POST**    | `/api/wso2-api-platform/entities/:kind/:namespace/:name/api-portal/publish`            | _(frontend, planned)_                       | Publishes the API's metadata, definition, and markdown documents to the API Portal.                        |
| **GET**     | `/api/wso2-api-platform/entities/:kind/:namespace/:name/api-portal/subscriptions`      | `wso2Api.getApiPortalSubscriptions(...)`    | Returns this API's selected subscription plan IDs and the available custom plan IDs.                       |
| **PUT**     | `/api/wso2-api-platform/entities/:kind/:namespace/:name/api-portal/subscriptions`      | `wso2Api.updateApiPortalSubscriptions(...)` | Replaces this API's selected subscription plan IDs.                                                        |

## Gateway Write Operations Lock

`wso2ApiPlatformGateway.enableWriteOperations` (default `false`) controls whether Definition and Policy edits are pushed directly to the gateway ("Full Sync Mode"), as opposed to being staged only in this plugin's own storage while an external process (e.g. an OpenChoreo workflow) reconciles the gateway separately ("OpenChoreo / External Flow Mode"). See the [top-level README](../../README.md#gateway-write-operations-mode) for the full behavior table.

**For this initial release, Full Sync Mode is hard-locked to disabled in code — the config value is ignored entirely.** `GATEWAY_WRITE_OPERATIONS_LOCKED` in [`src/service/config.ts`](./src/service/config.ts) forces the resolved value to `false` no matter what `enableWriteOperations` is set to in any config layer (app-config.yaml, an env var override, a production overlay, etc). The frontend plugin enforces an identical, independent lock (`GATEWAY_WRITE_OPERATIONS_LOCKED` in `wso2-api-platform`'s `src/utils/gatewayWriteAccess.ts`), so this isn't bypassable from the UI either.

**Why:** Full Sync Mode has no per-API or per-team authorization model yet. Every write route (`definitionRoutes.ts`, `policyRoutes.ts`) is gated only on "is this an authenticated Backstage user" — there is no check that the caller is actually allowed to modify this specific API's gateway. Enabling it today would let **any** authenticated Backstage user who holds valid gateway credentials modify **any** API on the gateway, not just ones they own or manage. That gap must be closed before this lock is removed.

**Re-enabling in a future release:** add the missing per-API/per-team authorization checks, then set `GATEWAY_WRITE_OPERATIONS_LOCKED` back to `false` in both this plugin and the frontend plugin so the `enableWriteOperations` config value takes effect again.

## Document storage

APIs discovered from self-hosted WSO2 gateways and OpenChoreo have no document
store of their own — the gateway only exposes runtime API config. This plugin
therefore owns a small relational store for their documents (create, view,
edit metadata, hard delete). On-prem APIM documents are unaffected: they
remain read-only, served from the catalog's `wso2.com/api-documents`
annotation and the legacy content-proxy route above.

**Markdown only for gateway-discovered APIs.** Self-hosted-gateway and
OpenChoreo document attachments accept `sourceType: MARKDOWN` only — the
WSO2 API Portal ingests markdown documents, so this is enforced in code
(`GATEWAY_DOCUMENT_SOURCE_TYPES` in `documents/types.ts`), not a config
option. On-prem APIM document types are unaffected by this restriction.

### Enabling and configuring

`wso2ApiPlatformStorage` is its own top-level config block, independent of
`wso2ApiPlatform` (on-prem discovery) — on-prem APIs already have their own
backing store on the APIM instance itself, so this only ever applies to
gateway-discovered APIs.

```yaml
wso2ApiPlatformStorage:
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

## API Portal publishing (OpenChoreo APIs)

OpenChoreo-discovered APIs can be published — metadata, definition, and
markdown documents — to a production WSO2 API Portal instance
(`/api-portal/api/v0.9`). There is no publish flow for self-hosted-gateway or
on-prem APIM APIs; self-hosted-gateway APIs do share the same markdown-only
document restriction, though (see "Document storage" above).

### Enabling and configuring

`wso2ApiPlatformApiPortal` is its own top-level config block, independent of
`wso2ApiPlatform` and `wso2ApiPlatformGateway` — publishing is meant to
eventually serve both on-prem and gateway-discovered APIs, even though only
gateway-discovered APIs can publish in this release (enforced in code, not
by this block's location).

```yaml
wso2ApiPlatformApiPortal:
  enabled: true
  baseUrl: ${WSO2_API_PORTAL_BASE_URL} # defaults to the production API Portal if omitted
  basePath: /api-portal/api/v0.9
  auth:
    mode: platform-login # see "Authentication" below; 'idp' is not implemented yet
  defaults:
    status: PUBLISHED
    agentVisibility: VISIBLE
    subscriptionPlans: [] # IDs of *custom* org plans offered for per-API selection — see "Subscription plans" below
  requestTimeoutSeconds: 30
  tls:
    rejectUnauthorized: true
```

Policies are never sent — the portal's metadata schema has no policy field,
and platform-api's own portal-publish flow does not send them either.

### Subscription plans

Every API is assumed to have four built-in subscription plans available on
the API Portal (`Bronze`, `Silver`, `Gold`, `Unlimited`); `defaults.subscriptionPlans`
above lists any additional _custom_ plan IDs the org has also provisioned
there. Which of these plans apply to a given API is chosen per-API in the
frontend's Overview tab (Subscription Plans panel) and persisted immediately
via:

- `GET .../api-portal/subscriptions` — returns `{ availableCustomPlanIds, selectedPlanIds }`.
- `PUT .../api-portal/subscriptions` — body `{ planIds: string[] }`; rejects with `400` for any ID that is neither a default nor a configured custom plan.

The persisted selection (not `defaults.subscriptionPlans`) is what gets sent
as `subscriptionPlans` when the API is published or previewed — an API with
no selection publishes with none. Selections are stored via the same
plugin-owned artifact store used for definitions and documents (see
`DatabaseApiSubscriptionPlanStore`).

### Labels

Unlike subscription plans, labels have no config or storage of their own —
there is no `defaults.labels` any more. Each publish request carries its own
`labels: string[]` (entered directly in the frontend's Publish dialog,
defaulting to `default`), validated against `GET .../labels` before the
Portal is called; an unknown label rejects the publish with `400` naming it,
instead of a raw 404 from the Portal.

### Authentication

The API Portal's own API supports two ways to authenticate: a Platform API
login, or an IdP-issued token. Only the Platform API login is implemented:

- **`platform-login`** (default): the backend holds no API Portal
  credentials of its own. The frontend logs into the Platform API on the
  user's behalf and forwards the resulting access token on every publish
  call, via the `x-api-portal-access-token` request header. The backend
  simply relays that token as the Bearer token to the API Portal — nothing
  is cached or persisted.
- **`idp`**: not implemented yet. Setting this mode while `enabled: true`
  fails at startup with a clear error; it's reserved for a future IdP-backed
  auth flow.

`POST .../api-portal/publish` returns `503` if the API Portal isn't
reachable (checked before any publish request is sent), and `401` if the
`x-api-portal-access-token` header is missing.

**Pre-existing org entities.** Any `labels` and `subscriptionPlans` sent must
already exist in the org — the portal links by name, it does not create
them.

## License

Apache-2.0
