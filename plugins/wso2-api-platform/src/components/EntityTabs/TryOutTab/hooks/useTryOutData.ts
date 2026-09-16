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

import { useMemo } from 'react';
import { useAsync } from 'react-use';
import * as yaml from 'js-yaml';
import { Entity, getCompoundEntityRef } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { wso2ApiPlatformApiRef, Wso2ApiDetail } from '../../../../api';
import { formatGraphQL, formatAsyncApi, isAsyncType } from '../../../../utils';

const API_ENDPOINTS_ANNOTATION = 'wso2.com/api-endpoints';
const GATEWAY_ENDPOINTS_ANNOTATION = 'wso2-gateway.com/api-endpoints';
const WSO2_GATEWAY_ENDPOINTS_ANNOTATION = 'wso2.com/gateway-endpoints';
const PLATFORM_GATEWAY_ENDPOINTS_ANNOTATION =
  'wso2.com/platform-gateway-endpoints';
const API_TYPE_ANNOTATION = 'wso2.com/api-type';
const API_POLICY_DETAILS_ANNOTATION = 'wso2.com/api-level-policies';
const API_OPERATIONS_ANNOTATION = 'wso2.com/operation-level-policies';
const DISCOVERY_TYPE_ANNOTATION = 'wso2.com/api-discovery-type';

function parseAnnotationJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const useTryOutData = (options: {
  entity: Entity;
  apiId?: string;
  isApiPlatform: boolean;
}): {
  details: Wso2ApiDetail | undefined;
  definition: any;
  isDefinitionLoading: boolean;
  hasOperationsOnly: boolean;
  gatewayOperations: any[];
  gatewayApiPolicies: any[];
  formattedSource: string;
  gatewayUrls: Array<{
    environmentName: string;
    url: string;
    environmentType?: string;
  }>;
  isDeployed: boolean;
  swaggerSpec: any;
  isPlaceholder: boolean;
  isRevisionsLoading: boolean;
  hasLiveOpenApiSpec: boolean;
} => {
  const { entity, apiId, isApiPlatform } = options;
  const apiClient = useApi(wso2ApiPlatformApiRef);

  const isApiPlatformGateway =
    entity.metadata.annotations?.[DISCOVERY_TYPE_ANNOTATION] ===
    'api-platform-gateway';

  const entityRef = useMemo(() => getCompoundEntityRef(entity), [entity]);

  const storedDefinitionState = useAsync(async () => {
    if (!isApiPlatformGateway) return null;
    try {
      const res = await apiClient.getDefinition(entityRef);
      return res.definition;
    } catch (e) {
      return null;
    }
  }, [apiClient, entityRef, isApiPlatformGateway]);

  const storedOpenApiSpec = useMemo(() => {
    const content = storedDefinitionState.value?.content;
    if (!isApiPlatformGateway || !content) return undefined;
    try {
      const doc = yaml.load(content) as any;
      if (doc && typeof doc === 'object' && (doc.openapi || doc.swagger)) {
        return doc;
      }
    } catch (e) {
      /* ignore - not a parseable OpenAPI/Swagger document */
    }
    return undefined;
  }, [storedDefinitionState.value, isApiPlatformGateway]);

  const details = useMemo(() => {
    const annotations = entity.metadata.annotations || {};
    const type = annotations[API_TYPE_ANNOTATION];
    if (!type) return undefined;

    const policies = parseAnnotationJson<string[]>(
      annotations['wso2.com/policies'],
      [],
    );

    const securityScheme = parseAnnotationJson<string[] | undefined>(
      annotations['wso2.com/api-security-scheme'],
      undefined,
    );
    const apiPolicies = parseAnnotationJson<any>(
      annotations[API_POLICY_DETAILS_ANNOTATION],
      undefined,
    );
    const operations = parseAnnotationJson<any[]>(
      annotations[API_OPERATIONS_ANNOTATION],
      [],
    );

    const apiKeyHeader = annotations['wso2.com/api-key-header'];
    const authorizationHeader =
      annotations['wso2.com/api-authorization-header'];

    return {
      type,
      policies,
      apiPolicies,
      operations,
      securityScheme,
      apiKeyHeader,
      authorizationHeader,
    } as Wso2ApiDetail;
  }, [entity.metadata.annotations]);

  const definitionState = useMemo(() => {
    const definition = entity.spec?.definition as string | undefined;
    if (!definition) return { value: null, loading: false };
    if (typeof definition === 'string' && definition.trim().startsWith('{')) {
      try {
        return { value: JSON.parse(definition), loading: false };
      } catch (e) {
        /* ignore */
      }
    }
    return { value: definition, loading: false };
  }, [entity.spec?.definition]);

  const hasOperationsOnly = useMemo(() => {
    const val = definitionState.value;
    if (!val || typeof val !== 'object') return false;
    const ops =
      (val as any).operations || (val as any).configuration?.spec?.operations;
    return Array.isArray(ops) && !(val as any).openapi && !(val as any).swagger;
  }, [definitionState.value]);

  const gatewayOperations = useMemo(() => {
    if (details?.operations && details.operations.length > 0) {
      return details.operations;
    }
    const val = definitionState.value as any;
    if (!val) return [];
    // AsyncAPI uses `channels`, OpenAPI uses `operations`, and custom K8s CRDs might use `configuration.spec.operations`
    return (
      val.channels ||
      val.operations ||
      val.configuration?.spec?.operations ||
      []
    );
  }, [definitionState.value, details?.operations]);

  const gatewayApiPolicies = useMemo(() => {
    if (details?.apiPolicies) return details.apiPolicies;
    const val = definitionState.value as any;
    if (!val) return [];
    return val.policies || val.configuration?.spec?.policies || [];
  }, [definitionState.value, details?.apiPolicies]);

  const formattedSource = useMemo(() => {
    if (!definitionState.value) return '';
    const type = details?.type;
    if (type === 'GRAPHQL' && typeof definitionState.value === 'string') {
      return formatGraphQL(definitionState.value);
    }
    if (isAsyncType(type) && typeof definitionState.value === 'string') {
      return formatAsyncApi(definitionState.value);
    }
    return typeof definitionState.value === 'string'
      ? definitionState.value
      : JSON.stringify(definitionState.value, null, 2);
  }, [definitionState.value, details?.type]);

  const gatewayUrls = useMemo(() => {
    const wso2GatewayEndpoints =
      entity.metadata.annotations?.[WSO2_GATEWAY_ENDPOINTS_ANNOTATION];
    const gatewayEndpoints =
      entity.metadata.annotations?.[GATEWAY_ENDPOINTS_ANNOTATION];
    const platformEndpoints =
      entity.metadata.annotations?.[PLATFORM_GATEWAY_ENDPOINTS_ANNOTATION];
    const standardEndpoints =
      entity.metadata.annotations?.[API_ENDPOINTS_ANNOTATION];

    let allEnvs: any[] = [];
    try {
      if (platformEndpoints) {
        const parsed = JSON.parse(platformEndpoints);
        if (Array.isArray(parsed)) allEnvs = [...parsed];
      } else if (gatewayEndpoints) {
        const parsed = JSON.parse(gatewayEndpoints);
        if (Array.isArray(parsed)) allEnvs = [...parsed];
      } else {
        // Standard WSO2 API - Prioritize vhosts from gateway-endpoints
        if (wso2GatewayEndpoints) {
          const parsed = JSON.parse(wso2GatewayEndpoints);
          if (Array.isArray(parsed) && parsed.length > 0) {
            allEnvs = [...parsed];
          }
        }

        // Fallback to standard endpoints if no vhosts found
        if (allEnvs.length === 0 && standardEndpoints) {
          const parsed = JSON.parse(standardEndpoints);
          if (Array.isArray(parsed)) allEnvs = [...parsed];
        }
      }
    } catch (e) {
      /* ignore */
    }

    if (allEnvs.length === 0) return [];

    const sortedEnvs = [...allEnvs].sort((a: any, b: any) => {
      const typeA = (a.environmentType || '').toUpperCase();
      const typeB = (b.environmentType || '').toUpperCase();
      if (typeA === 'PRODUCTION' && typeB !== 'PRODUCTION') return -1;
      if (typeA !== 'PRODUCTION' && typeB === 'PRODUCTION') return 1;
      return 0;
    });

    return sortedEnvs.flatMap((env: any) => {
      let urls: string[] = [];
      if (Array.isArray(env.urls)) {
        urls = env.urls;
      } else if (env.url) {
        urls = [env.url];
      } else if (env.endpointUrl) {
        urls = [env.endpointUrl];
      } else if (env.URLs && typeof env.URLs === 'object') {
        urls = Object.values(env.URLs).filter(
          (u): u is string => typeof u === 'string',
        );
      } else if (env.Default && typeof env.Default === 'object') {
        urls = Object.values(env.Default).filter(
          (u): u is string => typeof u === 'string',
        );
      }

      // Ensure no null strings or empty values propagate
      urls = urls.filter(u => u && u !== 'null').sort();

      return urls.map((url: string) => ({
        url,
        description: env.displayName || env.environmentName,
        environmentName: env.environmentName,
        environmentType: env.environmentType,
      }));
    });
  }, [entity]);

  const revisionsState = useAsync(async () => {
    if (!apiId || isApiPlatform) return undefined;
    try {
      return await apiClient.getRevisions(apiId, {
        query: 'deployed:true',
      });
    } catch (e: any) {
      return null;
    }
  }, [apiClient, apiId, isApiPlatform]);

  const isDeployed = useMemo(() => {
    const isGatewayDiscovered =
      !!entity.metadata.annotations?.['wso2-gateway.com/api-id'];

    // For Publisher APIs, we ONLY consider it deployed if there are deployed revisions
    if (!isGatewayDiscovered) {
      const list = (revisionsState.value as any)?.list;
      return Array.isArray(list) && list.length > 0;
    }

    // For discovered APIs (Self-hosted or Platform), we check gatewayUrls
    return gatewayUrls.length > 0;
  }, [entity, gatewayUrls, revisionsState.value]);

  const swaggerSpec = useMemo(() => {
    if (storedOpenApiSpec) {
      const spec = JSON.parse(JSON.stringify(storedOpenApiSpec));
      if (gatewayUrls.length > 0) {
        spec.servers = gatewayUrls.map(gw => ({
          url: gw.url,
          description: gw.description,
        }));
      }
      return spec;
    }

    if (!definitionState.value && !hasOperationsOnly) return undefined;
    const val = definitionState.value;
    let spec: any;

    if (hasOperationsOnly) {
      spec = {
        openapi: '3.0.0',
        info: {
          title: entity.metadata.title || entity.metadata.name,
          version: '1.0.0',
        },
        paths: {},
        servers: [],
      };
    } else if (typeof val === 'string') {
      try {
        spec = JSON.parse(val);
      } catch (e) {
        // If it's not JSON (e.g. YAML), return the string as-is.
        // SwaggerUI handles YAML strings, but we can't easily override servers without a parser.
        return val;
      }
    } else {
      spec = JSON.parse(JSON.stringify(val)); // Deep clone to avoid mutations
    }

    if (gatewayUrls.length > 0 && spec && typeof spec === 'object') {
      if (spec.swagger === '2.0') {
        try {
          const firstGw = gatewayUrls[0];
          const urlObj = new URL(firstGw.url);
          spec.host = urlObj.host;
          spec.basePath =
            urlObj.pathname !== '/' ? urlObj.pathname : spec.basePath || '/';
          const schemes = new Set<string>();
          gatewayUrls.forEach(gw => {
            try {
              schemes.add(new URL(gw.url).protocol.replace(':', ''));
            } catch (e) {
              /* ignore */
            }
          });
          spec.schemes = Array.from(schemes);
        } catch (e) {
          /* ignore */
        }
      } else {
        // For OAS 3.x or other specs, override the servers array
        spec.servers = gatewayUrls.map(gw => ({
          url: gw.url,
          description: gw.description,
        }));
      }
    }

    if (spec && typeof spec === 'object' && !spec.paths) {
      spec.paths = {};
    }

    return spec;
  }, [
    definitionState.value,
    entity.metadata.name,
    entity.metadata.title,
    gatewayUrls,
    hasOperationsOnly,
    storedOpenApiSpec,
  ]);

  const isPlaceholder = useMemo(() => {
    const val = definitionState.value;
    return (
      typeof val === 'string' &&
      (val.includes('WSO2 API Document content placeholder') ||
        val.includes('WSO2 Discovered API'))
    );
  }, [definitionState.value]);

  return {
    details,
    definition: definitionState.value,
    isDefinitionLoading:
      definitionState.loading ||
      (isApiPlatformGateway && storedDefinitionState.loading),
    hasOperationsOnly,
    gatewayOperations,
    gatewayApiPolicies,
    formattedSource,
    gatewayUrls,
    isDeployed,
    swaggerSpec,
    isPlaceholder,
    isRevisionsLoading: revisionsState.loading,
    hasLiveOpenApiSpec: !!storedOpenApiSpec,
  };
};
