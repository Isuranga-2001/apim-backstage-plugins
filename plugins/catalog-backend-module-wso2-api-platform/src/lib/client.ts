/*
 * Copyright (c) 2026, WSO2 LLC. (http://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { fetch as undiciFetch, Agent } from 'undici';
import type { Response } from 'undici';
import { ResponseError } from '@backstage/errors';

/**
 * A resilient client for interacting with the WSO2 API Manager.
 */
export class Wso2Client {
  protected readonly baseUrl: string;

  protected readonly clientId: string;
  protected readonly clientSecret: string;
  protected readonly logger: LoggerService;
  protected readonly dispatcher: Agent;
  protected readonly publisherBasePath: string;
  protected readonly serviceCatalogBasePath: string;
  protected readonly scopes: string;
  protected readonly requestTimeoutMs: number;
  protected accessToken?: string;
  protected tokenExpiresAt?: number;
  protected readonly tokenUrl: string;

  constructor(options: { config: Config; logger: LoggerService }) {
    // API Manager connection settings are only required when the API Manager
    // integration is enabled; the client can still be constructed without
    // them (e.g. for gateway-only deployments) as long as no API Manager
    // request is made.
    const apiManagerEnabled =
      options.config.getOptionalBoolean('wso2ApiPlatform.enabled') ?? false;

    this.baseUrl = apiManagerEnabled
      ? options.config.getString('wso2ApiPlatform.baseUrl')
      : '';

    this.clientId = apiManagerEnabled
      ? options.config.getString('wso2ApiPlatform.auth.clientId')
      : '';
    this.clientSecret = apiManagerEnabled
      ? options.config.getString('wso2ApiPlatform.auth.clientSecret')
      : '';
    this.logger = options.logger;

    const rejectUnauthorized =
      options.config.getOptionalBoolean(
        'wso2ApiPlatform.tls.rejectUnauthorized',
      ) ?? true;
    this.dispatcher = new Agent({ connect: { rejectUnauthorized } });

    this.publisherBasePath = apiManagerEnabled
      ? options.config.getString('wso2ApiPlatform.publisherBasePath')
      : '';
    this.serviceCatalogBasePath =
      options.config.getOptionalString(
        'wso2ApiPlatform.serviceCatalogBasePath',
      ) ?? '/api/am/service-catalog/v1';
    this.requestTimeoutMs =
      (options.config.getOptionalNumber(
        'wso2ApiPlatform.requestTimeoutSeconds',
      ) ?? 30) * 1000;
    const requiredScopes = apiManagerEnabled
      ? options.config.getStringArray('wso2ApiPlatform.auth.requiredScopes')
      : [];
    this.scopes = Array.from(new Set([...requiredScopes])).join(' ');

    // Token URL configuration: use explicit tokenUrl if provided, otherwise default to baseUrl/oauth2/token
    this.tokenUrl =
      options.config.getOptionalString('wso2ApiPlatform.auth.tokenUrl') ??
      `${this.baseUrl}/oauth2/token`;
  }

  /**
   * Performs a resilient GET request.
   */
  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  /**
   * Performs a resilient GET request returning text.
   */
  async getText(path: string): Promise<string> {
    return this.requestText('GET', path);
  }

  /**
   * Returns the dispatcher for manual fetch calls (e.g. gateway discovery).
   */
  getDispatcher(): Agent {
    return this.dispatcher;
  }

  /**
   * Returns the base path for the publisher API.
   */
  getPublisherBasePath(): string {
    return this.publisherBasePath;
  }

  /**
   * Returns the base path for the service catalog API.
   */
  getServiceCatalogBasePath(): string {
    return this.serviceCatalogBasePath;
  }

  protected async request<T>(
    method: string,
    path: string,
    body?: any,
  ): Promise<T> {
    return this.requestWithParser(method, path, {
      accept: 'application/json',
      body,
      parse: response => response.json() as Promise<T>,
    });
  }

  protected async requestText(
    method: string,
    path: string,
    body?: any,
  ): Promise<string> {
    return this.requestWithParser(method, path, {
      accept:
        'application/wsdl+xml, text/xml, application/xml, text/plain, */*',
      body,
      parse: response => response.text(),
    });
  }

