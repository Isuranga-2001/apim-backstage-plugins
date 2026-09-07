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
        if (ref.includes('wso2-gateways')) return GATEWAY_ENTITY;
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
});
