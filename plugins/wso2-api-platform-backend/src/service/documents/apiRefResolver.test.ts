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
import { resolveApiRef } from './apiRefResolver';

function makeEntity(annotations: Record<string, string>) {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'API',
    metadata: { name: 'orders-api', namespace: 'wso2-gateways', annotations },
    spec: {},
  };
}

describe('resolveApiRef', () => {
  const credentials = {} as any;

  function catalogWith(entity: unknown) {
    return {
      getEntityByRef: jest.fn().mockResolvedValue(entity),
    } as unknown as Pick<CatalogService, 'getEntityByRef'>;
  }

  it('resolves an api-platform-gateway entity to sourceKind gateway', async () => {
    const catalog = catalogWith(
      makeEntity({
        'wso2.com/api-discovery-type': 'api-platform-gateway',
        'wso2-gateway.com/api-id': 'gw-api-2',
        'wso2-gateway.com/api-endpoints': JSON.stringify([
          { environmentName: 'oc-dev' },
        ]),
      }),
    );

    const apiRef = await resolveApiRef(
      catalog,
      { kind: 'api', namespace: 'wso2-gateways', name: 'orders-api' },
      credentials,
    );

    expect(apiRef).toEqual({
      sourceKind: 'gateway',
      gatewayId: 'oc-dev',
      apiId: 'gw-api-2',
      entityRef: 'api:wso2-gateways/orders-api',
    });
  });

  it('defaults gatewayId to empty string when the endpoints annotation is missing or unparsable', async () => {
    const catalog = catalogWith(
      makeEntity({
        'wso2.com/api-discovery-type': 'api-platform-gateway',
        'wso2-gateway.com/api-id': 'gw-api-2',
        'wso2-gateway.com/api-endpoints': 'not-json',
      }),
    );

    const apiRef = await resolveApiRef(
      catalog,
      { kind: 'api', namespace: 'wso2-gateways', name: 'orders-api' },
      credentials,
    );

    expect(apiRef.gatewayId).toBe('');
  });

  it('throws NotFoundError when the gateway API id annotation is missing', async () => {
    const catalog = catalogWith(
      makeEntity({ 'wso2.com/api-discovery-type': 'api-platform-gateway' }),
    );

    await expect(
      resolveApiRef(
        catalog,
        { kind: 'api', namespace: 'wso2-gateways', name: 'orders-api' },
        credentials,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError for an on-prem APIM entity', async () => {
    const catalog = catalogWith(
      makeEntity({ 'wso2.com/api-id': 'apim-api-1' }),
    );

    await expect(
      resolveApiRef(
        catalog,
        { kind: 'api', namespace: 'default', name: 'orders-api' },
        credentials,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError for a non-WSO2 entity', async () => {
    const catalog = catalogWith(makeEntity({}));

    await expect(
      resolveApiRef(
        catalog,
        { kind: 'api', namespace: 'default', name: 'orders-api' },
        credentials,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when the entity does not exist', async () => {
    const catalog = catalogWith(undefined);

    await expect(
      resolveApiRef(
        catalog,
        { kind: 'api', namespace: 'default', name: 'missing' },
        credentials,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});
