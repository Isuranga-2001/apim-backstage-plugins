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
import { createRouter } from './router';
import { ConfigReader } from '@backstage/config';
import { mockServices } from '@backstage/backend-test-utils';

jest.mock('undici', () => ({
  request: jest.fn(),
  fetch: jest.fn(),
  Agent: jest.fn().mockImplementation(() => ({ close: jest.fn() })),
}));

// Mock instance to control Wso2ApiPlatformClient methods in router
const mockClientInstance = {
  generateApiKey: jest.fn(),
  getRevisions: jest.fn(),
  getGateways: jest.fn(),
  getSettings: jest.fn(),
  getConfig: jest.fn(),
  getDocument: jest.fn(),
  getDocumentContentStream: jest.fn(),
  getApiWsdlStream: jest.fn(),
  getServices: jest.fn(),
  getServiceUsage: jest.fn(),
  getServiceDefinition: jest.fn(),
  getPublisherBaseUrl: jest.fn(),
  getDevportalBaseUrl: jest.fn(),
  getServiceCatalogBaseUrl: jest.fn(),
};
jest.mock('./client', () => {
  const actual = jest.requireActual('./client');
  return {
    ...actual,
    Wso2ApiPlatformClient: jest
      .fn()
      .mockImplementation(() => mockClientInstance),
  };
});

