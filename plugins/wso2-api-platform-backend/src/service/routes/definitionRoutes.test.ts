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
import { AuthenticationError } from '@backstage/errors';
import { JsonObject } from '@backstage/types';
import {
  mockErrorHandler,
  mockServices,
  TestDatabases,
} from '@backstage/backend-test-utils';
import { createRouter } from '../router';

jest.mock('undici', () => ({
  request: jest.fn(),
}));

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

const GATEWAY_ENTITY = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'API',
  metadata: {
    name: 'orders-api',
    namespace: 'wso2-gateways',
    annotations: {
      'wso2.com/api-discovery-type': 'self-hosted-gateway',
      'wso2-gateway.com/api-id': 'gw-api-1',
      'wso2-gateway.com/api-endpoints': JSON.stringify([
        { environmentName: 'dev' },
      ]),
    },
  },
  spec: {},
};

const OPENCHOREO_ENTITY = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'API',
  metadata: {
    name: 'payment-api',
    namespace: 'wso2-gateways',
    annotations: {
      'wso2.com/api-discovery-type': 'openchoreo-gateway',
      'wso2-gateway.com/api-id': 'payment-api-service-v1.0',
      'wso2-gateway.com/api-endpoints': JSON.stringify([
        { environmentName: 'oc-dev' },
      ]),
    },
  },
  spec: {},
};

const OPENCHOREO_GATEWAY_CONFIG = {
  apiManager: { enabled: false },
  platformGateway: { enabled: true },
  selfHostedGateways: [
    {
      name: 'oc-dev',
      urls: [],
      discoveryUrl: 'http://localhost:9095/rest-apis',
      discoveryAuth: undefined,
      environmentType: 'PRODUCTION',
      integration: 'openchoreo',
    },
  ],
};

const DISCOVERED_RESTAPI_CR = {
  kind: 'RestApi',
  metadata: { name: 'payment-api-service-v1.0' },
  status: { id: 'payment-api-service-v1.0', state: 'Active' },
  spec: {
    displayName: 'Payment API',
    version: '1.0.0',
    context: '/payments',
  },
};

const MATCHING_OPENCHOREO_DEFINITION =
  'openapi: 3.0.0\ninfo:\n  title: Payment API\n  version: 1.0.0\npaths: {}\n';

const DISCOVERED_RESTAPI_CR_WITH_OPERATIONS = {
  ...DISCOVERED_RESTAPI_CR,
  spec: {
    ...DISCOVERED_RESTAPI_CR.spec,
    operations: [
      { method: 'GET', path: '/books' },
      { method: 'POST', path: '/books' },
      { method: 'GET', path: '/books/{id}' },
    ],
  },
};

const MATCHING_OPERATIONS_DEFINITION = `openapi: 3.0.0
info:
  title: Payment API
  version: 1.0.0
paths:
  /books:
    get: {}
    post: {}
  /books/{bookId}:
    get: {}
`;

const MISSING_OPERATION_DEFINITION = `openapi: 3.0.0
info:
  title: Payment API
  version: 1.0.0
paths:
  /books:
    get: {}
    post: {}
`;

const EXTRA_OPERATION_DEFINITION = `openapi: 3.0.0
info:
  title: Payment API
  version: 1.0.0
paths:
  /books:
    get: {}
    post: {}
  /books/{id}:
    get: {}
    delete: {}
`;

const APIM_ENTITY = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'API',
  metadata: {
    name: 'orders-api',
    namespace: 'default',
    annotations: { 'wso2.com/api-id': 'apim-api-1' },
  },
  spec: {},
};

const NON_WSO2_ENTITY = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'API',
  metadata: { name: 'plain-api', namespace: 'default', annotations: {} },
  spec: {},
};

