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

import { fetch as undiciFetch, Agent } from 'undici';
import { PlatformGateway } from './types';

/**
 * The subset of Wso2Client used for gateway discovery. Gateway discovery
 * endpoints carry their own URL and auth, so discovery can also run with a
 * standalone fetcher when the API Manager integration is disabled.
 */
export interface GatewayApiFetcher {
  getGatewayApis(discoveryUrl: string, auth?: string): Promise<any>;
  getGatewayApiDetail(
    discoveryUrl: string,
    apiId: string,
    auth?: string,
  ): Promise<any>;
}

/**
 * Creates a gateway discovery fetcher that does not depend on any
 * wso2ApiPlatform (API Manager) configuration.
 */
export function createGatewayApiFetcher(): GatewayApiFetcher {
  const dispatcher = new Agent();
  const getJson = async (url: string, auth?: string): Promise<any> => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (auth) headers.Authorization = auth;
    const response = await undiciFetch(url, { headers, dispatcher });
    if (!response.ok) {
      throw new Error(`Gateway request failed with status ${response.status}`);
    }
    return response.json();
  };
  return {
    getGatewayApis: (discoveryUrl, auth) => getJson(discoveryUrl, auth),
    getGatewayApiDetail: (discoveryUrl, apiId, auth) =>
      getJson(`${discoveryUrl}/${apiId}`, auth),
  };
}

/**
 * Discovers APIs directly from self-hosted gateways.
 */
export async function discoverWSO2PlatformGatewayApis(
  platformGateways: PlatformGateway[],
  client?: GatewayApiFetcher,
): Promise<any[]> {
  const discoveredWso2PlatformGatewayApis: any[] = [];
  const fetcher = client ?? createGatewayApiFetcher();

  for (const gw of platformGateways) {
    if (gw.discoveryUrl) {
      try {
        const data = await fetcher.getGatewayApis(
          gw.discoveryUrl,
          gw.discoveryAuth,
        );
        const wso2ApiPlatformGatewayApis =
          data.apis ||
          data.list ||
          data.items ||
          (Array.isArray(data) ? data : [data]) ||
          [];

        for (const gatewayApiItem of wso2ApiPlatformGatewayApis) {
          // Gateway-controller 1.2.x /rest-apis returns raw RestApi resources
          // (the id lives at status.id and the stable handle at metadata.name)
          // rather than flat {id, ...} items; support both shapes.
          const gatewayApiId =
            gatewayApiItem.id ??
            gatewayApiItem.metadata?.name ??
            gatewayApiItem.status?.id;
          if (!gatewayApiId) continue;

          try {
            const detailData = await fetcher.getGatewayApiDetail(
              gw.discoveryUrl,
              gatewayApiId,
              gw.discoveryAuth,
            );

            // Accept both the {status: 'success', api: {...}} wrapper and the
            // gateway-controller 1.2.x raw RestApi resource response.
            let adaptedApi: any = undefined;
            if (detailData.status === 'success' && detailData.api) {
              adaptedApi = detailData.api;
            } else if (detailData.kind === 'RestApi' && detailData.spec) {
              adaptedApi = {
                id: detailData.status?.id ?? detailData.metadata?.name,
                name: detailData.spec.displayName ?? detailData.metadata?.name,
                displayName: detailData.spec.displayName,
                version: detailData.spec.version,
                context: detailData.spec.context,
                lifeCycleStatus: detailData.status?.state,
                policies: detailData.spec.policies,
                operations: detailData.spec.operations,
                configuration: detailData,
              };
            }
            if (!adaptedApi) {
              continue;
            }

            const gatewayApiDetails = adaptedApi;

            const gatewayApi = {
              ...gatewayApiDetails,
              id: gatewayApiDetails.id,
              initiatedFromGateway: true,
              isDirectDiscovery: true,
              environmentName: gw.environmentName,
              environmentType: gw.environmentType,
              gatewayUrls: gw.urls,
              fullConfig: gatewayApiDetails.configuration,
            };

            const gwSpec = gatewayApiDetails.configuration.spec;
            gatewayApi.fetchedSwagger = JSON.stringify(gwSpec, null, 2);
            discoveredWso2PlatformGatewayApis.push(gatewayApi);
          } catch (err) {
            // Client already logs errors, continue to the next API
          }
        }
      } catch (error: any) {
        // Client already logs errors, continue to the next gateway
      }
    }
  }
  return discoveredWso2PlatformGatewayApis;
}
