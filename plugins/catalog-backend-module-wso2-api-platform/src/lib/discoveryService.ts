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

import { LoggerService } from '@backstage/backend-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { Wso2Client } from './client';
import { fetchGlobalSettings } from './domains/settings';
import { fetchApiList, mapWso2ApiToEntity } from './domains/api';
import { fetchApiProductList, mapWso2ProductToEntity } from './domains/product';
import { fetchMcpServerList, mapWso2McpToEntity } from './domains/mcp';
import { fetchServiceList, mapWso2ServiceToEntity } from './domains/service';
import {
  discoverWSO2PlatformGatewayApis,
  mapDiscoveredApiToEntity,
  PlatformGateway,
} from './domains/gateway';

/**
 * Service responsible for orchestrating the discovery of WSO2 entities.
 */
export class Wso2DiscoveryService {
  private readonly client?: Wso2Client;
  private readonly logger: LoggerService;

  constructor(options: { client?: Wso2Client; logger: LoggerService }) {
    this.client = options.client;
    this.logger = options.logger;
  }

  /**
   * Discovers all entities from WSO2 and maps them to Backstage entities.
   */
  async discoverAll(options: {
    namespace: string;
    providerId: string;
    platformGateways: PlatformGateway[];
    apiManagerEnabled: boolean;
    onPublisherApiProgress?: (progress: {
      loaded: number;
      total?: number;
      message?: string;
    }) => void;
    onCatalogResourceTotals?: (totals: {
      apiProducts?: number;
      mcpServers?: number;
      services?: number;
    }) => void;
  }): Promise<Entity[]> {
    const { namespace, providerId, platformGateways, apiManagerEnabled } =
      options;

    this.logger.info(
      `[Wso2DiscoveryService] Starting discovery for provider ${providerId}`,
    );

    // Gateway discovery only needs the per-gateway discovery URL and auth, so
    // it runs even when the API Manager integration (and its client) is not
    // configured.
    const WSO2PlatformGatewayApisList = await discoverWSO2PlatformGatewayApis(
      platformGateways,
      this.client,
    );

    let globalSettings = undefined;
    let apiList: any[] = [];
    let productList: any[] = [];
    let mcpList: any[] = [];
    let serviceList: any[] = [];

    if (apiManagerEnabled && !this.client) {
      this.logger.error(
        `[Wso2DiscoveryService] Skipping API Manager discovery for provider ${providerId} as client is not defined`,
      );
    } else if (apiManagerEnabled && this.client) {
      // 1. Fetch raw data from WSO2 domains
      globalSettings = await fetchGlobalSettings(this.client);

      if (!globalSettings) {
        this.logger.error(
          '[Wso2Discovery] Skipping discovery: Could not retrieve settings from WSO2 API Manager. Ensure credentials and URL are correct.',
        );
      } else {
        apiList = await fetchApiList(this.client, {
          onProgress: options?.onPublisherApiProgress,
        });

        productList = await fetchApiProductList(this.client, {
          onTotal: (total: number) => {
            options?.onCatalogResourceTotals?.({ apiProducts: total });
          },
        });

        mcpList = await fetchMcpServerList(this.client, {
          onTotal: (total: number) => {
            options?.onCatalogResourceTotals?.({ mcpServers: total });
          },
        });

        serviceList = await fetchServiceList(this.client, {
          onTotal: (total: number) => {
            options?.onCatalogResourceTotals?.({ services: total });
          },
        });
      }
    }

    // 2. Map WSO2 objects to Backstage entities
    const apiEntities =
      globalSettings && apiList.length > 0
        ? apiList.map(api =>
            mapWso2ApiToEntity(api, namespace, providerId, globalSettings!),
          )
        : [];

    const productEntities =
      globalSettings && productList.length > 0
        ? productList.map(product =>
            mapWso2ProductToEntity(
              product,
              namespace,
              providerId,
              globalSettings!,
            ),
          )
        : [];

    const mcpEntities = mcpList.map(mcp =>
      mapWso2McpToEntity(mcp, namespace, providerId),
    );

    const serviceEntities = serviceList.map(svc =>
      mapWso2ServiceToEntity(svc, namespace, providerId),
    );

    const discoveredEntitiesMap = new Map<string, Entity>();
    for (const api of WSO2PlatformGatewayApisList) {
      const entity = mapDiscoveredApiToEntity(api);
      const name = entity.metadata.name;

      if (discoveredEntitiesMap.has(name)) {
        const existing = discoveredEntitiesMap.get(name)!;

        // Merge endpoints
        const existingEndpointsStr =
          existing.metadata.annotations?.['wso2-gateway.com/api-endpoints'] ||
          '[]';
        const newEndpointsStr =
          entity.metadata.annotations?.['wso2-gateway.com/api-endpoints'] ||
          '[]';
        try {
          const existingEndpoints = JSON.parse(existingEndpointsStr);
          const newEndpoints = JSON.parse(newEndpointsStr);
          existing.metadata.annotations!['wso2-gateway.com/api-endpoints'] =
            JSON.stringify([...existingEndpoints, ...newEndpoints]);
        } catch (e) {
          // ignore
        }

        // Merge tags
        const existingTags = existing.metadata.tags || [];
        const newTags = entity.metadata.tags || [];
        existing.metadata.tags = Array.from(
          new Set([...existingTags, ...newTags]),
        );
      } else {
        discoveredEntitiesMap.set(name, entity);
      }
    }
    const discoveredEntities = Array.from(discoveredEntitiesMap.values());

    const allEntities = [
      ...apiEntities,
      ...productEntities,
      ...mcpEntities,
      ...serviceEntities,
      ...discoveredEntities,
    ];

    this.logger.info(
      `[Wso2DiscoveryService] Discovery complete. Found ${allEntities.length} entities.`,
    );
    this.logger.info(
      `[WSO2 Catalog Summary] APIs=${apiEntities.length}, Products=${productEntities.length}, MCP=${mcpEntities.length}, Services=${serviceEntities.length}, Gateway APIs=${discoveredEntities.length}.`,
    );
    this.logger.debug(
      `[WSO2 Catalog Summary] Total catalog entities=${allEntities.length}.`,
    );

    return allEntities;
  }
}