describe('definition routes', () => {
  const databases = TestDatabases.create({ ids: ['SQLITE_3'] });
  let app: express.Express;
  let mockHttpAuth: { credentials: jest.Mock };
  let mockCatalog: { getEntityByRef: jest.Mock; refreshEntity: jest.Mock };

  async function buildApp(storageOverrides: JsonObject = {}) {
    Object.values(mockClientInstance).forEach(mock => mock.mockReset());
    mockClientInstance.getConfig.mockReturnValue({
      apiManager: { enabled: false },
      platformGateway: { enabled: false },
      selfHostedGateways: [],
    });

    const mockConfig = new ConfigReader({
      backend: { baseUrl: 'http://localhost:7007' },
      wso2ApiPlatform: {
        enabled: false,
        storage: storageOverrides,
      },
    });

    mockHttpAuth = {
      credentials: jest.fn().mockResolvedValue({
        principal: { type: 'user', userEntityRef: 'user:default/alice' },
      }),
    };
    mockCatalog = {
      getEntityByRef: jest.fn().mockImplementation((ref: string) => {
        if (ref === 'api:wso2-gateways/orders-api') return GATEWAY_ENTITY;
        if (ref === 'api:wso2-gateways/payment-api') return OPENCHOREO_ENTITY;
        if (ref === 'api:default/orders-api') return APIM_ENTITY;
        if (ref === 'api:default/plain-api') return NON_WSO2_ENTITY;
        return undefined;
      }),
      refreshEntity: jest.fn().mockResolvedValue(undefined),
    };

    const database = {
      getClient: async () => databases.init('SQLITE_3'),
    };

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

  const GATEWAY_PATH = '/entities/api/wso2-gateways/orders-api/definition';
  const OPENCHOREO_PATH = '/entities/api/wso2-gateways/payment-api/definition';
  const APIM_PATH = '/entities/api/default/orders-api/definition';

  beforeEach(async () => {
    await buildApp();
  });

  it('returns a null definition with write capabilities before one is added', async () => {
    const res = await request(app).get(GATEWAY_PATH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      definition: null,
      capabilities: { read: true, write: true },
    });
  });

  it('adds a YAML definition via PUT, then reflects it on GET', async () => {
    const putRes = await request(app)
      .put(GATEWAY_PATH)
      .send({ fileName: 'openapi.yaml', content: 'openapi: 3.0.0' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.definition).toMatchObject({
      format: 'YAML',
      fileName: 'openapi.yaml',
    });
    expect(mockCatalog.refreshEntity).toHaveBeenCalled();

    const getRes = await request(app).get(GATEWAY_PATH);
    expect(getRes.body.definition.content).toBe('openapi: 3.0.0');
  });

  it('replaces the definition (not duplicates it) on a second PUT', async () => {
    await request(app)
      .put(GATEWAY_PATH)
      .send({ fileName: 'openapi.yaml', content: 'openapi: 3.0.0' });

    const secondPut = await request(app)
      .put(GATEWAY_PATH)
      .send({ fileName: 'openapi.json', content: '{"openapi":"3.0.0"}' });
    expect(secondPut.status).toBe(200);
    expect(secondPut.body.definition).toMatchObject({
      format: 'JSON',
      fileName: 'openapi.json',
    });

    const getRes = await request(app).get(GATEWAY_PATH);
    expect(getRes.body.definition.content).toBe('{"openapi":"3.0.0"}');
  });

  it('returns 400 for a disallowed file extension', async () => {
    const res = await request(app)
      .put(GATEWAY_PATH)
      .send({ fileName: 'openapi.pdf', content: 'not a spec' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty content', async () => {
    const res = await request(app)
      .put(GATEWAY_PATH)
      .send({ fileName: 'openapi.yaml', content: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when the definition exceeds the configured size limit', async () => {
    await buildApp({ enabled: true, definitions: { maxSizeKb: 0.001 } });
    const res = await request(app)
      .put(GATEWAY_PATH)
      .send({ fileName: 'openapi.yaml', content: 'openapi: 3.0.0'.repeat(50) });
    expect(res.status).toBe(400);
  });

  it('returns 501 for PUT when storage.enabled is false', async () => {
    await buildApp({ enabled: false });
    const res = await request(app)
      .put(GATEWAY_PATH)
      .send({ fileName: 'openapi.yaml', content: 'openapi: 3.0.0' });
    expect(res.status).toBe(501);
  });

  it('returns 404 for an on-prem APIM entity (definitions come from the catalog, not this route)', async () => {
    const getRes = await request(app).get(APIM_PATH);
    expect(getRes.status).toBe(404);

    const putRes = await request(app)
      .put(APIM_PATH)
      .send({ fileName: 'openapi.yaml', content: 'openapi: 3.0.0' });
    expect(putRes.status).toBe(404);
  });

  it('returns 404 for an entity with no WSO2 annotations', async () => {
    const res = await request(app).get(
      '/entities/api/default/plain-api/definition',
    );
    expect(res.status).toBe(404);
  });

  it('returns 401 when the request is unauthenticated', async () => {
    mockHttpAuth.credentials.mockRejectedValueOnce(
      new AuthenticationError('no credentials'),
    );
    const res = await request(app).get(GATEWAY_PATH);
    expect(res.status).toBe(401);
  });

  describe('OpenChoreo definition verification', () => {
    it('allows an upload whose info.title/version match the discovered API', async () => {
      mockClientInstance.getConfig.mockReturnValue(OPENCHOREO_GATEWAY_CONFIG);
      mockClientInstance.getGatewayApiDetail.mockResolvedValue(
        DISCOVERED_RESTAPI_CR,
      );

      const res = await request(app).put(OPENCHOREO_PATH).send({
        fileName: 'openapi.yaml',
        content: MATCHING_OPENCHOREO_DEFINITION,
      });

      expect(res.status).toBe(200);
      expect(mockClientInstance.getGatewayApiDetail).toHaveBeenCalledWith(
        'http://localhost:9095/rest-apis',
        'payment-api-service-v1.0',
        undefined,
      );
    });

    it('returns 409 when the uploaded definition does not match the discovered API', async () => {
      mockClientInstance.getConfig.mockReturnValue(OPENCHOREO_GATEWAY_CONFIG);
      mockClientInstance.getGatewayApiDetail.mockResolvedValue(
        DISCOVERED_RESTAPI_CR,
      );

      const res = await request(app).put(OPENCHOREO_PATH).send({
        fileName: 'openapi.yaml',
        content:
          'openapi: 3.0.0\ninfo:\n  title: Unrelated Service\n  version: 9.9.9\npaths: {}\n',
      });

      expect(res.status).toBe(409);
    });

    it('returns 409 when the OpenChoreo gateway cannot be reached for verification', async () => {
      mockClientInstance.getConfig.mockReturnValue(OPENCHOREO_GATEWAY_CONFIG);
      mockClientInstance.getGatewayApiDetail.mockRejectedValue(
        new Error('ECONNREFUSED'),
      );

      const res = await request(app).put(OPENCHOREO_PATH).send({
        fileName: 'openapi.yaml',
        content: MATCHING_OPENCHOREO_DEFINITION,
      });

      expect(res.status).toBe(409);
    });

    it('skips verification (fails open) when the gateway has no discovery URL configured', async () => {
      mockClientInstance.getConfig.mockReturnValue({
        ...OPENCHOREO_GATEWAY_CONFIG,
        selfHostedGateways: [
          {
            ...OPENCHOREO_GATEWAY_CONFIG.selfHostedGateways[0],
            discoveryUrl: undefined,
          },
        ],
      });

      const res = await request(app).put(OPENCHOREO_PATH).send({
        fileName: 'openapi.yaml',
        content: MATCHING_OPENCHOREO_DEFINITION,
      });

      expect(res.status).toBe(200);
      expect(mockClientInstance.getGatewayApiDetail).not.toHaveBeenCalled();
    });

    it('does not verify self-hosted (non-OpenChoreo) gateway uploads', async () => {
      const res = await request(app)
        .put(GATEWAY_PATH)
        .send({ fileName: 'openapi.yaml', content: 'openapi: 3.0.0' });

      expect(res.status).toBe(200);
      expect(mockClientInstance.getGatewayApiDetail).not.toHaveBeenCalled();
    });

    it('returns 409 when the uploaded definition operations do not match the discovered API', async () => {
      mockClientInstance.getConfig.mockReturnValue(OPENCHOREO_GATEWAY_CONFIG);
      mockClientInstance.getGatewayApiDetail.mockResolvedValue(
        DISCOVERED_RESTAPI_CR_WITH_OPERATIONS,
      );

      const res = await request(app).put(OPENCHOREO_PATH).send({
        fileName: 'openapi.yaml',
        content: MISSING_OPERATION_DEFINITION,
      });

      expect(res.status).toBe(409);
    });
  });

  describe('OpenChoreo definition update (map -> diff -> push to gateway)', () => {
    it('on a subsequent update, pushes the merged artifact to the gateway instead of rejecting a mismatch', async () => {
      mockClientInstance.getConfig.mockReturnValue(OPENCHOREO_GATEWAY_CONFIG);
      mockClientInstance.getGatewayApiDetail.mockResolvedValue(
        DISCOVERED_RESTAPI_CR_WITH_OPERATIONS,
      );
      mockClientInstance.updateGatewayRestApi.mockResolvedValue({ ok: true });

      const firstPut = await request(app).put(OPENCHOREO_PATH).send({
        fileName: 'openapi.yaml',
        content: MATCHING_OPERATIONS_DEFINITION,
      });
      expect(firstPut.status).toBe(200);
      expect(mockClientInstance.updateGatewayRestApi).not.toHaveBeenCalled();

      const secondPut = await request(app).put(OPENCHOREO_PATH).send({
        fileName: 'openapi.yaml',
        content: EXTRA_OPERATION_DEFINITION,
      });

      expect(secondPut.status).toBe(200);
      expect(mockClientInstance.updateGatewayRestApi).toHaveBeenCalledWith(
        'http://localhost:9095/rest-apis',
        'payment-api-service-v1.0',
        expect.objectContaining({
          metadata: { name: 'payment-api-service-v1.0' },
          spec: expect.objectContaining({
            context: '/payments',
            operations: expect.arrayContaining([
              { method: 'DELETE', path: '/books/{id}' },
            ]),
          }),
        }),
        undefined,
      );
    });

    it('returns 409 when the gateway rejects a subsequent update', async () => {
      mockClientInstance.getConfig.mockReturnValue(OPENCHOREO_GATEWAY_CONFIG);
      mockClientInstance.getGatewayApiDetail.mockResolvedValue(
        DISCOVERED_RESTAPI_CR_WITH_OPERATIONS,
      );

      await request(app).put(OPENCHOREO_PATH).send({
        fileName: 'openapi.yaml',
        content: MATCHING_OPERATIONS_DEFINITION,
      });

      mockClientInstance.updateGatewayRestApi.mockRejectedValue(
        new Error(
          "Gateway rejected the update for 'payment-api-service-v1.0' " +
            '(status 400): spec.version: must match pattern',
        ),
      );

      const res = await request(app).put(OPENCHOREO_PATH).send({
        fileName: 'openapi.yaml',
        content: EXTRA_OPERATION_DEFINITION,
      });

      expect(res.status).toBe(409);
    });
  });

  describe('definition diff preview', () => {
    const DIFF_PATH = '/entities/api/wso2-gateways/payment-api/definition/diff';

    it('returns the diff for a changed definition', async () => {
      mockClientInstance.getConfig.mockReturnValue(OPENCHOREO_GATEWAY_CONFIG);
      mockClientInstance.getGatewayApiDetail.mockResolvedValue(
        DISCOVERED_RESTAPI_CR_WITH_OPERATIONS,
      );

      const res = await request(app)
        .post(DIFF_PATH)
        .send({ content: EXTRA_OPERATION_DEFINITION });

      expect(res.status).toBe(200);
      expect(res.body.diff.hasChanges).toBe(true);
      expect(res.body.diff.addedOperations).toEqual(
        expect.arrayContaining([{ method: 'DELETE', path: '/books/{id}' }]),
      );
      expect(mockClientInstance.updateGatewayRestApi).not.toHaveBeenCalled();
    });

    it('reports no changes for an identical definition', async () => {
      mockClientInstance.getConfig.mockReturnValue(OPENCHOREO_GATEWAY_CONFIG);
      mockClientInstance.getGatewayApiDetail.mockResolvedValue(
        DISCOVERED_RESTAPI_CR_WITH_OPERATIONS,
      );

      const res = await request(app)
        .post(DIFF_PATH)
        .send({ content: MATCHING_OPERATIONS_DEFINITION });

      expect(res.status).toBe(200);
      expect(res.body.diff.hasChanges).toBe(false);
    });

    it('returns diff: null for a non-OpenChoreo (self-hosted) entity', async () => {
      const res = await request(app)
        .post('/entities/api/wso2-gateways/orders-api/definition/diff')
        .send({
          content:
            'openapi: 3.0.0\ninfo:\n  title: X\n  version: "1.0"\npaths: {}\n',
        });

      expect(res.status).toBe(200);
      expect(res.body.diff).toBeNull();
    });
  });
});