describe('wso2-api-platform-backend router', () => {
  let app: express.Express;
  let mockHttpAuth: { credentials: jest.Mock };
  let mockAuth: {
    getOwnServiceCredentials: jest.Mock;
    getPluginRequestToken: jest.Mock;
  };
  let mockCatalog: { getEntities: jest.Mock };

  beforeEach(async () => {
    Object.values(mockClientInstance).forEach(mock => mock.mockReset());

    const mockConfig = new ConfigReader({
      backend: {
        baseUrl: 'http://localhost:7007',
      },
      wso2ApiPlatform: {
        enabled: true,
        baseUrl: 'https://apim.wso2.com',
        publisherBasePath: '/api/am/publisher/v3',
        developerBasePath: '/api/am/devportal/v3',
        serviceCatalogBasePath: '/api/am/service-catalog/v1',
        auth: {
          clientId: 'id',
          clientSecret: 'secret',
          tokenUrl: 'https://apim.wso2.com/oauth2/token',
        },
        tls: {
          rejectUnauthorized: true,
        },
      },
    });

    mockHttpAuth = {
      credentials: jest.fn().mockResolvedValue({}),
    };
    mockAuth = {
      getOwnServiceCredentials: jest
        .fn()
        .mockResolvedValue({ type: 'backstage' }),
      getPluginRequestToken: jest
        .fn()
        .mockResolvedValue({ token: 'catalog-token' }),
    };
    mockCatalog = {
      getEntities: jest.fn().mockResolvedValue({ items: [] }),
    };

    mockClientInstance.getConfig.mockReturnValue({
      apiManager: { enabled: true },
      platformGateway: { enabled: false },
      selfHostedGateways: [],
    });
    mockClientInstance.getPublisherBaseUrl.mockReturnValue(
      'https://apim.wso2.com/api/am/publisher/v3',
    );
    mockClientInstance.getDevportalBaseUrl.mockReturnValue(
      'https://apim.wso2.com/api/am/devportal/v3',
    );
    mockClientInstance.getServiceCatalogBaseUrl.mockReturnValue(
      'https://apim.wso2.com/api/am/service-catalog/v1',
    );
    mockClientInstance.getServiceCatalogBaseUrl.mockReturnValue(
      'https://apim.wso2.com/api/am/service-catalog/v1',
    );

    const router = await createRouter({
      auth: mockAuth as any,
      catalog: mockCatalog as any,
      logger: mockServices.logger.mock(),
      httpAuth: mockHttpAuth as any,
      config: mockConfig,
    });

    app = express();
    app.use(router);
  });

  describe('POST /apis/:apiId/generate-key', () => {
    it('should delegate API key generation to the DevPortal Basic Auth flow', async () => {
      const mockResult = { key: 'secret-key-123' };
      mockClientInstance.generateApiKey.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/apis/api-123/generate-key')
        .set('X-WSO2-Access-Token', 'user-token-should-not-be-forwarded')
        .send({
          keyName: 'BackstageKey',
          keyType: 'PRODUCTION',
          validityPeriod: 15552000,
          additionalProperties: {
            permittedIP: '',
            permittedReferer: 'https://example.com',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockHttpAuth.credentials).toHaveBeenCalledWith(expect.anything(), {
        allow: ['user'],
      });
      expect(mockClientInstance.generateApiKey).toHaveBeenCalledWith(
        'api-123',
        {
          keyName: 'BackstageKey',
          keyType: 'PRODUCTION',
          validityPeriod: 15552000,
          additionalProperties: {
            permittedIP: '',
            permittedReferer: 'https://example.com',
          },
        },
      );
    });

    it('should reject unauthenticated API key generation requests', async () => {
      mockHttpAuth.credentials.mockRejectedValueOnce(new Error('Unauthorized'));

      const response = await request(app).post('/apis/api-123/generate-key');

      expect(response.status).toBe(500);
      expect(mockClientInstance.generateApiKey).not.toHaveBeenCalled();
    });
  });

  describe('GET /apis/:apiId/revisions', () => {
    it('should invoke client revisions with correct options and query params', async () => {
      const mockResult = { list: [] };
      mockClientInstance.getRevisions.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .get('/apis/api-123/revisions')
        .query({ query: 'active' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockClientInstance.getRevisions).toHaveBeenCalledWith('api-123', {
        query: 'active',
        token: undefined,
      });
    });
  });

  describe('GET /apis/:apiId/documents/:documentId/content', () => {
    it('should fallback to markdown content on 404 for inline documents', async () => {
      // 1. Content stream mock returns 404
      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as any);

      // 2. Document details mock returns inline markdown
      mockClientInstance.getDocument.mockResolvedValueOnce({
        name: 'My Document',
        sourceType: 'MARKDOWN',
        inlineContent: '# Hello Markdown',
      });

      const response = await request(app).get(
        '/apis/api-123/documents/doc-123/content',
      );
      expect(response.status).toBe(200);
      expect(response.text).toBe('# Hello Markdown');
      expect(response.headers['content-type']).toContain('text/markdown');
      expect(response.headers['content-disposition']).toContain(
        'filename="My Document.md"',
      );
    });

    it('should pipe content stream successfully on 200 OK', async () => {
      const mockHeaders = {
        get: jest.fn().mockImplementation((name: string) => {
          if (name === 'content-type') return 'text/plain';
          if (name === 'content-disposition')
            return 'attachment; filename="doc.txt"';
          return null;
        }),
      };

      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Streamed Text Content'));
          controller.close();
        },
      });

      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        body: mockBody,
      } as any);

      const response = await request(app).get(
        '/apis/api-123/documents/doc-123/content',
      );
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toBe('Streamed Text Content');
    });

    it('should handle JSON responses from stream fallbacks', async () => {
      const mockHeaders = {
        get: jest.fn().mockImplementation((name: string) => {
          if (name === 'content-type') return 'application/json';
          return null;
        }),
      };

      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        body: {} as any, // prevent 204 body-absence early exit
        json: jest
          .fn()
          .mockResolvedValueOnce({ inlineContent: 'JSON Text Content' }),
      } as any);

      const response = await request(app).get(
        '/apis/api-123/documents/doc-123/content',
      );
      expect(response.status).toBe(200);
      expect(response.text).toBe('JSON Text Content');
    });

    it('should return 204 for document content stream with null body', async () => {
      const mockHeaders = {
        get: jest.fn().mockImplementation((name: string) => {
          if (name === 'content-type') return 'text/plain';
          return null;
        }),
      };
      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        body: null,
      } as any);

      const response = await request(app).get(
        '/apis/api-123/documents/doc-123/content',
      );
      expect(response.status).toBe(204);
    });

    it('should handle error when content stream fails with non-404 status', async () => {
      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValueOnce('Internal error occurred'),
      } as any);

      const response = await request(app).get(
        '/apis/api-123/documents/doc-123/content',
      );
      expect(response.status).toBe(500);
      expect(response.text).toBe('Internal error occurred');
    });

    it('should handle error when content stream fails with non-404 status and text() throws', async () => {
      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: jest.fn().mockRejectedValueOnce(new Error('fail text')),
        statusText: 'Internal Error',
      } as any);

      const response = await request(app).get(
        '/apis/api-123/documents/doc-123/content',
      );
      expect(response.status).toBe(500);
      expect(response.text).toBe('Internal Error');
    });

    it('should return error when content stream is 404 but document details fails', async () => {
      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValueOnce('Not Found'),
      } as any);
      mockClientInstance.getDocument.mockResolvedValueOnce(null);

      const response = await request(app).get(
        '/apis/api-123/documents/doc-123/content',
      );
      expect(response.status).toBe(404);
    });

    it('should handle catch block errors gracefully', async () => {
      mockClientInstance.getDocumentContentStream.mockRejectedValueOnce(
        new Error('Unexpected error'),
      );

      const response = await request(app).get(
        '/apis/api-123/documents/doc-123/content',
      );
      expect(response.status).toBe(500);
      expect(response.text).toBe('Unexpected error');
    });
  });

  describe('GET /apis/:apiId/wsdl', () => {
    it('should pipe WSDL stream successfully on 200 OK', async () => {
      const mockHeaders = {
        get: jest.fn().mockImplementation((name: string) => {
          if (name === 'content-type') return 'application/wsdl+xml';
          return null;
        }),
      };

      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('WSDL Content'));
          controller.close();
        },
      });

      mockClientInstance.getApiWsdlStream.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        body: mockBody,
      } as any);

      const response = await request(app).get('/apis/api-123/wsdl');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain(
        'application/wsdl+xml',
      );
      expect(response.text).toBe('WSDL Content');
    });

    it('should return 204 for null WSDL stream body', async () => {
      const mockHeaders = {
        get: jest.fn().mockImplementation(() => null),
      };
      mockClientInstance.getApiWsdlStream.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        body: null,
      } as any);

      const response = await request(app).get('/apis/api-123/wsdl');
      expect(response.status).toBe(204);
    });

    it('should handle non-200 WSDL stream response', async () => {
      mockClientInstance.getApiWsdlStream.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValueOnce('Bad Request'),
      } as any);

      const response = await request(app).get('/apis/api-123/wsdl');
      expect(response.status).toBe(400);
      expect(response.text).toBe('Bad Request');
    });

    it('should handle non-200 WSDL stream response when text() throws', async () => {
      mockClientInstance.getApiWsdlStream.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: jest.fn().mockRejectedValueOnce(new Error('fail text')),
        statusText: 'Bad Request',
      } as any);

      const response = await request(app).get('/apis/api-123/wsdl');
      expect(response.status).toBe(400);
      expect(response.text).toBe('Bad Request');
    });

    it('should handle catch block errors gracefully', async () => {
      mockClientInstance.getApiWsdlStream.mockRejectedValueOnce(
        new Error('Unexpected WSDL error'),
      );

      const response = await request(app).get('/apis/api-123/wsdl');
      expect(response.status).toBe(500);
      expect(response.text).toBe('Unexpected WSDL error');
    });
  });

  describe('Error handling across other routes', () => {
    it('GET /gateways should return 500 on general failure', async () => {
      mockClientInstance.getSettings.mockRejectedValueOnce(
        new Error('Settings failed'),
      );
      // Cause settings failed & config check fails
      mockClientInstance.getConfig.mockImplementationOnce(() => {
        throw new Error('Config failed');
      });

      const response = await request(app).get('/gateways');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Config failed');
    });

    it('POST /apis/:apiId/generate-key should return 500 on failure', async () => {
      mockClientInstance.generateApiKey.mockRejectedValueOnce(
        new Error('Key failed'),
      );

      const response = await request(app).post('/apis/api-123/generate-key');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Key failed');
    });

    it('GET /apis/:apiId/revisions should return 500 on failure', async () => {
      mockClientInstance.getRevisions.mockRejectedValueOnce(
        new Error('Revisions failed'),
      );

      const response = await request(app).get('/apis/api-123/revisions');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Revisions failed');
    });

    it('should test getGateways list mapping defaults and fallbacks', async () => {
      mockClientInstance.getSettings.mockResolvedValueOnce({
        gatewayTypes: ['Env1', 'Env2', 'Env3'],
      });
      mockClientInstance.getConfig.mockReturnValueOnce({
        apiManager: { enabled: true },
        platformGateway: { enabled: false },
        selfHostedGateways: [],
      });

      const response = await request(app).get('/gateways');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          name: 'Env1',
          type: 'Env1',
          gatewayType: 'Env1',
          description: 'APIM Gateway: Env1',
          source: 'APIM',
          urls: [],
          status: 'Online',
        },
        {
          name: 'Env2',
          type: 'Env2',
          gatewayType: 'Env2',
          description: 'APIM Gateway: Env2',
          source: 'APIM',
          urls: [],
          status: 'Online',
        },
        {
          name: 'Env3',
          type: 'Env3',
          gatewayType: 'Env3',
          description: 'APIM Gateway: Env3',
          source: 'APIM',
          urls: [],
          status: 'Online',
        },
      ]);
    });

    it('should handle document JSON responses without inlineContent field', async () => {
      const mockHeaders = {
        get: jest.fn().mockImplementation((name: string) => {
          if (name === 'content-type') return 'application/json';
          return null;
        }),
      };

      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        body: {} as any,
        json: jest.fn().mockResolvedValueOnce({ rawKey: 'RAW_VALUE' }),
      } as any);

      const response = await request(app).get(
        '/apis/api-123/documents/doc-123/content',
      );
      expect(response.status).toBe(200);
      expect(response.text).toContain('RAW_VALUE');
    });

    it('should fallback to markdown content on 404 for inline documents with URL source type', async () => {
      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as any);

      // Document details returns URL source type (should NOT match inline/markdown check)
      mockClientInstance.getDocument.mockResolvedValueOnce({
        name: 'My Document',
        sourceType: 'URL',
      });

      const response = await request(app).get(
        '/apis/api-123/documents/doc-123/content',
      );
      expect(response.status).toBe(404);
    });

    it('should handle stream reading errors for document content stream', async () => {
      const mockHeaders = {
        get: jest.fn().mockImplementation((name: string) => {
          if (name === 'content-type') return 'text/plain';
          return null;
        }),
      };

      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Partial stream chunk'));
          controller.error(new Error('Mock stream breakdown'));
        },
      });

      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        body: mockBody,
      } as any);

      const response = await request(app).get(
        '/apis/api-123/documents/doc-123/content',
      );
      expect(response.status).toBe(500);
    });

    it('should pipe WSDL stream successfully when headers are missing', async () => {
      const mockHeaders = {
        get: jest.fn().mockImplementation(() => null),
      };

      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('WSDL Content'));
          controller.close();
        },
      });

      mockClientInstance.getApiWsdlStream.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        body: mockBody,
      } as any);

      const response = await request(app).get('/apis/api-123/wsdl');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/xml');
    });

    it('should handle stream reading errors for WSDL content stream', async () => {
      const mockHeaders = {
        get: jest.fn().mockImplementation(() => null),
      };

      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('WSDL Content chunk'));
          controller.error(new Error('WSDL stream broke'));
        },
      });

      mockClientInstance.getApiWsdlStream.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        body: mockBody,
      } as any);

      const response = await request(app).get('/apis/api-123/wsdl');
      expect(response.status).toBe(500);
    });

    it('should getRevisions successfully without query string', async () => {
      const mockResult = { list: [] };
      mockClientInstance.getRevisions.mockResolvedValueOnce(mockResult);

      const response = await request(app).get('/apis/api-123/revisions');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockClientInstance.getRevisions).toHaveBeenCalledWith('api-123', {
        query: undefined,
        token: undefined,
      });
    });
  });
});
