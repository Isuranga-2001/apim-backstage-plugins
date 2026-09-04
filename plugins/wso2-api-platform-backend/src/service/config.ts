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

import { RootConfigService } from '@backstage/backend-plugin-api';
import { Wso2ApiPlatformConfig } from './types';

function getOptionalBoolean(
  config: RootConfigService,
  key: string,
): boolean | undefined {
  try {
    return config.getOptionalBoolean(key);
  } catch {
    return undefined;
  }
}

function getOptionalConfigArray(config: RootConfigService, key: string) {
  try {
    return config.getOptionalConfigArray(key);
  } catch {
    return undefined;
  }
}

function getOptionalString(config: RootConfigService, key: string) {
  try {
    return config.getOptionalString(key);
  } catch {
    return undefined;
  }
}

export function readWso2ApiPlatformConfig(
  config: RootConfigService,
): Wso2ApiPlatformConfig {
  const wso2Config = config.getOptionalConfig('wso2ApiPlatform');
  const apiManagerEnabled = wso2Config?.getOptionalBoolean('enabled') ?? false;

  const baseUrl = apiManagerEnabled ? wso2Config!.getString('baseUrl') : '';
  const publisherBasePath = apiManagerEnabled
    ? wso2Config!.getString('publisherBasePath')
    : '';
  const developerBasePath = apiManagerEnabled
    ? wso2Config!.getString('developerBasePath')
    : '';
  const serviceCatalogBasePath = apiManagerEnabled
    ? wso2Config!.getOptionalString('serviceCatalogBasePath')
    : undefined;

  const authConfig = apiManagerEnabled
    ? wso2Config!.getConfig('auth')
    : undefined;
  const clientId = authConfig?.getString('clientId') ?? '';
  const clientSecret = authConfig?.getString('clientSecret') ?? '';
  const tokenUrl = authConfig?.getOptionalString('tokenUrl');
  const username = apiManagerEnabled
    ? authConfig?.getOptionalString('username') ??
      getOptionalString(config, 'catalog.providers.wso2ApiPlatform.username')
    : undefined;
  const password = apiManagerEnabled
    ? authConfig?.getOptionalString('password') ??
      getOptionalString(config, 'catalog.providers.wso2ApiPlatform.password')
    : undefined;

  const tlsRejectUnauthorized =
    wso2Config?.getOptionalBoolean('tls.rejectUnauthorized') ?? true;

  const platformGatewayConfigs =
    getOptionalConfigArray(config, 'wso2ApiPlatformGateway.gateways') ?? [];
  const platformGatewayEnabled =
    getOptionalBoolean(config, 'wso2ApiPlatformGateway.enabled') ?? false;

  const selfHostedGateways = platformGatewayEnabled
    ? platformGatewayConfigs.map(gw => {
        const discoveryUsername = gw.getOptionalString('discoveryUsername');
        const discoveryPassword = gw.getOptionalString('discoveryPassword');

        return {
          name: gw.getString('name'),
          urls: gw.getStringArray('urls'),
          discoveryUrl: gw.getOptionalString('discoveryUrl'),
          discoveryAuth:
            discoveryUsername && discoveryPassword
              ? `Basic ${Buffer.from(
                  `${discoveryUsername}:${discoveryPassword}`,
                ).toString('base64')}`
              : undefined,
          environmentType:
            gw.getOptionalString('environmentType') || 'PRODUCTION',
          description: gw.getOptionalString('description'),
          organizationId: gw.getOptionalString('organizationId'),
          integration:
            gw.getOptionalString('integration') === 'openchoreo'
              ? ('openchoreo' as const)
              : ('self-hosted' as const),
        };
      })
    : [];

  return {
    apiManager: {
      enabled: apiManagerEnabled,
    },
    platformGateway: {
      enabled: platformGatewayEnabled,
    },
    baseUrl,
    publisherBasePath,
    developerBasePath,
    serviceCatalogBasePath,
    auth: {
      clientId,
      clientSecret,
      tokenUrl,
      username,
      password,
    },
    tls: {
      rejectUnauthorized: tlsRejectUnauthorized,
    },
    selfHostedGateways,
  };
}
