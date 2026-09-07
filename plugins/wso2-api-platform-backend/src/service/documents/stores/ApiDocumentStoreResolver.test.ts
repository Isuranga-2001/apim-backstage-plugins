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

import { NotFoundError } from '@backstage/errors';
import type { CatalogService } from '@backstage/plugin-catalog-node';
import { ApiDocumentStore } from './ApiDocumentStore';
import { ApiDocumentStoreResolver } from './ApiDocumentStoreResolver';

function makeEntity(annotations: Record<string, string>) {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'API',
    metadata: { name: 'orders-api', namespace: 'wso2-gateways', annotations },
    spec: {},
  };
}

describe('ApiDocumentStoreResolver', () => {
  const databaseStore = { name: 'database' } as unknown as ApiDocumentStore;
  const apimStore = { name: 'apim' } as unknown as ApiDocumentStore;
  const credentials = {} as any;

  function resolverWith(entity: unknown) {
    const catalog: Pick<CatalogService, 'getEntityByRef'> = {
      getEntityByRef: jest.fn().mockResolvedValue(entity),
    };
    return new ApiDocumentStoreResolver(
      catalog as CatalogService,
      databaseStore,
      apimStore,
    );
  }

  it('routes self-hosted-gateway entities to the database store', async () => {
    const resolver = resolverWith(
      makeEntity({
        'wso2.com/api-discovery-type': 'self-hosted-gateway',
        'wso2-gateway.com/api-id': 'gw-api-1',
        'wso2-gateway.com/api-endpoints': JSON.stringify([
          { environmentName: 'dev' },
        ]),
      }),
    );

    const { apiRef, store } = await resolver.resolve(
      { kind: 'api', namespace: 'wso2-gateways', name: 'orders-api' },
      credentials,
    );

    expect(store).toBe(databaseStore);
    expect(apiRef).toEqual({
      sourceKind: 'self-hosted',
      gatewayId: 'dev',
      apiId: 'gw-api-1',
      entityRef: 'api:wso2-gateways/orders-api',
    });
  });

  it('routes openchoreo-gateway entities to the database store with sourceKind openchoreo', async () => {
    const resolver = resolverWith(
      makeEntity({
        'wso2.com/api-discovery-type': 'openchoreo-gateway',
        'wso2-gateway.com/api-id': 'gw-api-2',
      }),
    );

    const { apiRef, store } = await resolver.resolve(
      { kind: 'api', namespace: 'wso2-gateways', name: 'orders-api' },
      credentials,
    );

    expect(store).toBe(databaseStore);
    expect(apiRef.sourceKind).toBe('openchoreo');
    expect(apiRef.gatewayId).toBe('');
  });

  it('routes on-prem APIM entities (wso2.com/api-id, no discovery-type) to the apim store', async () => {
    const resolver = resolverWith(
      makeEntity({ 'wso2.com/api-id': 'apim-api-1' }),
    );

    const { apiRef, store } = await resolver.resolve(
      { kind: 'api', namespace: 'default', name: 'orders-api' },
      credentials,
    );

    expect(store).toBe(apimStore);
    expect(apiRef).toMatchObject({ sourceKind: 'apim', apiId: 'apim-api-1', gatewayId: '' });
  });

  it('throws NotFoundError for a non-WSO2 entity', async () => {
    const resolver = resolverWith(makeEntity({}));
    await expect(
      resolver.resolve(
        { kind: 'api', namespace: 'default', name: 'orders-api' },
        credentials,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when the entity does not exist', async () => {
    const resolver = resolverWith(undefined);
    await expect(
      resolver.resolve(
        { kind: 'api', namespace: 'default', name: 'missing' },
        credentials,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});
