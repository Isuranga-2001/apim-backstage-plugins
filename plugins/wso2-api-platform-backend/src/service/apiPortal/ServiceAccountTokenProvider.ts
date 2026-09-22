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
import { ResponseError } from '@backstage/errors';
import { Agent, fetch as undiciFetch } from 'undici';
import { ApiPortalConfig, ApiPortalServiceAccountConfig } from './config';
import { ApiPortalTokenProvider } from './tokenProvider';

// Refresh this long before actual expiry, to absorb request latency and
// clock drift between the plugin backend and the IdP.
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

/**
 * Authenticates the backend to the API Portal as its own service identity
 * via `grant_type=client_credentials` — no Backstage user's own login is
 * involved. The token is cached in memory until shortly before expiry.
 */
export class ServiceAccountTokenProvider implements ApiPortalTokenProvider {
  private readonly serviceAccount: ApiPortalServiceAccountConfig;
  private readonly dispatcher: Agent;
  private readonly requestTimeoutMs: number;
  private accessToken?: string;
  private tokenExpiresAt?: number;

  constructor(config: ApiPortalConfig, private readonly logger: LoggerService) {
    const serviceAccount = config.auth.idp?.serviceAccount;
    if (!serviceAccount) {
      throw new Error(
        'ServiceAccountTokenProvider requires wso2ApiPlatformApiPortal.auth.idp.serviceAccount to be configured',
      );
    }
    this.serviceAccount = serviceAccount;
    this.dispatcher = new Agent({
      connect: { rejectUnauthorized: config.tls.rejectUnauthorized },
    });
    this.requestTimeoutMs = config.requestTimeoutSeconds * 1000;
  }

  async getAccessToken(): Promise<string> {
    if (
      this.accessToken &&
      this.tokenExpiresAt &&
      Date.now() < this.tokenExpiresAt - EXPIRY_SAFETY_MARGIN_MS
    ) {
      return this.accessToken;
    }
    this.accessToken = undefined;
    this.tokenExpiresAt = undefined;

    this.logger.debug('[ServiceAccountTokenProvider] Fetching access token');

    const { tokenUrl, clientId, clientSecret, audience, scope } =
      this.serviceAccount;
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('scope', scope);
    if (audience) {
      params.append('audience', audience);
    }

    const response = await undiciFetch(tokenUrl, {
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
        `[ServiceAccountTokenProvider] Token request failed with status ${response.status}`,
      );
      throw await ResponseError.fromResponse(response);
    }

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      token_type?: string;
    };
    if (!data.access_token) {
      throw new Error(
        'API Portal service-account token grant: no access_token in response',
      );
    }

    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
    return this.accessToken;
  }
}
