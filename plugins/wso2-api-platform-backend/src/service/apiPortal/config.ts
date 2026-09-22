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
export const DEFAULT_SERVICE_ACCOUNT_SCOPE =
  'dp:api:manage dp:api_content:manage dp:label:read dp:subscription_plan:read';

export type ApiPortalAuthMode = 'platform-login' | 'idp';
export type ApiPortalIdpStrategy =
  | 'manual'
  | 'service-account'
  | 'reuse-signin';

export type ApiPortalServiceAccountConfig = {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  audience?: string;
  scope: string;
};

export type ApiPortalReuseSignInConfig = {
  providerId: string;
  scopes: string[];
};

export type ApiPortalConfig = {
  enabled: boolean;
  baseUrl: string;
  basePath: string;
  auth: {
    mode: ApiPortalAuthMode;
    idp?: {
      strategy: ApiPortalIdpStrategy;
      serviceAccount?: ApiPortalServiceAccountConfig;
      reuseSignIn?: ApiPortalReuseSignInConfig;
    };
  };
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

  const strategy =
    authMode === 'idp'
      ? (getOptionalString(
          config,
          'wso2ApiPlatformApiPortal.auth.idp.strategy',
        ) as ApiPortalIdpStrategy | undefined) ?? 'manual'
      : undefined;
  if (
    strategy &&
    !['manual', 'service-account', 'reuse-signin'].includes(strategy)
  ) {
    throw new Error(
      `wso2ApiPlatformApiPortal.auth.idp.strategy '${strategy}' is not supported`,
    );
  }

  // Fail at startup, not at first publish click — same discipline as every
  // other required-when-enabled field in this file.
  const serviceAccount: ApiPortalServiceAccountConfig | undefined =
    enabled && strategy === 'service-account'
      ? {
          tokenUrl: config.getString(
            'wso2ApiPlatformApiPortal.auth.idp.serviceAccount.tokenUrl',
          ),
          clientId: config.getString(
            'wso2ApiPlatformApiPortal.auth.idp.serviceAccount.clientId',
          ),
          clientSecret: config.getString(
            'wso2ApiPlatformApiPortal.auth.idp.serviceAccount.clientSecret',
          ),
          audience: getOptionalString(
            config,
            'wso2ApiPlatformApiPortal.auth.idp.serviceAccount.audience',
          ),
          scope:
            getOptionalString(
              config,
              'wso2ApiPlatformApiPortal.auth.idp.serviceAccount.scope',
            ) ?? DEFAULT_SERVICE_ACCOUNT_SCOPE,
        }
      : undefined;

  const reuseSignIn: ApiPortalReuseSignInConfig | undefined =
    enabled && strategy === 'reuse-signin'
      ? {
          providerId: config.getString(
            'wso2ApiPlatformApiPortal.auth.idp.reuseSignIn.providerId',
          ),
          scopes:
            getOptionalStringArray(
              config,
              'wso2ApiPlatformApiPortal.auth.idp.reuseSignIn.scopes',
            ) ?? [],
        }
      : undefined;

  const auth: ApiPortalConfig['auth'] = {
    mode: authMode,
    ...(strategy ? { idp: { strategy, serviceAccount, reuseSignIn } } : {}),
  };

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
