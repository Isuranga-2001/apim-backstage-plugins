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

describe('document routes', () => {
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
    // In production, coreServices.httpRouter's default implementation wraps
    // every plugin router with this same status-code mapping at the root
    // app level — added explicitly here since this test mounts the router
    // in isolation.
    app.use(mockErrorHandler());
  }

  const GATEWAY_PATH = '/entities/api/wso2-gateways/orders-api/documents';
  const APIM_PATH = '/entities/api/default/orders-api/documents';

  beforeEach(async () => {
    await buildApp();
  });

  it('lists documents with write capabilities for a gateway-discovered API', async () => {
    const res = await request(app).get(GATEWAY_PATH);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      count: 0,
      list: [],
      capabilities: {
        read: true,
        create: true,
        updateMetadata: true,
        updateContent: false,
        delete: true,
      },
    });
  });

  it('creates a MARKDOWN document via JSON, lists it, gets it, edits it, and deletes it', async () => {
    const createRes = await request(app).post(GATEWAY_PATH).send({
      name: 'Getting Started',
      type: 'HOWTO',
      sourceType: 'MARKDOWN',
      inlineContent: '# Hello',
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({ name: 'Getting Started' });
    const documentId = createRes.body.documentId;
    expect(mockCatalog.refreshEntity).toHaveBeenCalled();

    const listRes = await request(app).get(GATEWAY_PATH);
    expect(listRes.body.count).toBe(1);

    const getRes = await request(app).get(`${GATEWAY_PATH}/${documentId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.name).toBe('Getting Started');

    const contentRes = await request(app).get(
      `${GATEWAY_PATH}/${documentId}/content`,
    );
    expect(contentRes.status).toBe(200);
    expect(contentRes.text).toBe('# Hello');

    const putRes = await request(app)
      .put(`${GATEWAY_PATH}/${documentId}`)
      .send({ summary: 'Updated' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.summary).toBe('Updated');

    const deleteRes = await request(app).delete(
      `${GATEWAY_PATH}/${documentId}`,
    );
    expect(deleteRes.status).toBe(204);

    const afterDelete = await request(app).get(GATEWAY_PATH);
    expect(afterDelete.body.count).toBe(0);
  });

  it('creates a FILE document via multipart and streams it back', async () => {
    const createRes = await request(app)
      .post(GATEWAY_PATH)
      .field(
        'metadata',
        JSON.stringify({ name: 'Spec', type: 'SAMPLES', sourceType: 'FILE' }),
      )
      .attach('file', Buffer.from('binary content'), 'spec.txt');

    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      name: 'Spec',
      fileName: 'spec.txt',
    });

    const contentRes = await request(app).get(
      `${GATEWAY_PATH}/${createRes.body.documentId}/content`,
    );
    expect(contentRes.status).toBe(200);
    expect(contentRes.text).toBe('binary content');
    expect(contentRes.headers['content-disposition']).toContain('spec.txt');
  });

  it('redirects with 303 for URL documents', async () => {
    const createRes = await request(app).post(GATEWAY_PATH).send({
      name: 'External',
      type: 'HOWTO',
      sourceType: 'URL',
      sourceUrl: 'https://example.com/docs',
    });

    const contentRes = await request(app)
      .get(`${GATEWAY_PATH}/${createRes.body.documentId}/content`)
      .redirects(0);
    expect(contentRes.status).toBe(303);
    expect(contentRes.headers.location).toBe('https://example.com/docs');
  });

  it('returns 409 for a duplicate document name', async () => {
    const body = {
      name: 'Dup',
      type: 'HOWTO',
      sourceType: 'URL',
      sourceUrl: 'https://example.com/1',
    };
    await request(app).post(GATEWAY_PATH).send(body).expect(201);
    const res = await request(app).post(GATEWAY_PATH).send(body);
    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid metadata', async () => {
    const res = await request(app)
      .post(GATEWAY_PATH)
      .send({ type: 'HOWTO', sourceType: 'MARKDOWN', inlineContent: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns 413 when an uploaded file exceeds the configured size limit', async () => {
    await buildApp({ enabled: true, documents: { maxFileSizeMb: 0.000001 } });
    const res = await request(app)
      .post(GATEWAY_PATH)
      .field(
        'metadata',
        JSON.stringify({ name: 'Big', type: 'SAMPLES', sourceType: 'FILE' }),
      )
      .attach('file', Buffer.alloc(1024, 'a'), 'big.txt');
    expect(res.status).toBe(413);
  });

  it('returns 501 for all document routes when storage.enabled is false', async () => {
    await buildApp({ enabled: false });
    const res = await request(app).post(GATEWAY_PATH).send({
      name: 'X',
      type: 'HOWTO',
      sourceType: 'URL',
      sourceUrl: 'https://x',
    });
    expect(res.status).toBe(501);
  });

  it('returns 403 for create/update/delete against an on-prem APIM entity', async () => {
    const createRes = await request(app).post(APIM_PATH).send({
      name: 'X',
      type: 'HOWTO',
      sourceType: 'URL',
      sourceUrl: 'https://x',
    });
    expect(createRes.status).toBe(403);

    const putRes = await request(app)
      .put(`${APIM_PATH}/doc-1`)
      .send({ summary: 'nope' });
    expect(putRes.status).toBe(403);

    const deleteRes = await request(app).delete(`${APIM_PATH}/doc-1`);
    expect(deleteRes.status).toBe(403);
  });

  it('lists on-prem documents read-only via the ApimPublisherDocumentStore', async () => {
    mockClientInstance.getDocuments.mockResolvedValue({
      count: 1,
      list: [
        {
          id: 'd1',
          documentId: 'd1',
          name: 'Legacy doc',
          sourceType: 'URL',
          sourceUrl: 'https://x',
        },
      ],
    });

    const res = await request(app).get(APIM_PATH);
    expect(res.status).toBe(200);
    expect(res.body.capabilities).toEqual({
      read: true,
      create: false,
      updateMetadata: false,
      updateContent: false,
      delete: false,
    });
    expect(res.body.list).toHaveLength(1);
  });

  it('returns 404 for an entity with no WSO2 document annotations', async () => {
    const res = await request(app).get(
      '/entities/api/default/plain-api/documents',
    );
    expect(res.status).toBe(404);
  });

  it('leaves the legacy on-prem content proxy route untouched', async () => {
    mockClientInstance.getDocumentContentStream.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/plain']]),
      body: null,
    });

    const res = await request(app).get(
      '/apis/apim-api-1/documents/doc-1/content',
    );
    expect(res.status).toBe(204);
    expect(mockClientInstance.getDocumentContentStream).toHaveBeenCalledWith(
      'apim-api-1',
      'doc-1',
    );
  });
});
