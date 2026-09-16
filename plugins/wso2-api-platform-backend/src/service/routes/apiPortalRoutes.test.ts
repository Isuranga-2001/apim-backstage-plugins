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

import express from 'express';
import request from 'supertest';
import { ConfigReader } from '@backstage/config';
import { JsonObject } from '@backstage/types';
import {
  mockErrorHandler,
  mockServices,
  TestDatabases,
} from '@backstage/backend-test-utils';
import { fetch as undiciFetch } from 'undici';
import { createRouter } from '../router';

jest.mock('undici', () => {
  const actual = jest.requireActual('undici');
  return {
    ...actual,
    fetch: jest.fn(),
    Agent: jest.fn().mockImplementation(() => ({ close: jest.fn() })),
  };
});

const mockFetch = jest.mocked(undiciFetch);

const mockClientInstance = {
  generateApiKey: jest.fn(),
  getRevisions: jest.fn(),
  getGateways: jest.fn(),
  getGatewayApiDetail: jest.fn(),
  updateGatewayRestApi: jest.fn(),
  getSettings: jest.fn(),
  getConfig: jest.fn(),
  getDocuments: jest.fn(),
  getDocument: jest.fn(),
  getDocumentContentStream: jest.fn(),
  getApiWsdlStream: jest.fn(),
  getServices: jest.fn(),
  getServiceUsage: jest.fn(),
  getServiceDefinition: jest.fn(),
};
jest.mock('../client', () => {
  const actual = jest.requireActual('../client');
  return {
    ...actual,
    Wso2ApiPlatformClient: jest
      .fn()
      .mockImplementation(() => mockClientInstance),
  };
});

const PAYMENT_API_ENTITY = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'API',
  metadata: {
    name: 'payment-api',
    namespace: 'wso2-gateways',
    annotations: {
      'wso2.com/api-discovery-type': 'api-platform-gateway',
      'wso2-gateway.com/api-id': 'payment-api-service-v1.0',
      'wso2-gateway.com/api-endpoints': JSON.stringify([
        { environmentName: 'oc-dev' },
      ]),
    },
  },
  spec: { owner: '' },
};

const SELF_HOSTED_ENTITY = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'API',
  metadata: {
    name: 'orders-api',
    namespace: 'wso2-gateways',
    annotations: {
      'wso2.com/api-discovery-type': 'api-platform-gateway',
      'wso2-gateway.com/api-id': 'gw-api-1',
      'wso2-gateway.com/api-endpoints': JSON.stringify([
        { environmentName: 'dev' },
      ]),
    },
  },
  spec: {},
};

const PAYMENT_API_GATEWAY_CONFIG = {
  apiManager: { enabled: false },
  platformGateway: { enabled: true, enableWriteOperations: false },
  platformGateways: [
    {
      name: 'oc-dev',
      urls: [],
      managementApiUrl: 'http://localhost:9095/rest-apis',
      managementApiAuth: undefined,
      environmentType: 'PRODUCTION',
    },
  ],
};

const NO_GATEWAY_CONFIG = {
  apiManager: { enabled: false },
  platformGateway: { enabled: false, enableWriteOperations: false },
  platformGateways: [],
};

const DISCOVERED_RESTAPI_CR = {
  kind: 'RestApi',
  metadata: { name: 'payment-api-service-v1.0' },
  status: { id: 'payment-api-service-v1.0', state: 'Active' },
  spec: { displayName: 'Payment API', version: '1.0.0', context: '/payments' },
};

const MATCHING_OPENCHOREO_DEFINITION =
  'openapi: 3.0.0\ninfo:\n  title: Payment API\n  version: 1.0.0\npaths: {}\n';

const PORTAL_BASE_URL = 'https://portal.example.com';
const PORTAL_ROOT_URL = `${PORTAL_BASE_URL}/api-portal/api/v0.9`;
const CREATE_API_URL = `${PORTAL_ROOT_URL}/apis`;
const GET_API_URL = `${CREATE_API_URL}/payment-api-service-v1.0`;
const PORTAL_TOKEN_HEADER = 'x-api-portal-access-token';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'status text',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as any;
}

