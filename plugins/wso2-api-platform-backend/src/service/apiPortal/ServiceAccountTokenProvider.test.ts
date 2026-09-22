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

import { fetch as undiciFetch } from 'undici';
import { mockServices } from '@backstage/backend-test-utils';
import { ServiceAccountTokenProvider } from './ServiceAccountTokenProvider';
import { ApiPortalConfig } from './config';

jest.mock('undici', () => {
  const actual = jest.requireActual('undici');
  return {
    ...actual,
    fetch: jest.fn(),
    Agent: jest.fn().mockImplementation(() => ({ close: jest.fn() })),
  };
});

const mockFetch = jest.mocked(undiciFetch);

function buildConfig(
  overrides: Partial<
    NonNullable<ApiPortalConfig['auth']['idp']>['serviceAccount']
  > = {},
): ApiPortalConfig {
  return {
    enabled: true,
    baseUrl: 'https://portal.example.com',
    basePath: '/api-portal/api/v0.9',
    auth: {
      mode: 'idp',
      idp: {
        strategy: 'service-account',
        serviceAccount: {
          tokenUrl: 'https://idp.example.com/oauth2/token',
          clientId: 'client-id',
          clientSecret: 'client-secret',
          scope: 'dp:api:manage',
          ...overrides,
        },
      },
    },
    defaults: {
      status: 'PUBLISHED',
      subscriptionPlans: [],
      agentVisibility: 'VISIBLE',
    },
    requestTimeoutSeconds: 30,
    tls: { rejectUnauthorized: true },
  };
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as any;
}

describe('ServiceAccountTokenProvider', () => {
  const logger = mockServices.logger.mock();

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('throws if constructed without a serviceAccount config', () => {
    const config = buildConfig();
    config.auth.idp!.serviceAccount = undefined;
    expect(() => new ServiceAccountTokenProvider(config, logger)).toThrow(
      /serviceAccount to be configured/,
    );
  });

  it('fetches a token via client_credentials and returns it', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ access_token: 'token-1', expires_in: 3600 }),
    );
    const provider = new ServiceAccountTokenProvider(buildConfig(), logger);

    const token = await provider.getAccessToken();

    expect(token).toBe('token-1');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://idp.example.com/oauth2/token');
    expect(init?.method).toBe('POST');
    expect(String(init?.body)).toContain('grant_type=client_credentials');
  });

  it('caches the token across calls until near expiry', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ access_token: 'token-1', expires_in: 3600 }),
    );
    const provider = new ServiceAccountTokenProvider(buildConfig(), logger);

    await provider.getAccessToken();
    const token = await provider.getAccessToken();

    expect(token).toBe('token-1');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('refetches once the cached token is within the expiry safety margin', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({ access_token: 'token-1', expires_in: 30 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ access_token: 'token-2', expires_in: 3600 }),
      );
    const provider = new ServiceAccountTokenProvider(buildConfig(), logger);

    const first = await provider.getAccessToken();
    const second = await provider.getAccessToken();

    expect(first).toBe('token-1');
    expect(second).toBe('token-2');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws when the token endpoint responds with an error', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, false, 401));
    const provider = new ServiceAccountTokenProvider(buildConfig(), logger);

    await expect(provider.getAccessToken()).rejects.toThrow();
  });
});
