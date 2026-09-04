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

import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';

import { Wso2Client } from '../lib/client';
import { Wso2DiscoveryService } from '../lib/discoveryService';
import { PlatformGateway } from '../lib/domains/gateway';

/**
 * Provides API entities from WSO2 Publisher API.
 */
export class Wso2ApiEntityProvider implements EntityProvider {
  private readonly config: Config;
  private readonly logger: LoggerService;
  private readonly id: string;
  private connection?: EntityProviderConnection;
  private readonly discoveryService: Wso2DiscoveryService;

  /**
   * Static factory method to create the provider from configuration.
   */
  static fromConfig(
    config: Config,
    options: { id: string; logger: LoggerService },
  ) {
    const apiManagerEnabled =
      config.getOptionalBoolean('wso2ApiPlatform.enabled') ?? false;
    const client = apiManagerEnabled
      ? new Wso2Client({ config, logger: options.logger })
      : undefined;
    const discoveryService = new Wso2DiscoveryService({
      client,
      logger: options.logger,
    });
    return new Wso2ApiEntityProvider({
      id: options.id,
      config,
      logger: options.logger,
      discoveryService,
    });
  }

  private constructor(options: {
    id: string;
    config: Config;
    logger: LoggerService;
    discoveryService: Wso2DiscoveryService;
  }) {
    this.id = options.id;
    this.config = options.config;
    this.logger = options.logger;
    this.discoveryService = options.discoveryService;
  }

  getProviderName(): string {
    return `${this.id}`;
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
  }

  async run(): Promise<void> {
    if (!this.connection) {
      throw new Error(
        `${this.getProviderName()} entity provider is not initialized`,
      );
    }

    this.logger.debug(`Running ${this.getProviderName()}`);

    const namespace =
      this.config.getOptionalString(
        'catalog.providers.wso2ApiPlatform.namespace',
      ) || 'default';
    const platformGateways = this.parseWso2PlatformGateways();
    const apiManagerEnabled =
      this.config.getOptionalBoolean('wso2ApiPlatform.enabled') ?? false;
    try {
      const allEntities = await this.discoveryService.discoverAll({
        namespace,
        providerId: this.id,
        platformGateways,
        apiManagerEnabled,
        onPublisherApiProgress: ({ loaded, total, message }) => {
          this.logger.debug(
            `[WSO2 Provider] Progress: ${loaded}/${total} - ${message}`,
          );
        },
        onCatalogResourceTotals: totals => {
          this.logger.debug(
            `[WSO2 Provider] Totals: ${JSON.stringify(totals)}`,
          );
        },
      });
      this.logger.info(
        `${this.getProviderName()} discovery returned ${allEntities.length}`,
      );

      await this.connection.applyMutation({
        type: 'full',
        entities: allEntities.map(entity => ({
          entity,
          locationKey: this.getProviderName(),
        })),
      });
      this.logger.info(
        `Applied ${allEntities.length} entities to Backstage catalog.`,
      );

      this.logger.info(
        `[WSO2 Provider] Successfully ingested ${allEntities.length} entities.`,
      );
      this.logger.info(`${this.getProviderName()} catalog sync finished.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[WSO2 Provider] Sync Error: ${message}`);
      throw error;
    }
  }

  private parseWso2PlatformGateways(): PlatformGateway[] {
    const platformGatewayEnabled =
      this.getOptionalBoolean('wso2ApiPlatformGateway.enabled') ?? false;
    const gatewayConfigs =
      this.getOptionalConfigArray('wso2ApiPlatformGateway.gateways') ?? [];
    if (!platformGatewayEnabled) {
      return [];
    }

    return gatewayConfigs.map(gw => ({
      environmentName: gw.getString('name'),
      environmentType: gw.getOptionalString('environmentType') || 'WSO2',
      urls: gw.getStringArray('urls'),
      discoveryUrl: gw.getString('discoveryUrl'),
      discoveryAuth:
        gw.getString('discoveryUsername') && gw.getString('discoveryPassword')
          ? `Basic ${Buffer.from(
              `${gw.getString('discoveryUsername')}:${gw.getString(
                'discoveryPassword',
              )}`,
            ).toString('base64')}`
          : undefined,
      organizationId: gw.getOptionalString('organizationId'),
      integration:
        gw.getOptionalString('integration') === 'openchoreo'
          ? 'openchoreo'
          : 'self-hosted',
    }));
  }

  private getOptionalBoolean(key: string): boolean | undefined {
    try {
      return this.config.getOptionalBoolean(key);
    } catch {
      return undefined;
    }
  }

  private getOptionalConfigArray(key: string) {
    try {
      return this.config.getOptionalConfigArray(key);
    } catch {
      return undefined;
    }
  }
}
