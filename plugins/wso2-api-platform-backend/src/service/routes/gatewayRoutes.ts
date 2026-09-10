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
import { gatewayStatusTracker } from '@wso2/backstage-plugin-catalog-backend-module-wso2-api-platform';
import { RouteContext } from './types';

export function registerGatewayRoutes(
  router: express.Router,
  { client, ensureAuthenticated, logger }: RouteContext,
) {
  router.get('/gateways', async (req, res) => {
    try {
      await ensureAuthenticated(req);

      const config = client.getConfig();
      const gateways: any[] = [];

      // 1. Fetch APIM environments (if APIM is enabled)
      if (config.apiManager?.enabled) {
        try {
          const settings = await client.getSettings();
          const gatewayTypes = settings?.gatewayTypes || [];

          gatewayTypes.forEach((gwType: string) => {
            gateways.push({
              name: gwType,
              type: gwType,
              gatewayType: gwType,
              description: `APIM Gateway: ${gwType}`,
              source: 'APIM',
              urls: [],
              status: 'Online',
            });
          });
        } catch (e: any) {
          logger.warn(
            `Failed to fetch APIM settings for gateways: ${e.message}. Check APIM configuration or client credentials.`,
          );
        }
      }

      if (config.platformGateway?.enabled && config.selfHostedGateways) {
        const gwPromises = config.selfHostedGateways.map(async gw => {
          let status = 'Online';
          if (gw.discoveryUrl) {
            try {
              await client.getGatewayApis(gw.discoveryUrl, gw.discoveryAuth);
            } catch (error) {
              status = 'Offline';
            }
          }
          const gatewayType =
            gw.integration === 'openchoreo' ? 'OpenChoreo' : 'Self Hosted';
          return {
            name: gw.name,
            type: 'wso2',
            gatewayType,
            description: gw.description || `Self-Hosted Gateway: ${gw.name}`,
            source: 'Config',
            urls: gw.discoveryUrl ? [gw.discoveryUrl] : [],
            status,
            active: gatewayStatusTracker.getStatus(gw.name).active,
          };
        });

        const selfHostedGateways = await Promise.all(gwPromises);
        gateways.push(...selfHostedGateways);
      }

      res.json(gateways);
    } catch (e: any) {
      logger.error(`Failed to fetch gateways: ${e.message}`);
      res.status(500).json({ message: e.message });
    }
  });
}
