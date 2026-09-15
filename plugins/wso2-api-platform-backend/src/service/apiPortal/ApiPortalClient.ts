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

import { ConflictError, ServiceUnavailableError } from '@backstage/errors';
import { LoggerService } from '@backstage/backend-plugin-api';
import { Agent, fetch as undiciFetch, Response } from 'undici';
import { joinUrl } from '../urlUtils';
import { ApiPortalConfig } from './config';
import { PortalApiForm, PortalApiMetadataResponse } from './types';

async function extractPortalErrorMessage(response: Response): Promise<string> {
  let body: string;
  try {
    body = await response.text();
  } catch {
    return response.statusText || `Status ${response.status}`;
  }
  try {
    const json = JSON.parse(body) as {
      message?: string;
      errors?: Array<{ field: string; message: string }>;
    };
    const fieldErrors = Array.isArray(json.errors)
      ? json.errors.map(e => `${e.field}: ${e.message}`).join('; ')
      : '';
    const message = [json.message, fieldErrors].filter(Boolean).join(' — ');
    return (message || body || response.statusText).substring(0, 500);
  } catch {
    return (
      body ||
      response.statusText ||
      `Status ${response.status}`
    ).substring(0, 500);
  }
}

export class ApiPortalClient {
  private readonly baseUrl: string;
  private readonly dispatcher: Agent;

  constructor(
    private readonly config: ApiPortalConfig,
    private readonly logger: LoggerService,
  ) {
    this.baseUrl = joinUrl(config.baseUrl, config.basePath);
    this.dispatcher = new Agent({
      connect: { rejectUnauthorized: config.tls.rejectUnauthorized },
    });
  }

  async checkAccessible(): Promise<void> {
    try {
      await undiciFetch(this.baseUrl, {
        method: 'GET',
        dispatcher: this.dispatcher,
        signal: AbortSignal.timeout(
          Math.min(this.config.requestTimeoutSeconds, 10) * 1000,
        ),
      });
    } catch (e: any) {
      throw new ServiceUnavailableError(
        `API Portal at ${this.config.baseUrl} is not reachable: ${e.message}`,
      );
    }
  }

  async getApi(
    apiId: string,
    token: string,
  ): Promise<PortalApiMetadataResponse | undefined> {
    const response = await this.request(`/apis/${encodeURIComponent(apiId)}`, {
      method: 'GET',
      token,
    });
    if (response.status === 404) {
      return undefined;
    }
    await this.assertOk(response, 'fetch API metadata from the API Portal');
    return (await response.json()) as PortalApiMetadataResponse;
  }

  async createApi(
    form: PortalApiForm,
    token: string,
  ): Promise<PortalApiMetadataResponse> {
    const response = await this.request('/apis', {
      method: 'POST',
      token,
      body: this.buildMetadataForm(form),
    });
    await this.assertOk(response, 'create API metadata in the API Portal');
    return (await response.json()) as PortalApiMetadataResponse;
  }

  async updateApi(
    apiId: string,
    form: PortalApiForm,
    token: string,
  ): Promise<PortalApiMetadataResponse> {
    const response = await this.request(`/apis/${encodeURIComponent(apiId)}`, {
      method: 'PUT',
      token,
      body: this.buildMetadataForm(form),
    });
    await this.assertOk(response, 'update API metadata in the API Portal');
    return (await response.json()) as PortalApiMetadataResponse;
  }

  async putContent(
    apiId: string,
    zip: Buffer,
    token: string,
    docMetadata?: unknown,
  ): Promise<void> {
    const form = new FormData();
    const content = new ArrayBuffer(zip.byteLength);
    new Uint8Array(content).set(zip);
    form.append(
      'content',
      new Blob([content], { type: 'application/zip' }),
      'content.zip',
    );
    if (docMetadata !== undefined) {
      form.append('docMetadata', JSON.stringify(docMetadata));
    }
    const response = await this.request(
      `/apis/${encodeURIComponent(apiId)}/assets`,
      { method: 'PUT', token, body: form },
    );
    await this.assertOk(response, 'upload API content to the API Portal');
  }

  private buildMetadataForm(form: PortalApiForm): FormData {
    const fd = new FormData();
    fd.append('metadata', JSON.stringify(form.metadata));
    fd.append(
      'definition',
      new Blob([form.definitionContent], { type: 'text/plain' }),
      form.definitionFileName,
    );
    return fd;
  }

  private async request(
    path: string,
    options: { method: string; token: string; body?: FormData },
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    this.logger.debug(`[ApiPortal-Client] ${options.method} ${url}`);
    return undiciFetch(url, {
      method: options.method,
      headers: { Authorization: `Bearer ${options.token}` },
      // FormData body type mismatch in undici typings.
      body: options.body as any,
      dispatcher: this.dispatcher,
      signal: AbortSignal.timeout(this.config.requestTimeoutSeconds * 1000),
    });
  }

  private async assertOk(response: Response, action: string): Promise<void> {
    if (response.ok) {
      return;
    }
    const message = await extractPortalErrorMessage(response);
    if (response.status === 401 || response.status === 403) {
      const errorMsg =
        `Failed to ${action} (status ${response.status}): the forwarded token ` +
        `was rejected by the API Portal — check audience, org claim and ` +
        `dp:* scopes. ${message}`;
      this.logger.error(`[ApiPortal-Client] ${errorMsg}`);
      throw new ConflictError(errorMsg);
    }
    const errorMsg = `Failed to ${action} (status ${response.status}): ${message}`;
    this.logger.error(`[ApiPortal-Client] ${errorMsg}`);
    if (response.status >= 400 && response.status < 500) {
      throw new ConflictError(errorMsg);
    }
    throw new Error(errorMsg);
  }
}
