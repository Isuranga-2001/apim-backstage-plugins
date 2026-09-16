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
import { RouteContext } from './types';

export function registerConfigRoutes(
  router: express.Router,
  { client, ensureAuthenticated, logger, apiPortalConfig }: RouteContext,
) {
  router.get('/config', async (req, res) => {
    try {
      await ensureAuthenticated(req);
      const clientConfig = client.getConfig();
      res.json({
        apiManager: {
          enabled: Boolean(clientConfig.apiManager?.enabled),
        },
        platformGateway: {
          enabled: Boolean(clientConfig.platformGateway?.enabled),
          enableWriteOperations: Boolean(
            clientConfig.platformGateway?.enableWriteOperations,
          ),
          gatewayCount: clientConfig.platformGateways.length,
        },
        apiPortal: {
          enabled: Boolean(apiPortalConfig?.enabled),
          baseUrl: apiPortalConfig?.baseUrl ?? '',
        },
      });
    } catch (e: any) {
      logger.error(`Failed to fetch WSO2 runtime config: ${e.message}`);
      res.status(500).json({ message: e.message });
    }
  });
}
