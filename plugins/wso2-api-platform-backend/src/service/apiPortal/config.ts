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

export const DEFAULT_API_PORTAL_BASE_URL =
  'https://devportal.preview-dv.bijira.dev';
export const DEFAULT_API_PORTAL_BASE_PATH = '/api-portal/api/v0.9';

export type ApiPortalAuthMode = 'platform-login' | 'idp';

export type ApiPortalConfig = {
  enabled: boolean;
  baseUrl: string;
  basePath: string;
  auth: { mode: ApiPortalAuthMode };
  defaults: {
    status: 'PUBLISHED' | 'DEPRECATED';
    subscriptionPlans: string[];
    agentVisibility: 'VISIBLE' | 'HIDDEN';
  };
  requestTimeoutSeconds: number;
  tls: { rejectUnauthorized: boolean };
};

function getOptionalString(config: RootConfigService, key: string) {
  try {
    return config.getOptionalString(key);
  } catch {
    return undefined;
  }
}

function getOptionalNumber(config: RootConfigService, key: string) {
  try {
    return config.getOptionalNumber(key);
  } catch {
    return undefined;
  }
}

function getOptionalStringArray(config: RootConfigService, key: string) {
  try {
    return config.getOptionalStringArray(key);
  } catch {
    return undefined;
  }
}

function getOptionalBoolean(config: RootConfigService, key: string) {
  try {
    return config.getOptionalBoolean(key);
  } catch {
    return undefined;
  }
}

export function readApiPortalConfig(
  config: RootConfigService,
): ApiPortalConfig {
  const enabled =
    getOptionalBoolean(config, 'wso2ApiPlatformApiPortal.enabled') ?? false;

  const baseUrl =
    getOptionalString(config, 'wso2ApiPlatformApiPortal.baseUrl') ??
    DEFAULT_API_PORTAL_BASE_URL;
  const basePath =
    getOptionalString(config, 'wso2ApiPlatformApiPortal.basePath') ??
    DEFAULT_API_PORTAL_BASE_PATH;

  const authMode =
    (getOptionalString(config, 'wso2ApiPlatformApiPortal.auth.mode') as
      | ApiPortalAuthMode
      | undefined) ?? 'platform-login';
  if (authMode !== 'platform-login' && authMode !== 'idp') {
    throw new Error(
      `wso2ApiPlatformApiPortal.auth.mode '${authMode}' is not supported; use 'platform-login' or 'idp'`,
    );
  }
  if (enabled && authMode === 'idp') {
    throw new Error(
      "wso2ApiPlatformApiPortal.auth.mode 'idp' is not implemented yet; use 'platform-login'",
    );
  }
  const auth: ApiPortalConfig['auth'] = { mode: authMode };

  const status =
    (getOptionalString(config, 'wso2ApiPlatformApiPortal.defaults.status') as
      | ApiPortalConfig['defaults']['status']
      | undefined) ?? 'PUBLISHED';
  const agentVisibility =
    (getOptionalString(
      config,
      'wso2ApiPlatformApiPortal.defaults.agentVisibility',
    ) as ApiPortalConfig['defaults']['agentVisibility'] | undefined) ??
    'VISIBLE';
  const subscriptionPlans =
    getOptionalStringArray(
      config,
      'wso2ApiPlatformApiPortal.defaults.subscriptionPlans',
    ) ?? [];

  const requestTimeoutSeconds =
    getOptionalNumber(
      config,
      'wso2ApiPlatformApiPortal.requestTimeoutSeconds',
    ) ?? 30;

  const tlsRejectUnauthorized =
    getOptionalBoolean(
      config,
      'wso2ApiPlatformApiPortal.tls.rejectUnauthorized',
    ) ?? true;

  return {
    enabled,
    baseUrl,
    basePath,
    auth,
    defaults: { status, subscriptionPlans, agentVisibility },
    requestTimeoutSeconds,
    tls: { rejectUnauthorized: tlsRejectUnauthorized },
  };
}
