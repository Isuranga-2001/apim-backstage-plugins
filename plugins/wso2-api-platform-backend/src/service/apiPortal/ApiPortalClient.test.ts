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
import { mockServices } from '@backstage/backend-test-utils';
import { fetch as undiciFetch } from 'undici';
import { ApiPortalClient } from './ApiPortalClient';
import { ApiPortalConfig } from './config';
import { PortalApiForm } from './types';

jest.mock('undici', () => {
  const actual = jest.requireActual('undici');
  return {
    ...actual,
    fetch: jest.fn(),
    Agent: jest.fn().mockImplementation(() => ({ close: jest.fn() })),
  };
});

const mockFetch = jest.mocked(undiciFetch);

const CONFIG: ApiPortalConfig = {
  enabled: true,
  baseUrl: 'https://portal.example.com',
  basePath: '/api-portal/api/v0.9',
  auth: { mode: 'platform-login' },
  defaults: {
    status: 'PUBLISHED',
    subscriptionPlans: [],
    agentVisibility: 'VISIBLE',
  },
  requestTimeoutSeconds: 30,
  tls: { rejectUnauthorized: true },
};

const FORM: PortalApiForm = {
  metadata: {
    id: 'payment-api-service-v1.0',
    name: 'Payment API',
    version: '1.0.0',
    type: 'REST',
    status: 'PUBLISHED',
  },
  definitionContent: 'openapi: 3.0.0\ninfo:\n  title: Payment API\n',
  definitionFileName: 'definition.yaml',
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'status text',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as any;
}

