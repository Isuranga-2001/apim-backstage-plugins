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

import { useAsyncRetry } from 'react-use';
import {
  extractGateways,
  retryTransientUnauthorized,
} from '../../../utils/apiManagerUtils';

const CATALOG_ENTITY_PAGE_SIZE = 500;

async function fetchAllCatalogApiEntities(catalogApi: any): Promise<any[]> {
  const items: any[] = [];
  let offset = 0;
  let hasMorePages = true;

  while (hasMorePages) {
    const pageOffset = offset;
    const response: any = await retryTransientUnauthorized(() =>
      catalogApi.getEntities({
        filter: { kind: 'API' },
        fields: [
          'metadata.name',
          'metadata.namespace',
          'metadata.title',
          'metadata.description',
          'metadata.annotations',
        ],
        limit: CATALOG_ENTITY_PAGE_SIZE,
        offset: pageOffset,
      }),
    );

    const pageItems = response.items ?? [];
    items.push(...pageItems);

    const total = response.totalItems ?? response.pageInfo?.totalItems;
    if (typeof total === 'number' && items.length >= total) {
      hasMorePages = false;
    } else if (pageItems.length < CATALOG_ENTITY_PAGE_SIZE) {
      hasMorePages = false;
    } else {
      offset += pageItems.length;
    }
  }

  return items;
}

export const useCatalogEntities = (catalogApi: any) => {
  return useAsyncRetry(async () => {
    const allEntities = await fetchAllCatalogApiEntities(catalogApi);

    const apis = allEntities
      .filter(e => {
        const ann = e.metadata.annotations || {};
        return (
          (ann['wso2.com/api-id'] || ann['wso2-gateway.com/api-id']) &&
          ann['wso2.com/is-api-product'] !== 'true' &&
          ann['wso2.com/is-mcp-server'] !== 'true' &&
          ann['wso2.com/is-service'] !== 'true'
        );
      })
      .map(e => {
        const ann = e.metadata.annotations || {};
        const displayName =
          ann['wso2.com/api-name'] ||
          ann['wso2-gateway.com/api-name'] ||
          e.metadata.name;
        const isGatewayDiscovered = !!ann['wso2-gateway.com/api-id'];
        return {
          id: (ann['wso2.com/api-id'] ||
            ann['wso2-gateway.com/api-id']) as string,
          name: displayName,
          displayName,
          entityName: e.metadata.name,
          namespace: e.metadata.namespace,
          version: (ann['wso2.com/api-version'] ||
            ann['wso2-gateway.com/api-version']) as string,
          context: (ann['wso2.com/api-context'] ||
            ann['wso2-gateway.com/api-context']) as string,
          provider: (ann['wso2.com/api-provider'] || 'Gateway') as string,
          lifeCycleStatus: (ann['wso2.com/api-lifecycle-status'] ||
            (isGatewayDiscovered ? 'N/A' : 'Published')) as string,
          type: ann['wso2.com/api-type'] as string,
          isDiscovered: ann['wso2.com/is-discovered'] === 'true',
          source: isGatewayDiscovered ? 'Gateway' : 'Publisher',
          gateways: [
            {
              gatewayType: ann['wso2.com/api-gateway'] || 'WSO2',
            },
          ],
        };
      });

    const apiProducts = allEntities
      .filter(
        e => e.metadata.annotations?.['wso2.com/is-api-product'] === 'true',
      )
      .map(e => {
        const ann = e.metadata.annotations || {};
        return {
          id: ann['wso2.com/api-id'] as string,
          name: ann['wso2.com/api-name'] || e.metadata.title || e.metadata.name,
          namespace: e.metadata.namespace,
          version: ann['wso2.com/api-version'] as string,
          context: ann['wso2.com/api-context'] as string,
          provider: ann['wso2.com/api-provider'] as string,
          lifeCycleStatus: ann['wso2.com/api-lifecycle-status'] as string,
          type: 'API_PRODUCT',
          isDiscovered: ann['wso2.com/is-discovered'] === 'true',
          gateways: extractGateways(ann),
          entityName: e.metadata.name,
        };
      });

    const mcpServers = allEntities
      .filter(
        e => e.metadata.annotations?.['wso2.com/is-mcp-server'] === 'true',
      )
      .map(e => {
        const ann = e.metadata.annotations || {};
        return {
          id: ann['wso2.com/api-id'] as string,
          name: ann['wso2.com/api-name'],
          namespace: e.metadata.namespace,
          version: ann['wso2.com/api-version'] as string,
          context: ann['wso2.com/api-context'] as string,
          provider: ann['wso2.com/api-provider'] as string,
          lifeCycleStatus: ann['wso2.com/api-lifecycle-status'] as string,
          description: e.metadata.description,
          gateways: extractGateways(ann),
        };
      });

    const services = allEntities
      .filter(e => e.metadata.annotations?.['wso2.com/is-service'] === 'true')
      .map(e => {
        const ann = e.metadata.annotations || {};
        return {
          id: (ann['wso2.com/service-id'] || ann['wso2.com/api-id']) as string,
          name:
            ann['wso2.com/service-name'] ||
            ann['wso2.com/api-name'] ||
            e.metadata.title ||
            e.metadata.name,
          namespace: e.metadata.namespace,
          entityName: e.metadata.name,
          version: (ann['wso2.com/service-version'] ||
            ann['wso2.com/api-version']) as string,
          serviceUrl: (ann['wso2.com/service-url'] ||
            ann['wso2.com/api-context']) as string,
          usage: (ann['wso2.com/service-usage-count'] ||
            ann['wso2.com/usage']) as string,
          provider: ann['wso2.com/api-provider'] as string,
          lifeCycleStatus: ann['wso2.com/api-lifecycle-status'] as string,
          type: 'SERVICE',
          gateways: extractGateways(ann),
        };
      });

    return { apis, apiProducts, mcpServers, services };
  }, [catalogApi]);
};
