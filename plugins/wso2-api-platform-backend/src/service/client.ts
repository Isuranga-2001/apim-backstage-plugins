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

import { LoggerService } from '@backstage/backend-plugin-api';
import { fetch as undiciFetch, Response } from 'undici';
import {
  Wso2ApiDocument,
  Wso2ApiPlatformConfig,
  Wso2ApiRevisionsResponse,
} from './types';
import { joinUrl } from './urlUtils';
import { Config } from '@backstage/config';
import { Wso2Client as BaseWso2Client } from '@wso2/backstage-plugin-catalog-backend-module-wso2-api-platform';

export { readWso2ApiPlatformConfig } from './config';

export class Wso2ApiPlatformClient extends BaseWso2Client {
  public readonly config: Wso2ApiPlatformConfig;
  private readonly publisherBaseUrl: string;
  private readonly devportalBaseUrl: string;
  private readonly serviceCatalogBaseUrl: string;

  constructor(options: {
    config: Wso2ApiPlatformConfig;
    rawConfig: Config;
    logger: LoggerService;
  }) {
    super({ config: options.rawConfig, logger: options.logger });
    this.config = options.config;
    this.publisherBaseUrl = joinUrl(
      options.config.baseUrl,
      options.config.publisherBasePath,
    );
    this.devportalBaseUrl = joinUrl(
      options.config.baseUrl,
      options.config.developerBasePath,
    );
    this.serviceCatalogBaseUrl = joinUrl(
      options.config.baseUrl,
      options.config.serviceCatalogBasePath || '/api/am/service-catalog/v1',
    );
  }

  /**
   * Extracts the most useful user-facing message from a failed WSO2 response.
   */
  private async extractWso2ErrorMessage(response: Response): Promise<string> {
    try {
      const body = await response.text();
      try {
        const json = JSON.parse(body);
        if (json.message && json.description) {
          return `${json.message}: ${json.description}`;
        }
        return json.message || json.description || body;
      } catch (e) {
        return body || response.statusText || `Status ${response.status}`;
      }
    } catch (e) {
      return response.statusText || `Status ${response.status}`;
    }
  }

  /**
   * Labels requests by the credential source used for diagnostics.
   */
  private getAuthContext(options: {
    hasAuthorizationHeader?: boolean;
    isUserToken: boolean;
  }): string {
    if (options.hasAuthorizationHeader) {
      return 'EXPLICIT-AUTHORIZATION';
    }
    return options.isUserToken ? 'USER' : 'SERVICE-ACCOUNT';
  }

  /**
   * Parses JSON responses and falls back to raw text for file-like endpoints.
   */
  private async parseResponseBody<T>(response: Response): Promise<T> {
    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  /**
   * Generates a DevPortal API key using the configured APIM user credentials.
   */
  async generateApiKey(
    apiId: string,
    options?: {
      keyName?: string;
      keyType?: string;
      validityPeriod?: number;
      additionalProperties?: {
        permittedIP?: string;
        permittedReferer?: string;
      };
    },
  ): Promise<Record<string, unknown>> {
    const encodedApiId = encodeURIComponent(apiId);
    const { username, password } = this.config.auth;
    if (!username || !password) {
      throw new Error(
        'WSO2 APIM username and password are required to generate API keys with Basic Auth',
      );
    }

    const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');

    return await this.requestDevportal<Record<string, unknown>>(
      `/apis/${encodedApiId}/api-keys/generate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options || {}),
      },
    );
  }

  private async requestDevportal<T>(
    path: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    },
  ): Promise<T> {
    const hasAuthorizationHeader = Object.keys(options?.headers ?? {}).some(
      header => header.toLowerCase() === 'authorization',
    );
    const accessToken = hasAuthorizationHeader
      ? undefined
      : await this.getAccessToken();
    const url = `${this.devportalBaseUrl}${path}`;
    const authContext = this.getAuthContext({
      hasAuthorizationHeader,
      isUserToken: false,
    });

    this.logger.debug(
      `[WSO2-Client] Fetching DevPortal ${url} using ${authContext} token`,
    );

    const response = await undiciFetch(url, {
      method: options?.method ?? 'GET',
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...(options?.headers ?? {}),
      },
      body: options?.body,
      dispatcher: this.dispatcher,
    });

    if (!response.ok) {
      const message = await this.extractWso2ErrorMessage(response);
      const errorMsg = `WSO2 DevPortal request failed (context: ${authContext}), status ${response.status}: ${message}`;
      this.logger.error(`[WSO2-Client] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    return await this.parseResponseBody<T>(response);
  }

  private async requestServiceCatalog<T>(
    path: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    },
  ): Promise<T> {
    const accessToken = await this.getAccessToken();
    const url = `${this.serviceCatalogBaseUrl}${path}`;

    this.logger.debug(
      `[WSO2-Client] Fetching Service Catalog ${url} using SERVICE-ACCOUNT token`,
    );

    const response = await undiciFetch(url, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...(options?.headers ?? {}),
      },
      body: options?.body,
      dispatcher: this.dispatcher,
    });

