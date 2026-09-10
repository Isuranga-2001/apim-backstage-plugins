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

import { CompoundEntityRef } from '@backstage/catalog-model';
import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import {
  CreateWso2ApiDocumentRequest,
  UpdateWso2ApiDocumentMetadataRequest,
  UpsertWso2ApiDefinitionRequest,
  Wso2ApiDefinitionResponse,
  Wso2ApiDocument,
  Wso2ApiDocumentListResponse,
  Wso2ApiRevisionsResponse,
  Wso2ApiPlatformApi,
  Wso2ApiPlatformRuntimeConfig,
  Wso2DefinitionDiffResponse,
  Wso2GatewaySummary,
  Wso2GenerateApiKeyOptions,
} from './types';

/**
 * Client for interacting with the WSO2 API Manager backend.
 */
export class Wso2ApiPlatformClient implements Wso2ApiPlatformApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  private async getBaseUrl(): Promise<string> {
    return await this.discoveryApi.getBaseUrl('wso2-api-platform');
  }

  /**
   * Helper to perform requests to the WSO2 API Manager backend.
   */
  private async request<T>(
    path: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: any;
      token?: string;
      query?: URLSearchParams;
    },
  ): Promise<T> {
    const baseUrl = await this.getBaseUrl();
    const url = new URL(`${baseUrl}${path}`);
    if (options?.query) {
      options.query.forEach((value, key) => {
        url.searchParams.append(key, value);
      });
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (options?.token) {
      headers['X-WSO2-Access-Token'] = options.token;
    }

    if (options?.method === 'POST' || options?.method === 'PUT') {
      headers['Content-Type'] = 'application/json';
    }

    const response = await this.fetchApi.fetch(url.toString(), {
      method: options?.method || 'GET',
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    return this.parseJsonResponse<T>(response);
  }

  /**
   * Same response handling as `request<T>()`, factored out so the
   * multipart document-create path (which cannot set a JSON Content-Type
   * header — the browser must set its own multipart boundary) can share it.
   */
  private async parseJsonResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(this.extractErrorMessage(response.status, errorText));
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      return {} as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch (e) {
      throw new Error(`Failed to parse WSO2 API response: ${text}`);
    }
  }

  /** Prefers Backstage's `{error:{message}}` envelope over the raw response body. */
  private extractErrorMessage(status: number, errorText: string): string {
    try {
      const parsed = JSON.parse(errorText);
      const message = parsed?.error?.message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    } catch {
      // Not a JSON error envelope (e.g. an HTML error page); fall through.
    }
    return `WSO2 API request failed [${status}]: ${errorText}`;
  }

  private entityDocumentsPath(entityRef: CompoundEntityRef): string {
    const kind = encodeURIComponent(entityRef.kind.toLowerCase());
    const namespace = encodeURIComponent(entityRef.namespace || 'default');
    const name = encodeURIComponent(entityRef.name);
    return `/entities/${kind}/${namespace}/${name}/documents`;
  }

  private entityDefinitionPath(entityRef: CompoundEntityRef): string {
    const kind = encodeURIComponent(entityRef.kind.toLowerCase());
    const namespace = encodeURIComponent(entityRef.namespace || 'default');
    const name = encodeURIComponent(entityRef.name);
    return `/entities/${kind}/${namespace}/${name}/definition`;
  }

  async generateApiKey(
    apiId: string,
    options?: Wso2GenerateApiKeyOptions,
  ): Promise<any> {
    return this.request<any>(
      `/apis/${encodeURIComponent(apiId)}/generate-key`,
      {
        method: 'POST',
        body: options,
      },
    );
  }

  async getRevisions(
    apiId: string,
    options?: { query?: string; token?: string },
  ): Promise<Wso2ApiRevisionsResponse> {
    const query = options?.query
      ? new URLSearchParams({ query: options.query })
      : undefined;
    return this.request<Wso2ApiRevisionsResponse>(
      `/apis/${encodeURIComponent(apiId)}/revisions`,
      {
        token: options?.token,
        query,
      },
    );
  }

  async getGateways(token?: string): Promise<Wso2GatewaySummary[]> {
    const result = await this.request<Wso2GatewaySummary[]>('/gateways', {
      token,
    });
    return Array.isArray(result) ? result : [];
  }

  async getRuntimeConfig(
    token?: string,
  ): Promise<Wso2ApiPlatformRuntimeConfig> {
    return this.request<Wso2ApiPlatformRuntimeConfig>('/config', { token });
  }

  async getApiWsdl(apiId: string, token?: string): Promise<Blob> {
    const baseUrl = await this.getBaseUrl();
    const url = new URL(`${baseUrl}/apis/${encodeURIComponent(apiId)}/wsdl`);
    const headers: Record<string, string> = {};
    if (token) {
      headers['X-WSO2-Access-Token'] = token;
    }
    const response = await this.fetchApi.fetch(url.toString(), { headers });
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(this.extractErrorMessage(response.status, errorText));
    }
    return response.blob();
  }

  async listDocuments(
    entityRef: CompoundEntityRef,
  ): Promise<Wso2ApiDocumentListResponse> {
    return this.request<Wso2ApiDocumentListResponse>(
      this.entityDocumentsPath(entityRef),
    );
  }

  async getDocument(
    entityRef: CompoundEntityRef,
    documentId: string,
  ): Promise<Wso2ApiDocument> {
    return this.request<Wso2ApiDocument>(
      `${this.entityDocumentsPath(entityRef)}/${encodeURIComponent(
        documentId,
      )}`,
    );
  }

  async createDocument(
    entityRef: CompoundEntityRef,
    input: CreateWso2ApiDocumentRequest,
  ): Promise<Wso2ApiDocument> {
    const path = this.entityDocumentsPath(entityRef);

    if (input.sourceType === 'FILE') {
      if (!input.file) {
        throw new Error("A file is required when sourceType is 'FILE'");
      }
      const { file, ...metadata } = input;
      const formData = new FormData();
      formData.append('metadata', JSON.stringify(metadata));
      formData.append('file', file, file.name);

      const baseUrl = await this.getBaseUrl();
      const response = await this.fetchApi.fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
      });
      return this.parseJsonResponse<Wso2ApiDocument>(response);
    }

    return this.request<Wso2ApiDocument>(path, {
      method: 'POST',
      body: input,
    });
  }

  async updateDocumentMetadata(
    entityRef: CompoundEntityRef,
    documentId: string,
    patch: UpdateWso2ApiDocumentMetadataRequest,
  ): Promise<Wso2ApiDocument> {
    return this.request<Wso2ApiDocument>(
      `${this.entityDocumentsPath(entityRef)}/${encodeURIComponent(
        documentId,
      )}`,
      { method: 'PUT', body: patch },
    );
  }

  async deleteDocument(
    entityRef: CompoundEntityRef,
    documentId: string,
  ): Promise<void> {
    await this.request<void>(
      `${this.entityDocumentsPath(entityRef)}/${encodeURIComponent(
        documentId,
      )}`,
      { method: 'DELETE' },
    );
  }

  async getDocumentContentUrl(
    entityRef: CompoundEntityRef,
    documentId: string,
  ): Promise<string> {
    const baseUrl = await this.getBaseUrl();
    return `${baseUrl}${this.entityDocumentsPath(
      entityRef,
    )}/${encodeURIComponent(documentId)}/content`;
  }

  async getDefinition(
    entityRef: CompoundEntityRef,
  ): Promise<Wso2ApiDefinitionResponse> {
    return this.request<Wso2ApiDefinitionResponse>(
      this.entityDefinitionPath(entityRef),
    );
  }

  async upsertDefinition(
    entityRef: CompoundEntityRef,
    input: UpsertWso2ApiDefinitionRequest,
  ): Promise<Wso2ApiDefinitionResponse> {
    return this.request<Wso2ApiDefinitionResponse>(
      this.entityDefinitionPath(entityRef),
      { method: 'PUT', body: input },
    );
  }

  async previewDefinitionDiff(
    entityRef: CompoundEntityRef,
    content: string,
  ): Promise<Wso2DefinitionDiffResponse> {
    return this.request<Wso2DefinitionDiffResponse>(
      `${this.entityDefinitionPath(entityRef)}/diff`,
      { method: 'POST', body: { content } },
    );
  }
}
