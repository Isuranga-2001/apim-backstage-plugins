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

| HTTP Method | Backend Route                                                      | Frontend JavaScript Trigger   | Purpose                                                                              |
| ----------- | ------------------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------ |
| **POST**    | `/api/wso2-api-platform/apis/:apiId/generate-key`                  | `wso2Api.generateApiKey(...)` | Generates a temporary access token for the Gateway via Basic Auth/OAuth credentials. |
| **GET**     | `/api/wso2-api-platform/apis/:apiId/revisions`                     | `wso2Api.getRevisions(...)`   | Lists deployment revisions of an API in real-time.                                   |
| **GET**     | `/api/wso2-api-platform/apis/:apiId/wsdl`                          | `wso2Api.getApiWsdl(...)`     | Downloads the SOAP API WSDL file/archive payload.                                    |
| **GET**     | `/api/wso2-api-platform/apis/:apiId/documents/:documentId/content` | _Direct Link URL in UI_       | Streams document file downloads (PDF, MD, TXT, etc.) on-demand.                      |

## License

Apache-2.0
