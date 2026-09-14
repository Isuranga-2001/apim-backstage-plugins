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
import { mockErrorHandler, mockServices } from '@backstage/backend-test-utils';
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

const NON_WSO2_ENTITY = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'API',
  metadata: { name: 'plain-api', namespace: 'default', annotations: {} },
  spec: {},
};

const OPENCHOREO_GATEWAY_CONFIG = {
  apiManager: { enabled: false },
  platformGateway: { enabled: true },
  selfHostedGateways: [
    {
      name: 'oc-dev',
      urls: [],
      managementApiUrl: 'http://localhost:9095/rest-apis',
      managementApiAuth: undefined,
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
    policies: [{ name: 'cors', version: 'v1' }],
    operations: [
      {
        method: 'GET',
        path: '/books',
        policies: [{ name: 'rate-limit', version: 'v1' }],
      },
      { method: 'POST', path: '/books' },
    ],
  },
};

describe('policy routes', () => {
  let app: express.Express;
  let mockHttpAuth: { credentials: jest.Mock };
  let mockCatalog: { getEntityByRef: jest.Mock; refreshEntity: jest.Mock };

  async function buildApp() {
    Object.values(mockClientInstance).forEach(mock => mock.mockReset());
    mockClientInstance.getConfig.mockReturnValue({
      apiManager: { enabled: false },
      platformGateway: { enabled: false },
      selfHostedGateways: [],
    });

    const mockConfig = new ConfigReader({
      backend: { baseUrl: 'http://localhost:7007' },
      wso2ApiPlatform: { enabled: false },
    });

    mockHttpAuth = {
      credentials: jest.fn().mockResolvedValue({
        principal: { type: 'user', userEntityRef: 'user:default/alice' },
      }),
    };
    mockCatalog = {
      getEntityByRef: jest.fn().mockImplementation((ref: string) => {
        if (ref === 'api:wso2-gateways/payment-api') return OPENCHOREO_ENTITY;
        if (ref === 'api:wso2-gateways/orders-api') return GATEWAY_ENTITY;
        if (ref === 'api:default/plain-api') return NON_WSO2_ENTITY;
        return undefined;
      }),
      refreshEntity: jest.fn().mockResolvedValue(undefined),
    };

    // Deliberately omit `database` — proves policy routes work with only a
    // catalog client, no plugin-owned storage involved.
    const router = await createRouter({
      catalog: mockCatalog as any,
      logger: mockServices.logger.mock(),
      httpAuth: mockHttpAuth as any,
      config: mockConfig,
    });

    app = express();
    app.use(router);
    app.use(mockErrorHandler());
  }

  const OPENCHOREO_PATH = '/entities/api/wso2-gateways/payment-api/policies';
  const OPENCHOREO_DIFF_PATH = `${OPENCHOREO_PATH}/diff`;
  const GATEWAY_PATH = '/entities/api/wso2-gateways/orders-api/policies';
  const NON_WSO2_PATH = '/entities/api/default/plain-api/policies';

  beforeEach(async () => {
    await buildApp();
  });

  describe('GET /entities/:kind/:namespace/:name/policies', () => {
    it('returns the live artifact policies for an OpenChoreo entity', async () => {
      mockClientInstance.getConfig.mockReturnValue(OPENCHOREO_GATEWAY_CONFIG);
      mockClientInstance.getGatewayApiDetail.mockResolvedValue(
        DISCOVERED_RESTAPI_CR,
      );

      const res = await request(app).get(OPENCHOREO_PATH);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        policies: {
          apiPolicies: [{ name: 'cors', version: 'v1' }],
          operations: [
            {
              method: 'GET',
              path: '/books',
              policies: [{ name: 'rate-limit', version: 'v1' }],
            },
            { method: 'POST', path: '/books' },
          ],
        },
      });
    });

    it('returns 404 for a non-openchoreo (self-hosted) entity', async () => {
      const res = await request(app).get(GATEWAY_PATH);
      expect(res.status).toBe(404);
    });

    it('returns 404 for a non-WSO2 entity', async () => {
      const res = await request(app).get(NON_WSO2_PATH);
      expect(res.status).toBe(404);
    });

    it('returns 404 when the gateway has no discovery URL configured', async () => {
      mockClientInstance.getConfig.mockReturnValue({
        ...OPENCHOREO_GATEWAY_CONFIG,
        selfHostedGateways: [
          {
            ...OPENCHOREO_GATEWAY_CONFIG.selfHostedGateways[0],
            managementApiUrl: undefined,
          },
        ],
      });

      const res = await request(app).get(OPENCHOREO_PATH);
      expect(res.status).toBe(404);
    });

    it('returns 401 when the request is unauthenticated', async () => {
      mockHttpAuth.credentials.mockRejectedValueOnce(
        new AuthenticationError('no credentials'),
      );
      const res = await request(app).get(OPENCHOREO_PATH);
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /entities/:kind/:namespace/:name/policies', () => {
    it('merges only the touched policies and pushes the result to the gateway', async () => {
      mockClientInstance.getConfig.mockReturnValue(OPENCHOREO_GATEWAY_CONFIG);
      mockClientInstance.getGatewayApiDetail.mockResolvedValue(
        DISCOVERED_RESTAPI_CR,
      );
      mockClientInstance.updateGatewayRestApi.mockResolvedValue({ ok: true });

      const res = await request(app)
        .put(OPENCHOREO_PATH)
        .send({
          apiPolicies: [{ name: 'cors', version: 'v2' }],
          operations: [
            {
              method: 'GET',
              path: '/books',
              policies: [{ name: 'rate-limit', version: 'v2' }],
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(mockClientInstance.updateGatewayRestApi).toHaveBeenCalledWith(
        'http://localhost:9095/rest-apis',
        'payment-api-service-v1.0',
        expect.objectContaining({
          spec: expect.objectContaining({
            policies: [{ name: 'cors', version: 'v2' }],
            operations: expect.arrayContaining([
              expect.objectContaining({
                method: 'GET',
                path: '/books',
                policies: [{ name: 'rate-limit', version: 'v2' }],
              }),
              // untouched operation preserved as-is (never dropped/cleared)
              { method: 'POST', path: '/books' },
            ]),
          }),
        }),
        undefined,
      );
      expect(mockCatalog.refreshEntity).toHaveBeenCalled();
      expect(res.body.policies.apiPolicies).toEqual([
        { name: 'cors', version: 'v2' },
      ]);
    });

    it("leaves operations absent from the request body's operations untouched", async () => {
      mockClientInstance.getConfig.mockReturnValue(OPENCHOREO_GATEWAY_CONFIG);
      mockClientInstance.getGatewayApiDetail.mockResolvedValue(
        DISCOVERED_RESTAPI_CR,
      );
      mockClientInstance.updateGatewayRestApi.mockResolvedValue({ ok: true });

      await request(app)
        .put(OPENCHOREO_PATH)
        .send({ apiPolicies: [], operations: [] });

      const pushedArtifact =
        mockClientInstance.updateGatewayRestApi.mock.calls[0][2];
      expect(pushedArtifact.spec.operations).toEqual(
        DISCOVERED_RESTAPI_CR.spec.operations,
      );
    });

    it('returns 409 when the gateway rejects the update', async () => {
      mockClientInstance.getConfig.mockReturnValue(OPENCHOREO_GATEWAY_CONFIG);
      mockClientInstance.getGatewayApiDetail.mockResolvedValue(
        DISCOVERED_RESTAPI_CR,
      );
      mockClientInstance.updateGatewayRestApi.mockRejectedValue(
        new Error('Gateway rejected the update'),
      );

      const res = await request(app)
        .put(OPENCHOREO_PATH)
        .send({ apiPolicies: [], operations: [] });

      expect(res.status).toBe(409);
    });

    it('returns 409 when the OpenChoreo gateway cannot be reached', async () => {
      mockClientInstance.getConfig.mockReturnValue(OPENCHOREO_GATEWAY_CONFIG);
      mockClientInstance.getGatewayApiDetail.mockRejectedValue(
        new Error('ECONNREFUSED'),
      );

      const res = await request(app)
        .put(OPENCHOREO_PATH)
        .send({ apiPolicies: [], operations: [] });

      expect(res.status).toBe(409);
    });

    it('returns 400 for a malformed payload', async () => {
      const res = await request(app)
        .put(OPENCHOREO_PATH)
        .send({ apiPolicies: 'not-an-array-or-object' });

      expect(res.status).toBe(400);
    });

    it('echoes the input back for a non-openchoreo entity without calling the gateway', async () => {
      const res = await request(app)
        .put(GATEWAY_PATH)
        .send({ apiPolicies: [], operations: [] });

      expect(res.status).toBe(200);
      expect(mockClientInstance.updateGatewayRestApi).not.toHaveBeenCalled();
      expect(res.body).toEqual({
        policies: { apiPolicies: [], operations: [] },
      });
    });

    it('returns 401 when the request is unauthenticated', async () => {
      mockHttpAuth.credentials.mockRejectedValueOnce(
        new AuthenticationError('no credentials'),
      );
      const res = await request(app)
        .put(OPENCHOREO_PATH)
        .send({ apiPolicies: [], operations: [] });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /entities/:kind/:namespace/:name/policies/diff', () => {
    it('returns the diff without pushing anything to the gateway', async () => {
      mockClientInstance.getConfig.mockReturnValue(OPENCHOREO_GATEWAY_CONFIG);
      mockClientInstance.getGatewayApiDetail.mockResolvedValue(
        DISCOVERED_RESTAPI_CR,
      );

      const res = await request(app)
        .post(OPENCHOREO_DIFF_PATH)
        .send({
          apiPolicies: [{ name: 'logging', version: 'v1' }],
          operations: [],
        });

      expect(res.status).toBe(200);
      expect(res.body.diff.hasChanges).toBe(true);
      expect(mockClientInstance.updateGatewayRestApi).not.toHaveBeenCalled();
    });

    it('reports no changes for an identical artifact', async () => {
      mockClientInstance.getConfig.mockReturnValue(OPENCHOREO_GATEWAY_CONFIG);
      mockClientInstance.getGatewayApiDetail.mockResolvedValue(
        DISCOVERED_RESTAPI_CR,
      );

      const res = await request(app)
        .post(OPENCHOREO_DIFF_PATH)
        .send({
          apiPolicies: [{ name: 'cors', version: 'v1' }],
          operations: [
            {
              method: 'GET',
              path: '/books',
              policies: [{ name: 'rate-limit', version: 'v1' }],
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.diff.hasChanges).toBe(false);
    });

    it('returns diff: null for a non-openchoreo entity', async () => {
      const res = await request(app)
        .post(`${GATEWAY_PATH}/diff`)
        .send({ apiPolicies: [], operations: [] });

      expect(res.status).toBe(200);
      expect(res.body.diff).toBeNull();
    });
  });
});