    if (!response.ok) {
      const message = await this.extractWso2ErrorMessage(response);
      const errorMsg = `WSO2 Service Catalog request failed, status ${response.status}: ${message}`;
      this.logger.error(`[WSO2-Client] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    return await this.parseResponseBody<T>(response);
  }

  /**
   * Lists services from the WSO2 service catalog.
   */
  async getServices(options?: {
    offset?: number;
    limit?: number;
    token?: string;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.offset !== undefined)
      params.set('offset', options.offset.toString());
    if (options?.limit !== undefined)
      params.set('limit', options.limit.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    return await this.requestServiceCatalog<any>(`/services${query}`, {});
  }

  /**
   * Fetches API usage references for a WSO2 service.
   */
  async getServiceUsage(serviceId: string): Promise<any> {
    const encodedServiceId = encodeURIComponent(serviceId);
    return await this.requestServiceCatalog<any>(
      `/services/${encodedServiceId}/usage`,
      {},
    );
  }

  /**
   * Fetches the raw service definition document.
   */
  async getServiceDefinition(serviceId: string): Promise<string> {
    const encodedServiceId = encodeURIComponent(serviceId);
    const accessToken = await this.getAccessToken();
    const url = `${this.serviceCatalogBaseUrl}/services/${encodedServiceId}/definition`;

    const response = await undiciFetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      dispatcher: this.dispatcher,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch service definition for ${serviceId}`);
    }
    const text = await response.text();
    return text;
  }
  /**
   * Lists publisher revisions for an API.
   */
  async getRevisions(
    apiId: string,
    options?: { query?: string; token?: string },
  ): Promise<Wso2ApiRevisionsResponse> {
    const encodedApiId = encodeURIComponent(apiId);
    const params = new URLSearchParams();
    if (options?.query) {
      params.set('query', options.query);
    }
    return await this.requestPublisher<Wso2ApiRevisionsResponse>(
      `/apis/${encodedApiId}/revisions?${params.toString()}`,
      {},
    );
  }

  /**
   * Lists document metadata for an API. Used by ApimPublisherDocumentStore
   * (the read-only on-prem document store) — the existing frontend Docs tab
   * for on-prem APIs instead reads the catalog's `wso2.com/api-documents`
   * annotation and does not call this.
   */
  async getDocuments(apiId: string): Promise<{ count: number; list: Wso2ApiDocument[] }> {
    const encodedApiId = encodeURIComponent(apiId);
    return await this.requestPublisher<{ count: number; list: Wso2ApiDocument[] }>(
      `/apis/${encodedApiId}/documents`,
      {},
    );
  }

  /**
   * Fetches document metadata for an API document.
   */
  async getDocument(
    apiId: string,
    documentId: string,
  ): Promise<Wso2ApiDocument> {
    const encodedApiId = encodeURIComponent(apiId);
    const encodedDocumentId = encodeURIComponent(documentId);
    return await this.requestPublisher<Wso2ApiDocument>(
      `/apis/${encodedApiId}/documents/${encodedDocumentId}`,
      {},
    );
  }

  /**
   * Opens a streaming response for API document content.
   */
  async getDocumentContentStream(
    apiId: string,
    documentId: string,
  ): Promise<Response> {
    const encodedApiId = encodeURIComponent(apiId);
    const encodedDocumentId = encodeURIComponent(documentId);
    return await this.fetchPublisherApi(
      `/apis/${encodedApiId}/documents/${encodedDocumentId}/content?t=${Date.now()}`,
      {
        headers: { Accept: '*/*' },
      },
    );
  }

  /**
   * Opens a streaming response for an API WSDL archive or document.
   */
  async getApiWsdlStream(apiId: string): Promise<Response> {
    const encodedApiId = encodeURIComponent(apiId);
    return await this.fetchPublisherApi(`/apis/${encodedApiId}/wsdl`, {
      headers: {
        Accept: 'application/zip, application/wsdl+xml, text/xml, */*',
      },
    });
  }

  /**
   * Fetches publisher settings, including configured APIM environments.
   */
  async getSettings(): Promise<any> {
    return await this.requestPublisher<any>('/settings', {});
  }

  /**
   * Returns the resolved runtime client configuration.
   */
  getConfig(): Wso2ApiPlatformConfig {
    return this.config;
  }

  private async fetchPublisherApi(
    path: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    },
  ): Promise<Response> {
    const accessToken = await this.getAccessToken();
    const url = `${this.publisherBaseUrl}${path}`;

    this.logger.debug(
      `[WSO2-Client] Fetching ${url} using SERVICE-ACCOUNT token`,
    );

    const response = await undiciFetch(url, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...(options?.headers ?? {}),
      },
      body: options?.body,
      dispatcher: this.dispatcher,
    });

    return response;
  }

  private async requestPublisher<T>(
    path: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    },
  ): Promise<T> {
    const response = await this.fetchPublisherApi(path, options);

    if (!response.ok) {
      const message = await this.extractWso2ErrorMessage(response);
      const errorMsg = `WSO2 Publisher request failed (context: SERVICE-ACCOUNT), status ${
        response.status
      }: ${message.substring(0, 500)}`;
      this.logger.error(`[WSO2-Client] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    return await this.parseResponseBody<T>(response);
  }

  /**
   * Fetches gateway APIs from the discovery URL.
   */
  async getGatewayApis(discoveryUrl: string, auth?: string): Promise<any[]> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (auth) {
      headers.Authorization = auth;
    }

    this.logger.info(
      `[WSO2-GATEWAY-DISCOVERY] Attempting to fetch APIs from gateway discovery URL: ${discoveryUrl} (Auth present: ${!!auth})`,
    );

    try {
      const response = await undiciFetch(discoveryUrl, {
        headers,
        dispatcher: this.dispatcher,
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(
          `[WSO2-GATEWAY-DISCOVERY] Gateway Discovery failed for ${discoveryUrl}. Status: ${response.status}. Response: ${errText}`,
        );
        throw new Error(
          `Failed to fetch APIs from gateway ${discoveryUrl}, status ${response.status}`,
        );
      }

      const json = (await response.json()) as any;
      let result: any[];
      if (Array.isArray(json.apis)) {
        result = json.apis;
      } else if (Array.isArray(json.list)) {
        result = json.list;
      } else if (Array.isArray(json.items)) {
        result = json.items;
      } else {
        result = Array.isArray(json) ? json : [json];
      }

      this.logger.debug(
        `[WSO2-GATEWAY-DISCOVERY] Found ${
          result.length
        } APIs from gateway ${discoveryUrl}. Sample data: ${JSON.stringify(
          result[0] || {},
        )}`,
      );
      return result;
    } catch (e: any) {
      this.logger.error(
        `[WSO2-GATEWAY-DISCOVERY] Error fetching gateway APIs from ${discoveryUrl}: ${e.message}`,
      );
      throw e;
    }
  }

  /**
   * Returns the resolved publisher API base URL.
   */
  getPublisherBaseUrl(): string {
    return this.publisherBaseUrl;
  }

  /**
   * Returns the resolved DevPortal API base URL.
   */
  getDevportalBaseUrl(): string {
    return this.devportalBaseUrl;
  }

  /**
   * Returns the resolved service catalog API base URL.
   */
  getServiceCatalogBaseUrl(): string {
    return this.serviceCatalogBaseUrl;
  }
}
