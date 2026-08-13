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

import { readWso2ApiPlatformConfig, Wso2ApiPlatformClient } from './client';
import { ConfigReader } from '@backstage/config';
import { mockServices } from '@backstage/backend-test-utils';
import { fetch as undiciFetch } from 'undici';

jest.mock('undici', () => {
  const actual = jest.requireActual('undici');
  return {
    ...actual,
    fetch: jest.fn(),
    Agent: jest.fn().mockImplementation(() => ({
      close: jest.fn(),
    })),
  };
});

const mockFetch = jest.mocked(undiciFetch);

describe('client and Wso2ApiPlatformClient', () => {
  const logger = mockServices.logger.mock();

  beforeEach(() => {
    mockFetch.mockReset();
    jest.clearAllMocks();
  });

  describe('readWso2ApiPlatformConfig', () => {
    it('should successfully read complete configuration', () => {
      const config = new ConfigReader({
        wso2ApiPlatform: {
          enabled: true,
          baseUrl: 'https://apim.wso2.com',
          publisherBasePath: '/api/am/publisher/v3',
          developerBasePath: '/api/am/devportal/v3',
          serviceCatalogBasePath: '/api/am/service-catalog/v1',
          auth: {
            clientId: 'client-id-abc',
            clientSecret: 'client-secret-xyz',
            tokenUrl: 'https://apim.wso2.com/oauth2/token',
            username: 'admin',
            password: 'admin',
          },
          tls: {
            rejectUnauthorized: false,
          },
        },
        wso2ApiPlatformGateway: {
          enabled: true,
          gateways: [
            {
              name: 'Production Gateway',
              urls: ['https://gw1.wso2.com'],
              discoveryUrl: 'https://gw1.wso2.com/discovery',
              discoveryUsername: 'admin',
              discoveryPassword: 'password123',
              environmentType: 'PRODUCTION',
              description: 'My Gateway',
            },
          ],
        },
      });

      const result = readWso2ApiPlatformConfig(config);

      expect(result.baseUrl).toBe('https://apim.wso2.com');
      expect(result.publisherBasePath).toBe('/api/am/publisher/v3');
      expect(result.developerBasePath).toBe('/api/am/devportal/v3');
      expect(result.serviceCatalogBasePath).toBe('/api/am/service-catalog/v1');
      expect(result.auth.clientId).toBe('client-id-abc');
      expect(result.auth.clientSecret).toBe('client-secret-xyz');
      expect(result.auth.username).toBe('admin');
      expect(result.auth.password).toBe('admin');
      expect(result.tls.rejectUnauthorized).toBe(false);
      expect(result.apiManager.enabled).toBe(true);
      expect(result.platformGateway.enabled).toBe(true);
      expect(result.selfHostedGateways.length).toBe(1);
      expect(result.selfHostedGateways[0].name).toBe('Production Gateway');
      expect(result.selfHostedGateways[0].discoveryAuth).toBe(
        `Basic ${Buffer.from('admin:password123').toString('base64')}`,
      );
    });

    it('should read API key Basic Auth credentials from catalog provider config', () => {
      const config = new ConfigReader({
        wso2ApiPlatform: {
          enabled: true,
          baseUrl: 'https://apim.wso2.com',
          publisherBasePath: '/api/am/publisher/v3',
          developerBasePath: '/api/am/devportal/v3',
          auth: {
            clientId: 'client-id-abc',
            clientSecret: 'client-secret-xyz',
          },
        },
        catalog: {
          providers: {
            wso2ApiPlatform: {
              username: 'catalog-admin',
              password: 'catalog-password',
            },
          },
        },
      });

      const result = readWso2ApiPlatformConfig(config);

      expect(result.auth.username).toBe('catalog-admin');
      expect(result.auth.password).toBe('catalog-password');
    });

    it('should default both integrations to disabled', () => {
      const config = new ConfigReader({});
      const result = readWso2ApiPlatformConfig(config);
      expect(result.apiManager.enabled).toBe(false);
      expect(result.platformGateway.enabled).toBe(false);
      expect(result.selfHostedGateways).toEqual([]);
    });

    it('should successfully read config with defaults and selfHostedGateway credentials', () => {
      const config = new ConfigReader({
        wso2ApiPlatform: {
          enabled: true,
          baseUrl: 'https://apim.wso2.com',
          publisherBasePath: '/api/am/publisher/v3',
          developerBasePath: '/api/am/devportal/v3',
          auth: {
            clientId: 'client-id-abc',
            clientSecret: 'client-secret-xyz',
          },
        },
        wso2ApiPlatformGateway: {
          enabled: true,
          gateways: [
            {
              name: 'Production Gateway',
              urls: ['https://gw1.wso2.com'],
              discoveryUsername: 'admin',
              discoveryPassword: 'password123',
            },
          ],
        },
      });

      const result = readWso2ApiPlatformConfig(config);

      expect(result.tls.rejectUnauthorized).toBe(true);
      expect(result.selfHostedGateways.length).toBe(1);
      expect(result.selfHostedGateways[0].discoveryAuth).toBe(
        `Basic ${Buffer.from('admin:password123').toString('base64')}`,
      );
      expect(result.selfHostedGateways[0].environmentType).toBe('PRODUCTION');
    });
  });

  describe('Wso2ApiPlatformClient operations', () => {
    let client: Wso2ApiPlatformClient;
    const clientConfig = {
      // top-level `enabled` is read by the base Wso2Client from the raw config
      enabled: true,
      apiManager: {
        enabled: true,
      },
      platformGateway: {
        enabled: false,
      },
      baseUrl: 'https://apim.wso2.com',
      publisherBasePath: '/api/am/publisher/v3',
      developerBasePath: '/api/am/devportal/v3',
      serviceCatalogBasePath: '/api/am/service-catalog/v1',
      auth: {
        clientId: 'client-id-abc',
        clientSecret: 'client-secret-xyz',
        tokenUrl: 'https://apim.wso2.com/oauth2/token',
        username: 'admin',
        password: 'admin',
        requiredScopes: ['apim:api_view'],
      },
      tls: {
        rejectUnauthorized: false,
      },
      selfHostedGateways: [],
    };

    beforeEach(() => {
      client = new Wso2ApiPlatformClient({
        config: clientConfig,
        rawConfig: new ConfigReader({ wso2ApiPlatform: clientConfig }),
        logger,
      });
    });

    describe('OAuth flows', () => {
      it('should successfully fetch client credentials token, cache, and reuse it', async () => {
        // 1. Success token response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            access_token: 'wso2-bearer-token-123',
            expires_in: 3600,
          }),
        } as any);

        // 2. Success GET endpoint response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: jest
            .fn()
            .mockResolvedValueOnce(JSON.stringify({ status: 'active' })),
        } as any);

        const result1 = await client.getSettings();
        expect(result1).toEqual({ status: 'active' });

        // Verify token POST configurations
        const expectedBasicAuth = `Basic ${Buffer.from(
          'client-id-abc:client-secret-xyz',
        ).toString('base64')}`;
        expect(mockFetch).toHaveBeenNthCalledWith(
          1,
          'https://apim.wso2.com/oauth2/token',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: expectedBasicAuth,
            }),
          }),
        );

        // Second GET request should hit the token cache
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: jest
            .fn()
            .mockResolvedValueOnce(JSON.stringify({ status: 'active' })),
        } as any);

        await client.getSettings();
        // Total fetches should be 3 (1 token POST + 2 GETs)
        expect(mockFetch).toHaveBeenCalledTimes(3);
      });

      it('should throw error if token grant request returns non-ok status', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () => 'Bad Request',
        } as any);

        await expect(client.getSettings()).rejects.toThrow(
          'Request failed with 400 undefined',
        );
      });

      it('should throw error if token grant response has missing token', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({}),
        } as any);

        await expect(client.getSettings()).rejects.toThrow(
          'WSO2 token grant: no access_token in response',
        );
      });
    });

    describe('requestDevportal and token fallback', () => {
      it('should perform POST generate-key successfully with Basic Auth', async () => {
        const mockResult = { key: 'sandbox-key-val' };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResult)),
        } as any);

        const result = await client.generateApiKey('api-id', {
          keyName: 'Backstage',
          keyType: 'PRODUCTION',
          validityPeriod: 345600,
          additionalProperties: {
            permittedIP: '192.168.1.1',
            permittedReferer: '',
          },
        });
        expect(result).toEqual(mockResult);

        expect(mockFetch).toHaveBeenNthCalledWith(
          1,
          'https://apim.wso2.com/api/am/devportal/v3/apis/api-id/api-keys/generate',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: `Basic ${Buffer.from('admin:admin').toString(
                'base64',
              )}`,
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
              keyName: 'Backstage',
              keyType: 'PRODUCTION',
              validityPeriod: 345600,
              additionalProperties: {
                permittedIP: '192.168.1.1',
                permittedReferer: '',
              },
            }),
          }),
        );
      });

      it('should encode API ids before interpolating DevPortal paths', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValueOnce(JSON.stringify({ key: 'k' })),
        } as any);

        await client.generateApiKey('api/id with spaces');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://apim.wso2.com/api/am/devportal/v3/apis/api%2Fid%20with%20spaces/api-keys/generate',
          expect.anything(),
        );
      });

      it('should require Basic Auth credentials for generate-key', async () => {
        const basicAuthlessConfig = {
          ...clientConfig,
          auth: { ...clientConfig.auth, username: '', password: '' },
        };
        const basicAuthlessClient = new Wso2ApiPlatformClient({
          config: basicAuthlessConfig,
          rawConfig: new ConfigReader({ wso2ApiPlatform: basicAuthlessConfig }),
          logger,
        });

        await expect(
          basicAuthlessClient.generateApiKey('api-id'),
        ).rejects.toThrow(
          'WSO2 APIM username and password are required to generate API keys with Basic Auth',
        );
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('should throw an error with detailed WSO2 message on failed response', async () => {
        // Token mock
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ access_token: 'token' }),
        } as any);

        // Failed GET mock with JSON error message
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: jest.fn().mockResolvedValueOnce(
            JSON.stringify({
              message: 'Resource Not Found',
              description: 'API could not be resolved',
            }),
          ),
        } as any);

        await expect(client.getDocument('api-id', 'doc-id')).rejects.toThrow(
          'WSO2 Publisher request failed (context: SERVICE-ACCOUNT), status 404: Resource Not Found: API could not be resolved',
        );
      });
    });

    describe('getGatewayApis Ingestion', () => {
      it('should successfully parse discovered APIs when response is an array', async () => {
        const mockApis = [{ id: 'api-1', name: 'Service A' }];
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockApis),
        } as any);

        const result = await client.getGatewayApis(
          'https://gw.com/discovery',
          'Basic base64',
        );
        expect(result).toEqual(mockApis);
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining(
            '[WSO2-GATEWAY-DISCOVERY] Attempting to fetch APIs from gateway',
          ),
        );
        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            '[WSO2-GATEWAY-DISCOVERY] Found 1 APIs from gateway',
          ),
        );
        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining('{"id":"api-1","name":"Service A"}'),
        );

        expect(mockFetch).toHaveBeenCalledWith(
          'https://gw.com/discovery',
          expect.objectContaining({
            headers: {
              Accept: 'application/json',
              Authorization: 'Basic base64',
            },
          }),
        );
      });

      it('should parse discovered APIs when response contains an nested items list', async () => {
        const mockApis = [{ id: 'api-2', name: 'Service B' }];
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ items: mockApis }),
        } as any);

        const result = await client.getGatewayApis('https://gw.com/discovery');
        expect(result).toEqual(mockApis);
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining(
            '[WSO2-GATEWAY-DISCOVERY] Attempting to fetch APIs from gateway',
          ),
        );
        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            '[WSO2-GATEWAY-DISCOVERY] Found 1 APIs from gateway',
          ),
        );
      });

      it('should throw error on gateway connection failure', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Connection timeout'));

        await expect(
          client.getGatewayApis('https://gw.com/discovery'),
        ).rejects.toThrow('Connection timeout');
      });
    });

    describe('Document download operations', () => {
      it('should perform GET document content stream successfully', async () => {
        // Token mock
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ access_token: 'token' }),
        } as any);

        // GET mock
        const mockStreamResponse = { ok: true, status: 200 } as any;
        mockFetch.mockResolvedValueOnce(mockStreamResponse);

        const result = await client.getDocumentContentStream(
          'api-id',
          'doc-id',
        );
        expect(result.status).toBe(200);
      });
    });

    describe('Service Catalog operations', () => {
      it('should getServices successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ access_token: 'token' }),
        } as any);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValueOnce(JSON.stringify({ list: [] })),
        } as any);

        const res = await client.getServices({ offset: 0, limit: 10 });
        expect(res).toEqual({ list: [] });
      });

      it('should getServiceUsage successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ access_token: 'token' }),
        } as any);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValueOnce(JSON.stringify({ usage: [] })),
        } as any);

        const res = await client.getServiceUsage('svc-1');
        expect(res).toEqual({ usage: [] });
      });

      it('should encode service ids before interpolating service catalog paths', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ access_token: 'token' }),
        } as any);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValueOnce(JSON.stringify({ usage: [] })),
        } as any);

        await client.getServiceUsage('svc/with space');

        expect(mockFetch).toHaveBeenNthCalledWith(
          2,
          'https://apim.wso2.com/api/am/service-catalog/v1/services/svc%2Fwith%20space/usage',
          expect.anything(),
        );
      });

      it('should getServiceDefinition successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ access_token: 'token' }),
        } as any);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValueOnce('swagger-def-here'),
        } as any);

        const res = await client.getServiceDefinition('svc-1');
        expect(res).toBe('swagger-def-here');
      });

      it('should throw error on failed service definition fetch', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ access_token: 'token' }),
        } as any);
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
        } as any);

        await expect(client.getServiceDefinition('svc-1')).rejects.toThrow(
          'Failed to fetch service definition for svc-1',
        );
      });
    });

    describe('WSDL operations', () => {
      it('should getApiWsdlStream successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ access_token: 'token' }),
        } as any);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
        } as any);

        const result = await client.getApiWsdlStream('api-1');
        expect(result.status).toBe(200);
      });
    });

    describe('extractWso2ErrorMessage handling', () => {
      it('should handle JSON response with only message or description', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ access_token: 'token' }),
        } as any);
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: jest
            .fn()
            .mockResolvedValueOnce(
              JSON.stringify({ description: 'Only description exists' }),
            ),
        } as any);

        await expect(client.getSettings()).rejects.toThrow(
          'Only description exists',
        );
      });

      it('should handle non-JSON error response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ access_token: 'token' }),
        } as any);
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: jest.fn().mockResolvedValueOnce('Plain text error message'),
        } as any);

        await expect(client.getSettings()).rejects.toThrow(
          'Plain text error message',
        );
      });

      it('should handle failure to read response text', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ access_token: 'token' }),
        } as any);
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: jest.fn().mockRejectedValueOnce(new Error('failed to read')),
          statusText: 'Internal Error',
        } as any);

        await expect(client.getSettings()).rejects.toThrow('Internal Error');
      });
    });

    describe('Additional branch coverage tests', () => {
      it('should parse getGatewayApis list when response has apis field', async () => {
        const mockApis = [{ id: 'api-3', name: 'Service C' }];
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ apis: mockApis }),
        } as any);

        const result = await client.getGatewayApis('https://gw.com/discovery');
        expect(result).toEqual(mockApis);
      });

      it('should parse getGatewayApis list when response has list field', async () => {
        const mockApis = [{ id: 'api-4', name: 'Service D' }];
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ list: mockApis }),
        } as any);

        const result = await client.getGatewayApis('https://gw.com/discovery');
        expect(result).toEqual(mockApis);
      });

      it('should parse getGatewayApis count when response has count field', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ items: [], count: 0 }),
        } as any);

        const result = await client.getGatewayApis('https://gw.com/discovery');
        expect(result).toEqual([]);
      });

      it('should parse getGatewayApis when response is a single object', async () => {
        const singleApi = { id: 'api-5', name: 'Service E' };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ items: singleApi }),
        } as any);

        const result = await client.getGatewayApis('https://gw.com/discovery');
        expect(result).toEqual([{ items: singleApi }]);
      });

      it('should throw error when getGatewayApis response is not ok', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: jest.fn().mockResolvedValueOnce('Gateway Error'),
        } as any);

        await expect(
          client.getGatewayApis('https://gw.com/discovery'),
        ).rejects.toThrow(
          'Failed to fetch APIs from gateway https://gw.com/discovery, status 500',
        );
      });

      it('should requestDevportal fail on 401 without user token', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: jest.fn().mockResolvedValueOnce('Unauthorized'),
        } as any);

        await expect(client.generateApiKey('api-id')).rejects.toThrow(
          'WSO2 DevPortal request failed (context: EXPLICIT-AUTHORIZATION), status 401',
        );
      });

      it('should requestServiceCatalog throw on 401 without user token', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ access_token: 'token' }),
        } as any);
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: jest.fn().mockResolvedValueOnce('Unauthorized'),
          statusText: 'Unauthorized',
        } as any);

        await expect(client.getServices()).rejects.toThrow(
          'WSO2 Service Catalog request failed, status 401',
        );
      });

      it('should requestServiceCatalog return raw text if JSON parse fails', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ access_token: 'token' }),
        } as any);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValueOnce('Plain response text'),
        } as any);

        const res = await client.getServices();
        expect(res).toBe('Plain response text');
      });

      it('should requestDevportal return raw text if JSON parse fails', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValueOnce('Plain response text'),
        } as any);

        const res = await client.generateApiKey('api-id');
        expect(res).toBe('Plain response text');
      });

      it('should requestPublisher return raw text if JSON parse fails', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ access_token: 'token' }),
        } as any);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValueOnce('Plain response text'),
        } as any);

        const res = await client.getSettings();
        expect(res).toBe('Plain response text');
      });
    });
  });
});
