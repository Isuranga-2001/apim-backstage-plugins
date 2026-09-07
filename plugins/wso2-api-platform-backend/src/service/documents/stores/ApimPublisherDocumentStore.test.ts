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

import { NotAllowedError } from '@backstage/errors';
import { Wso2ApiPlatformClient } from '../../client';
import { ApiRef } from '../types';
import { ApimPublisherDocumentStore } from './ApimPublisherDocumentStore';

const REF: ApiRef = {
  sourceKind: 'apim',
  gatewayId: '',
  apiId: 'apim-api-1',
  entityRef: 'api:default/orders-api',
};

describe('ApimPublisherDocumentStore', () => {
  const client = {
    getDocuments: jest.fn(),
    getDocument: jest.fn(),
    getDocumentContentStream: jest.fn(),
  } as unknown as jest.Mocked<
    Pick<
      Wso2ApiPlatformClient,
      'getDocuments' | 'getDocument' | 'getDocumentContentStream'
    >
  >;
  let store: ApimPublisherDocumentStore;

  beforeEach(() => {
    jest.clearAllMocks();
    store = new ApimPublisherDocumentStore(
      client as unknown as Wso2ApiPlatformClient,
    );
  });

  it('reports read-only capabilities', () => {
    expect(store.capabilities).toEqual({
      read: true,
      create: false,
      updateMetadata: false,
      updateContent: false,
      delete: false,
    });
  });

  it('lists documents via the existing client', async () => {
    client.getDocuments.mockResolvedValue({
      count: 1,
      list: [
        {
          id: 'd1',
          documentId: 'd1',
          name: 'Doc',
          sourceType: 'URL',
          sourceUrl: 'https://x',
        },
      ],
    });

    const list = await store.list(REF);
    expect(client.getDocuments).toHaveBeenCalledWith('apim-api-1');
    expect(list).toEqual([
      expect.objectContaining({
        documentId: 'd1',
        name: 'Doc',
        sourceType: 'URL',
      }),
    ]);
  });

  it('redirects for URL documents without hitting the content stream', async () => {
    client.getDocument.mockResolvedValue({
      id: 'd1',
      name: 'Doc',
      sourceType: 'URL',
      sourceUrl: 'https://example.com/doc',
    });

    const content = await store.getContent(REF, 'd1');
    expect(content).toEqual({
      kind: 'redirect',
      url: 'https://example.com/doc',
    });
    expect(client.getDocumentContentStream).not.toHaveBeenCalled();
  });

  it.each(['create', 'updateMetadata', 'delete'] as const)(
    'rejects %s with NotAllowedError',
    async method => {
      await expect((store as any)[method](REF, 'd1', {}, {})).rejects.toThrow(
        NotAllowedError,
      );
    },
  );
});