describe('ApiPortalClient', () => {
  let client: ApiPortalClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new ApiPortalClient(CONFIG, mockServices.logger.mock());
  });

  describe('checkAccessible', () => {
    it('resolves when the portal responds, regardless of status', async () => {
      mockFetch.mockResolvedValue(jsonResponse(404, {}));
      await expect(client.checkAccessible()).resolves.toBeUndefined();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://portal.example.com/api-portal/api/v0.9');
      expect(options?.method).toBe('GET');
    });

    it('throws ServiceUnavailableError when the connection fails', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(client.checkAccessible()).rejects.toThrow(
        ServiceUnavailableError,
      );
      await expect(client.checkAccessible()).rejects.toThrow(/not reachable/);
    });
  });

  describe('getApi', () => {
    it('returns the parsed metadata on 200', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(200, {
          id: 'payment-api-service-v1.0',
          name: 'Payment API',
        }),
      );

      const result = await client.getApi('payment-api-service-v1.0', 'token-1');

      expect(result).toEqual({
        id: 'payment-api-service-v1.0',
        name: 'Payment API',
      });
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'https://portal.example.com/api-portal/api/v0.9/apis/payment-api-service-v1.0',
      );
      expect(options?.method).toBe('GET');
      expect((options?.headers as Record<string, string>).Authorization).toBe(
        'Bearer token-1',
      );
    });

    it('returns undefined on 404', async () => {
      mockFetch.mockResolvedValue(jsonResponse(404, {}));
      await expect(
        client.getApi('missing', 'token-1'),
      ).resolves.toBeUndefined();
    });

    it('throws ConflictError with a scope hint on 401/403', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(403, {
          status: 'error',
          code: 'FORBIDDEN',
          message: 'Forbidden',
        }),
      );
      await expect(client.getApi('any', 'token-1')).rejects.toThrow(
        ConflictError,
      );
      await expect(client.getApi('any', 'token-1')).rejects.toThrow(
        /dp:\* scopes/,
      );
    });

    it('throws a plain Error on 5xx', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(500, {
          status: 'error',
          code: 'INTERNAL_SERVER_ERROR',
          message: 'boom',
        }),
      );
      const error = await client.getApi('any', 'token-1').catch(e => e);
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(ConflictError);
      expect(error.message).toMatch(/boom/);
    });
  });

  describe('createApi', () => {
    it('POSTs a multipart body with metadata and definition fields', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(201, { id: 'payment-api-service-v1.0' }),
      );

      const result = await client.createApi(FORM, 'token-1');

      expect(result.id).toBe('payment-api-service-v1.0');
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://portal.example.com/api-portal/api/v0.9/apis');
      expect(options?.method).toBe('POST');

      const body = options?.body as FormData;
      expect(JSON.parse(body.get('metadata') as string)).toEqual(FORM.metadata);
      const definitionEntry = body.get('definition') as unknown as Blob;
      expect(await definitionEntry.text()).toBe(FORM.definitionContent);
    });
  });

  describe('updateApi', () => {
    it('PUTs to /apis/{apiId}', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(200, { id: 'payment-api-service-v1.0' }),
      );

      await client.updateApi('payment-api-service-v1.0', FORM, 'token-1');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'https://portal.example.com/api-portal/api/v0.9/apis/payment-api-service-v1.0',
      );
      expect(options?.method).toBe('PUT');
    });

    it('throws ConflictError on a 409 type-mismatch response', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(409, {
          status: 'error',
          code: 'CONFLICT',
          message: 'type is immutable',
        }),
      );
      await expect(
        client.updateApi('payment-api-service-v1.0', FORM, 'token-1'),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('getSubscriptionPlans', () => {
    it('returns the org plan list', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(200, {
          list: [{ id: 'Bronze' }, { id: 'Custom-Plan' }],
          count: 2,
          pagination: { total: 2, limit: 100, offset: 0 },
        }),
      );

      const result = await client.getSubscriptionPlans('token-1');

      expect(result).toEqual([{ id: 'Bronze' }, { id: 'Custom-Plan' }]);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'https://portal.example.com/api-portal/api/v0.9/subscription-plans',
      );
      expect(options?.method).toBe('GET');
    });
  });

  describe('getLabels', () => {
    it('returns the org label list', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(200, {
          list: [{ id: 'default' }, { id: 'premium' }],
          count: 2,
          pagination: { total: 2, limit: 100, offset: 0 },
        }),
      );

      const result = await client.getLabels('token-1');

      expect(result).toEqual([{ id: 'default' }, { id: 'premium' }]);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://portal.example.com/api-portal/api/v0.9/labels');
      expect(options?.method).toBe('GET');
    });
  });

  describe('uploadAssets', () => {
    it('POSTs the zip under the content field, with optional docMetadata', async () => {
      mockFetch.mockResolvedValue(jsonResponse(201, { message: 'ok' }));

      await client.uploadAssets(
        'payment-api-service-v1.0',
        Buffer.from('zip-bytes'),
        'token-1',
        [{ name: 'External guide', url: 'https://example.com', type: 'LINK' }],
      );

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'https://portal.example.com/api-portal/api/v0.9/apis/payment-api-service-v1.0/assets',
      );
      expect(options?.method).toBe('POST');
      const body = options?.body as FormData;
      expect(body.get('content')).toBeTruthy();
      expect(JSON.parse(body.get('docMetadata') as string)).toEqual([
        { name: 'External guide', url: 'https://example.com', type: 'LINK' },
      ]);
    });
  });

  describe('deleteAllDocuments', () => {
    it('DELETEs the document content type for the API', async () => {
      mockFetch.mockResolvedValue(jsonResponse(204, undefined));

      await client.deleteAllDocuments('payment-api-service-v1.0', 'token-1');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'https://portal.example.com/api-portal/api/v0.9/apis/payment-api-service-v1.0/assets?type=DOC_Other',
      );
      expect(options?.method).toBe('DELETE');
      expect((options?.headers as Record<string, string>).Authorization).toBe(
        'Bearer token-1',
      );
    });

    it('treats a 404 (nothing to delete) as success', async () => {
      mockFetch.mockResolvedValue(jsonResponse(404, {}));
      await expect(
        client.deleteAllDocuments('payment-api-service-v1.0', 'token-1'),
      ).resolves.toBeUndefined();
    });

    it('throws on other error statuses', async () => {
      mockFetch.mockResolvedValue(jsonResponse(500, { message: 'boom' }));
      await expect(
        client.deleteAllDocuments('payment-api-service-v1.0', 'token-1'),
      ).rejects.toThrow(/boom/);
    });
  });
});
