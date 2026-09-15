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

import { ApiEntity } from '@backstage/catalog-model';
import { Wso2Api } from './types';
import { GlobalSettings } from '../settings/types';

interface GatewayEndpointSource {
  id?: string;
  context?: string;
  version?: string;
  gatewayType?: string;
  gatewayVendor?: string;
}

export enum Wso2ApiType {
  HTTP = 'http',
  OPENAPI = 'openapi',
  GRAPHQL = 'graphql',
  ASYNCAPI = 'asyncapi',
  WEBSUB = 'websub',
  SSE = 'sse',
  WS = 'ws',
  SOAP = 'soap',
  SOAPTOREST = 'soaptorest',
}

export const resolveApiType = (api: any, spec?: any): string => {
  const configKind = api.configuration?.kind?.toLocaleLowerCase('en-US');
  if (configKind === 'restapi') {
    return Wso2ApiType.HTTP;
  }

  const rawType = (
    api.type ||
    api.apiType ||
    spec?.type ||
    configKind ||
    Wso2ApiType.OPENAPI
  ).toLocaleLowerCase('en-US');

  switch (rawType) {
    case 'restapi':
    case 'rest':
    case 'http':
      return Wso2ApiType.HTTP;
    case 'graphql':
      return Wso2ApiType.GRAPHQL;
    case 'async':
    case 'asyncapi':
      return Wso2ApiType.ASYNCAPI;
    case 'ws':
    case 'websocket':
      return Wso2ApiType.WS;
    case 'sse':
      return Wso2ApiType.SSE;
    case 'websub':
      return Wso2ApiType.WEBSUB;
    case 'soap':
      return Wso2ApiType.SOAP;
    case 'soaptorest':
    case 'soap_to_rest':
    case 'soap-to-rest':
      return Wso2ApiType.SOAPTOREST;
    case 'openapi':
      return Wso2ApiType.OPENAPI;
    default:
      throw new Error(`Unsupported API type: ${rawType}`);
  }
};

/**
 * Normalizes a name for use as a Backstage entity name.
 */
export function normalizeEntityName(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-')
      .toLocaleLowerCase('en-US') || 'unknown'
  );
}

/**
 * Normalizes gateway types for consistent display.
 */
export function normalizeGatewayType(type?: string): string {
  const t = (type || '').toLocaleLowerCase('en-US').trim();
  if (
    !t ||
    t === 'wso2/synapse' ||
    t === 'synapse' ||
    t === 'regular' ||
    t === 'wso2'
  )
    return 'WSO2';
  return t;
}

function extractDefinitionDescription(definition?: string): string | undefined {
  if (!definition) return undefined;

  try {
    const parsed = JSON.parse(definition) as {
      info?: { description?: unknown };
    };
    return typeof parsed.info?.description === 'string'
      ? parsed.info.description
      : undefined;
  } catch {
    const match = definition.match(
      /^\s*info:\s*\n(?:[ \t]+[^\n]*\n)*?[ \t]+description:\s*["']?([^"'\n]+)["']?\s*$/m,
    );
    return match?.[1]?.trim() || undefined;
  }
}

/**
 * Maps a WSO2 API object to a Backstage ApiEntity.
 */