describe('api-portal routes', () => {
  const databases = TestDatabases.create({ ids: ['SQLITE_3'] });
  let app: express.Express;
  let mockCatalog: { getEntityByRef: jest.Mock; refreshEntity: jest.Mock };

  async function buildApp(apiPortalOverrides: JsonObject = {}) {
    Object.values(mockClientInstance).forEach(mock => mock.mockReset());
    mockFetch.mockReset();
    mockClientInstance.getConfig.mockReturnValue(NO_GATEWAY_CONFIG);

    const mockConfig = new ConfigReader({
      backend: { baseUrl: 'http://localhost:7007' },
      wso2ApiPlatform: {
        enabled: false,
        apiPortal: {
          enabled: true,
          baseUrl: PORTAL_BASE_URL,
          defaults: { labels: ['default'] },
          ...apiPortalOverrides,
        },
      },
    });

    const mockHttpAuth = {
      credentials: jest.fn().mockResolvedValue({
        principal: { type: 'user', userEntityRef: 'user:default/alice' },
      }),
    };
    mockCatalog = {
      getEntityByRef: jest.fn().mockImplementation((ref: string) => {
        if (ref === 'api:wso2-gateways/payment-api') return PAYMENT_API_ENTITY;
        if (ref === 'api:wso2-gateways/orders-api') return SELF_HOSTED_ENTITY;
        return undefined;
      }),
      refreshEntity: jest.fn().mockResolvedValue(undefined),
    };

    const database = { getClient: async () => databases.init('SQLITE_3') };

    const router = await createRouter({
      catalog: mockCatalog as any,
      database: database as any,
      logger: mockServices.logger.mock(),
      httpAuth: mockHttpAuth as any,
      config: mockConfig,
    });

    app = express();
    app.use(router);
    app.use(mockErrorHandler());
  }

  const PAYMENT_API_PATH = '/entities/api/wso2-gateways/payment-api/api-portal';
  const SELF_HOSTED_PATH = '/entities/api/wso2-gateways/orders-api/api-portal';

  describe('GET .../api-portal — capability reasons', () => {
    it('reaches the same next-stage check for a self-hosted-origin gateway API as for an OpenChoreo-origin one — no dedicated OpenChoreo-only gate any more', async () => {
      await buildApp();
      mockClientInstance.getConfig.mockReturnValue({
        ...PAYMENT_API_GATEWAY_CONFIG,
        platformGateways: [
          { ...PAYMENT_API_GATEWAY_CONFIG.platformGateways[0], name: 'dev' },
        ],
      });
      const res = await request(app).get(SELF_HOSTED_PATH);
      expect(res.status).toBe(200);
      expect(res.body.capabilities).toEqual({
        publish: false,
        reason: 'Attach an API definition before publishing to the API Portal',
      });
    });

    it('reports publish:false when the API Portal integration is disabled', async () => {
      await buildApp({ enabled: false });
      const res = await request(app).get(PAYMENT_API_PATH);
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
      expect(res.body.capabilities).toEqual({
        publish: false,
        reason: 'The API Portal integration is not enabled',
      });
    });

    it('reports publish:false when no API Platform gateway discovery URL is configured', async () => {
      await buildApp();
      const res = await request(app).get(PAYMENT_API_PATH);
      expect(res.status).toBe(200);
      expect(res.body.capabilities.publish).toBe(false);
      expect(res.body.capabilities.reason).toMatch(
        /No API Platform gateway discovery URL is configured/,
      );
    });

    it('reports publish:false when no definition has been attached yet', async () => {
      await buildApp();
      mockClientInstance.getConfig.mockReturnValue(PAYMENT_API_GATEWAY_CONFIG);
      const res = await request(app).get(PAYMENT_API_PATH);
      expect(res.status).toBe(200);
      expect(res.body.capabilities).toEqual({
        publish: false,
        reason: 'Attach an API definition before publishing to the API Portal',
      });
    });

    it('reports publish:true once a definition is attached and the gateway is configured', async () => {
      await buildApp();
      mockClientInstance.getConfig.mockReturnValue(PAYMENT_API_GATEWAY_CONFIG);
      mockClientInstance.getGatewayApiDetail.mockResolvedValue(
        DISCOVERED_RESTAPI_CR,
      );
      await request(app)
        .put('/entities/api/wso2-gateways/payment-api/definition')
        .send({
          fileName: 'openapi.yaml',
          content: MATCHING_OPENCHOREO_DEFINITION,
        });

      const res = await request(app).get(PAYMENT_API_PATH);
      expect(res.status).toBe(200);
      expect(res.body.capabilities).toEqual({ publish: true });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('POST .../api-portal/publish — forwarded Platform API token', () => {
    async function seedDefinition() {
      mockClientInstance.getConfig.mockReturnValue(PAYMENT_API_GATEWAY_CONFIG);
      mockClientInstance.getGatewayApiDetail.mockResolvedValue(
        DISCOVERED_RESTAPI_CR,
      );
      await request(app)
        .put('/entities/api/wso2-gateways/payment-api/definition')
        .send({
          fileName: 'openapi.yaml',
          content: MATCHING_OPENCHOREO_DEFINITION,
        });
    }

    function mockPortalReachableAndPublishable() {
      mockFetch.mockImplementation(async (url: any) => {
        if (url === PORTAL_ROOT_URL) {
          return jsonResponse(200, {});
        }
        if (url === GET_API_URL) {
          return jsonResponse(404, {});
        }
        if (url === CREATE_API_URL) {
          return jsonResponse(201, { id: 'payment-api-service-v1.0' });
        }
        throw new Error(`Unexpected fetch to ${url}`);
      });
    }

    it('forwards the frontend-supplied token as the portal Bearer token', async () => {
      await buildApp();
      await seedDefinition();
      mockPortalReachableAndPublishable();

      const res = await request(app)
        .post(`${PAYMENT_API_PATH}/publish`)
        .set(PORTAL_TOKEN_HEADER, 'user-supplied-token')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.operation).toBe('created');
      expect(res.body.portalApiId).toBe('payment-api-service-v1.0');

      const createCall = mockFetch.mock.calls.find(
        ([url]) => url === CREATE_API_URL,
      );
      const createHeaders = (createCall?.[1]?.headers ?? {}) as Record<
        string,
        string
      >;
      expect(createHeaders.Authorization).toBe('Bearer user-supplied-token');
    });

    it('rejects with 401 when the portal-token header is missing', async () => {
      await buildApp();
      await seedDefinition();
      mockPortalReachableAndPublishable();

      const res = await request(app)
        .post(`${PAYMENT_API_PATH}/publish`)
        .send({});

      expect(res.status).toBe(401);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rejects with 503 when the API Portal is not reachable', async () => {
      await buildApp();
      await seedDefinition();
      mockFetch.mockImplementation(async (url: any) => {
        if (url === PORTAL_ROOT_URL) {
          throw new Error('ECONNREFUSED');
        }
        throw new Error(`Unexpected fetch to ${url}`);
      });

      const res = await request(app)
        .post(`${PAYMENT_API_PATH}/publish`)
        .set(PORTAL_TOKEN_HEADER, 'user-supplied-token')
        .send({});

      expect(res.status).toBe(503);
      expect(mockFetch.mock.calls.some(([url]) => url === CREATE_API_URL)).toBe(
        false,
      );
    });
  });

  describe('POST .../api-portal/preview — makes no portal call', () => {
    it('returns the metadata payload and document plan without calling the API Portal', async () => {
      await buildApp();
      mockClientInstance.getConfig.mockReturnValue(PAYMENT_API_GATEWAY_CONFIG);
      mockClientInstance.getGatewayApiDetail.mockResolvedValue(
        DISCOVERED_RESTAPI_CR,
      );
      await request(app)
        .put('/entities/api/wso2-gateways/payment-api/definition')
        .send({
          fileName: 'openapi.yaml',
          content: MATCHING_OPENCHOREO_DEFINITION,
        });

      const res = await request(app)
        .post(`${PAYMENT_API_PATH}/preview`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.metadata).toMatchObject({
        id: 'payment-api-service-v1.0',
        name: 'Payment API',
        version: '1.0.0',
        type: 'REST',
        referenceId: 'payment-api-service-v1.0',
      });
      expect(res.body.documents).toEqual({ toPublish: [], skipped: [] });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rejects a preview for a self-hosted-origin gateway API with no gateway configured for its environment', async () => {
      await buildApp();
      const res = await request(app)
        .post(`${SELF_HOSTED_PATH}/preview`)
        .send({});
      expect(res.status).toBe(409);
    });
  });
});