  protected async requestWithParser<T>(
    method: string,
    path: string,
    options: {
      accept: string;
      body?: any;
      parse: (response: Response) => Promise<T>;
    },
  ): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        this.logger.debug(`[Wso2Client] ${method} ${url}`);
        const token = await this.getAccessToken();
        const response = await undiciFetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: options.accept,
            'Content-Type': 'application/json',
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
          dispatcher: this.dispatcher,
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        });

        if (!response.ok) {
          throw await ResponseError.fromResponse(response);
        }

        return await options.parse(response as unknown as Response);
      } catch (error: any) {
        lastError = error;

        const status = error.status ?? error.statusCode;
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
          throw new Error(
            `[Wso2Client] ${method} ${url} timed out after ${
              this.requestTimeoutMs / 1000
            }s`,
          );
        }

        // Don't retry on 4xx errors (except 401/429)
        if (
          status &&
          status >= 400 &&
          status < 500 &&
          status !== 401 &&
          status !== 429
        ) {
          throw error;
        }

        if (attempt < 3) {
          const delay = Math.pow(2, attempt) * 1000;
          const cause = error.cause ? ` (Cause: ${error.cause})` : '';
          this.logger.warn(
            `[Wso2Client] Request failed (${error.message}${cause}). Retrying in ${delay}ms... (Attempt ${attempt}/3)`,
          );
          await new Promise(resolve => setTimeout(resolve, delay));

          if (status === 401) {
            this.accessToken = undefined; // Force token refresh on next attempt
          }
        }
      }
    }

    throw lastError || new Error(`Request to ${url} failed after 3 attempts`);
  }

  protected async getAccessToken(): Promise<string> {
    if (
      this.accessToken &&
      this.tokenExpiresAt &&
      Date.now() < this.tokenExpiresAt - 60000
    ) {
      return this.accessToken;
    }
    // Clear stale token
    this.accessToken = undefined;
    this.tokenExpiresAt = undefined;

    this.logger.debug(`[Wso2Client] Fetching access token`);

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );

    const params = new URLSearchParams();
    // Always use client_credentials grant type as JWT bearer is not needed
    params.append('grant_type', 'client_credentials');
    params.append('scope', this.scopes);

    const response = await undiciFetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      dispatcher: this.dispatcher,
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });

    if (!response.ok) {
      this.logger.error(
        `[Wso2Client] Token request failed with status ${response.status}`,
      );
      throw await ResponseError.fromResponse(response);
    }

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      scope?: string;
      token_type?: string;
    };
    if (!data.access_token) {
      throw new Error('WSO2 token grant: no access_token in response');
    }

    this.logger.debug(
      `[Wso2Client] Successfully obtained ${
        data.token_type ?? 'Bearer'
      } access token with scopes: ${data.scope ?? this.scopes}`,
    );
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
    return this.accessToken;
  }

  async getApiDefinition(
    apiId: string,
    apiType: string,
    apiName: string,
  ): Promise<string> {
    const basePath = this.getPublisherBasePath();
    const isAsyncApi = ['WEBSUB', 'WS', 'SSE', 'ASYNC'].includes(apiType);

    if (apiType === 'GRAPHQL') {
      try {
        const data = await this.getText(
          `${basePath}/apis/${apiId}/graphql-schema`,
        );
        // if the response is actually JSON, try to parse it
        try {
          const parsed = JSON.parse(data);
          if (parsed && typeof parsed.schemaDefinition === 'string') {
            return parsed.schemaDefinition;
          }
          if (parsed && typeof parsed.schema === 'string') {
            return parsed.schema;
          }
        } catch (e) {
          // not json, return as text
        }
        return data;
      } catch (error: any) {
        this.logger.warn(
          `[Wso2Client] Error fetching GraphQL schema for API ${apiId}: ${error}`,
        );
        return `WSO2 API Document content placeholder for ${apiName}. Status: ${
          error.status || 'unknown'
        }`;
      }
    }

    const definitionUrl = isAsyncApi
      ? `${basePath}/apis/${apiId}/asyncapi`
      : `${basePath}/apis/${apiId}/swagger`;

    try {
      const data = await this.get<any>(definitionUrl);
      return JSON.stringify(data);
    } catch (error: any) {
      this.logger.warn(
        `[Wso2Client] Error fetching definition for API ${apiId}: ${error}`,
      );
      return `WSO2 API Document content placeholder for ${apiName}. Status: ${
        error.status || 'unknown'
      }`;
    }
  }

  /**
   * Fetches the documentation associated with an API.
   */
  async getApiDocuments(apiId: string): Promise<any[]> {
    const basePath = this.getPublisherBasePath();
    try {
      const data = await this.get<any>(`${basePath}/apis/${apiId}/documents`);
      return (data.list || []).map((doc: any) => ({
        ...doc,
        id: doc.id || doc.documentId,
      }));
    } catch (error) {
      this.logger.warn(
        `[Wso2Client] Error fetching documents for API ${apiId}: ${error}`,
      );
    }
    return [];
  }

  /**
   * Fetches the WSDL definition if it is a SOAP/SOAPTOREST API.
   */
  async getApiWsdl(apiId: string): Promise<string | undefined> {
    const basePath = this.getPublisherBasePath();
    const wsdlUrl = `${basePath}/apis/${apiId}/wsdl`;

    try {
      const data = await this.getText(wsdlUrl);
      if (data.startsWith('PK')) {
        return undefined;
      }
      return data;
    } catch (error: any) {
      this.logger.warn(
        `[Wso2Client] Error fetching WSDL for API ${apiId}: ${error}`,
      );
      return undefined;
    }
  }

  /**
   * Fetches the detailed metadata for a single API.
   */
  async getApiDetail(
    apiSummary: any & { id: string; name: string; type: string },
  ): Promise<any> {
    const apiId = apiSummary.id;
    const apiName = apiSummary.name || apiId;
    this.logger.debug(
      `[Wso2Client] Fetching detail for API "${apiName}" (${apiId})`,
    );

    let api = { ...apiSummary };

    try {
      const basePath = this.getPublisherBasePath();
      const detailData = await this.get<any>(`${basePath}/apis/${apiId}`);
      api = { ...api, ...detailData };

      api.documents = await this.getApiDocuments(apiId);
      api.definition = await this.getApiDefinition(apiId, api.type, api.name);

      if (['SOAP', 'SOAPTOREST'].includes(api.type)) {
        api.wsdlDefinition = await this.getApiWsdl(apiId);
      }
    } catch (error) {
      this.logger.error(
        `[Wso2Client] Error fetching detail for API ${apiId}: ${error}`,
      );
    }

    return api;
  }

  /**
   * Fetches the list of all APIs from the WSO2 Publisher.
   */
  async getApiList(options?: {
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const basePath = this.getPublisherBasePath();
    const limit = options?.limit ?? 1000;
    const offset = options?.offset ?? 0;

    return this.get<any>(`${basePath}/apis?limit=${limit}&offset=${offset}`);
  }

  // --- MCP Endpoints ---
  async getMcpDocuments(mcpId: string): Promise<any[]> {
    const basePath = this.getPublisherBasePath();
    try {
      const data = await this.get<any>(
        `${basePath}/mcp-servers/${mcpId}/documents`,
      );
      return (data.list || []).map((doc: any) => ({
        ...doc,
        id: doc.id || doc.documentId,
      }));
    } catch (error) {
      this.logger.warn(
        `[Wso2Client] Error fetching documents for MCP Server ${mcpId}: ${error}`,
      );
    }
    return [];
  }

  async getMcpServerDetail(mcpSummary: any): Promise<any> {
    const startedAt = Date.now();
    const mcpId = mcpSummary.id;
    const mcp = { ...mcpSummary };
    try {
      const basePath = this.getPublisherBasePath();
      const detailData = await this.get<any>(
        `${basePath}/mcp-servers/${mcpId}`,
      );
      const operations = detailData.operations || [];
      mcp.tools = operations
        .filter((op: any) => op.feature === 'TOOL')
        .map((op: any) => ({
          name: op.target,
          description: op.description,
          authType: op.authType,
          throttlingPolicy: op.throttlingPolicy,
          schemaDefinition: op.schemaDefinition,
          ...(op.apiOperationMapping?.backendOperation
            ? { backendOperation: op.apiOperationMapping.backendOperation }
            : {}),
        }));
      mcp.documents = await this.getMcpDocuments(mcpId);
    } catch (error) {
      this.logger.error(
        `[Wso2Client] Error fetching detail for MCP Server ${mcpId}: ${error}`,
      );
    }
    this.logger.debug(
      `[Wso2Client] MCP Server detail "${
        mcp.name || mcpId
      }" (${mcpId}) loaded in ${Date.now() - startedAt}ms.`,
    );
    return mcp;
  }

  async getMcpServerList(): Promise<any> {
    const basePath = this.getPublisherBasePath();
    return this.get<any>(`${basePath}/mcp-servers`);
  }

  // --- API Product Endpoints ---
  async getApiProductDefinition(
    productId: string,
    productName: string,
  ): Promise<string> {
    const basePath = this.getPublisherBasePath();
    try {
      const swaggerData = await this.get<any>(
        `${basePath}/api-products/${productId}/swagger`,
      );
      return JSON.stringify(swaggerData);
    } catch (error) {
      this.logger.warn(
        `[Wso2Client] Error fetching definition for API Product ${productId}: ${error}`,
      );
    }
    return `WSO2 API Product definition placeholder for ${productName}`;
  }

  async getApiProductDetail(productSummary: any): Promise<any> {
    const productId = productSummary.id;
    const product = { ...productSummary };
    try {
      const basePath = this.getPublisherBasePath();
      const detailData = await this.get<any>(
        `${basePath}/api-products/${productId}`,
      );
      Object.assign(product, detailData);
      product.definition = await this.getApiProductDefinition(
        productId,
        product.name,
      );
    } catch (error) {
      this.logger.error(
        `[Wso2Client] Error fetching detail for API Product ${productId}: ${error}`,
      );
    }
    return product;
  }

  async getApiProductList(): Promise<any> {
    const basePath = this.getPublisherBasePath();
    return this.get<any>(`${basePath}/api-products`);
  }

  // --- Service Catalog Endpoints ---
  async getServiceUsage(serviceId: string): Promise<any[]> {
    const basePath = this.getServiceCatalogBasePath();
    try {
      const data = await this.get<any>(
        `${basePath}/services/${encodeURIComponent(serviceId)}/usage`,
      );
      return data?.list || [];
    } catch (error: any) {
      this.logger.warn(
        `[Wso2Client] Error fetching usage for service ${serviceId}: ${error}`,
      );
      return [];
    }
  }

  async getServiceDefinition(serviceId: string): Promise<string> {
    const basePath = this.getServiceCatalogBasePath();
    try {
      return await this.getText(
        `${basePath}/services/${encodeURIComponent(serviceId)}/definition`,
      );
    } catch (error: any) {
      this.logger.warn(
        `[Wso2Client] Error fetching definition for service ${serviceId}: ${error}`,
      );
      return `WSO2 Service Definition content placeholder. Status: ${
        error.status || 'unknown'
      }`;
    }
  }

  async getServiceList(options?: {
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const basePath = this.getServiceCatalogBasePath();
    const limit = options?.limit ?? 1000;
    const offset = options?.offset ?? 0;
    return this.get<any>(
      `${basePath}/services?limit=${limit}&offset=${offset}`,
    );
  }

  // --- Global Settings Endpoints ---
  async getGlobalSettings(): Promise<any | undefined> {
    const basePath = this.getPublisherBasePath();
    try {
      const data = await this.get<any>(`${basePath}/settings`);
      this.logger.info(
        `[Wso2Client] Successfully retrieved global settings with ${
          data?.environment?.length || 0
        } environments.`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `[Wso2Client] Error fetching global settings: ${error}`,
      );
    }
    return undefined;
  }

  // --- Gateway Endpoints ---
  async getGatewayApis(discoveryUrl: string, auth?: string): Promise<any> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (auth) headers.Authorization = auth;
    const response = await undiciFetch(discoveryUrl, {
      headers,
      dispatcher: this.dispatcher,
    });
    if (!response.ok) {
      throw new Error(`Gateway request failed with status ${response.status}`);
    }
    return response.json();
  }

  async getGatewayApiDetail(
    discoveryUrl: string,
    apiId: string,
    auth?: string,
  ): Promise<any> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (auth) headers.Authorization = auth;
    const response = await undiciFetch(`${discoveryUrl}/${apiId}`, {
      headers,
      dispatcher: this.dispatcher,
    });
    if (!response.ok) {
      throw new Error(
        `Gateway detail request failed with status ${response.status}`,
      );
    }
    return response.json();
  }
}