export function mapWso2ApiToEntity(
  api: Wso2Api,
  namespace: string,
  providerId: string,
  globalSettings: GlobalSettings | undefined,
): ApiEntity {
  const nameWithVersion = api.version ? `${api.name}-${api.version}` : api.name;
  const normalizedName = normalizeEntityName(nameWithVersion);
  const apiDetails = api as Wso2Api & {
    authorizationHeader?: string;
    apiKeyHeader?: string;
    maxTps?: unknown;
    policies?: unknown[];
    apiPolicies?: unknown;
    operations?: unknown[];
    securityScheme?: string[] | string;
    throttlingPolicy?: string;
  };

  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'API',
    metadata: {
      name: normalizedName,
      namespace,
      title: api.displayName,
      description:
        extractDefinitionDescription(api.definition) ||
        api.description ||
        `WSO2 API: ${api.name}`,
      tags: (api.tags || []).map(normalizeEntityName).filter(Boolean),
      annotations: {
        'backstage.io/managed-by-location': `wso2-apim:${providerId}`,
        'backstage.io/managed-by-origin-location': `wso2-apim:${providerId}`,
        'wso2.com/api-id': api.id || '',
        'wso2.com/api-name': api.name || '',
        'wso2.com/api-version': api.version || '',
        'wso2.com/api-context': api.context || '',
        'wso2.com/api-provider': api.provider || '',
        'wso2.com/api-type': resolveApiType(api) || '',
        'wso2.com/api-lifecycle-status': api.lifeCycleStatus || '',
        'wso2.com/api-gateway': api.gatewayType || api.gatewayVendor || '',
        'wso2.com/is-discovered':
          api.gatewayVendor === 'external' ? 'true' : 'false',
        'wso2.com/api-documents': api.documents
          ? JSON.stringify(api.documents)
          : '[]',
        'wso2.com/api-endpoints': api.endpointURLs
          ? JSON.stringify(api.endpointURLs)
          : '[]',
        'wso2.com/gateway-endpoints': reconstructGatewayEndpoints(
          api,
          globalSettings,
        ),
        'wso2.com/api-wsdl': api.wsdlDefinition || '',
        'wso2.com/api-throttling-policy': api.apiThrottlingPolicy || '',
        'wso2.com/api-transports': Array.isArray(api.transport)
          ? JSON.stringify(api.transport)
          : '[]',
        'wso2.com/api-visibility': api.visibility || '',
        'wso2.com/api-security-scheme': apiDetails.securityScheme
          ? JSON.stringify(apiDetails.securityScheme)
          : '',
        'wso2.com/api-authorization-header':
          apiDetails.authorizationHeader || '',
        'wso2.com/api-key-header': apiDetails.apiKeyHeader || '',
        'wso2.com/api-max-tps':
          apiDetails.maxTps !== undefined ? String(apiDetails.maxTps) : '',
        'wso2.com/policies': Array.isArray(apiDetails.policies)
          ? JSON.stringify(apiDetails.policies)
          : '[]',
        'wso2.com/api-level-policies': apiDetails.apiPolicies
          ? JSON.stringify(apiDetails.apiPolicies)
          : '{}',
        'wso2.com/operation-level-policies': Array.isArray(
          apiDetails.operations,
        )
          ? JSON.stringify(apiDetails.operations)
          : '[]',
      },
    },
    spec: {
      type: resolveApiType(api),
      lifecycle: 'production',
      owner: normalizeEntityName(api.provider || 'unknown'),
      definition: api.definition || '',
    },
  } as ApiEntity;
}

/**
 * Helper to reconstruct gateway endpoints based on deployment status.
 */
export function reconstructGatewayEndpoints(
  api: GatewayEndpointSource,
  globalSettings: GlobalSettings | undefined,
): string {
  if (!globalSettings || !globalSettings.environment) return '[]';

  const apiGatewayType = normalizeGatewayType(
    api.gatewayType || api.gatewayVendor || 'WSO2',
  ).toLocaleUpperCase('en-US');

  const matchedEnvs = globalSettings.environment.filter(env => {
    const envType = normalizeGatewayType(
      env.gatewayType || env.type || '',
    ).toLocaleUpperCase('en-US');

    return apiGatewayType === envType;
  });

  if (matchedEnvs.length === 0) return '[]';

  const enrichedEndpoints = matchedEnvs
    .map(env => {
      const vhost = env.vhosts?.[0];
      if (!vhost) return undefined;

      const host = vhost.host;

      let context = api.context || '';
      if (!context.startsWith('/')) context = `/${context}`;
      if (api.version) context = context.replace('$version', api.version);
      const basePath = vhost.basePath || '';
      let fullPath = context;
      if (basePath && !fullPath.startsWith(basePath)) {
        fullPath = `${basePath.replace(/\/$/, '')}/${fullPath.replace(
          /^\//,
          '',
        )}`;
      }
      if (
        api.version &&
        !fullPath.endsWith(api.version) &&
        !fullPath.includes(`/${api.version}/`)
      ) {
        fullPath = `${fullPath.replace(/\/$/, '')}/${api.version}`;
      }

      const urls: string[] = [];
      if (vhost.httpsPort) {
        const port = vhost.httpsPort === 443 ? '' : `:${vhost.httpsPort}`;
        urls.push(`https://${host}${port}${fullPath}`);
      }
      if (vhost.httpPort) {
        const port = vhost.httpPort === 80 ? '' : `:${vhost.httpPort}`;
        urls.push(`http://${host}${port}${fullPath}`);
      }

      return {
        environmentName: env.name,
        environmentType: env.type,
        gatewayType: normalizeGatewayType(env.gatewayType),
        displayName: env.displayName || env.name,
        urls,
      };
    })
    .filter(Boolean);
  return JSON.stringify(enrichedEndpoints);
}
