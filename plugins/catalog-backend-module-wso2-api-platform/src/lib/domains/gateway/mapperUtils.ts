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
import { normalizeEntityName, resolveApiType } from '../api';

/**
 * Maps an API discovered directly from a gateway to a Backstage ApiEntity.
 */
export function mapDiscoveredApiToEntity(api: any): ApiEntity {
  const spec = api.fullConfig.spec;
  const displayName = spec.displayName;
  const normalizedName = normalizeEntityName(displayName);
  const discoveryNamespace = 'wso2-gateways';
  const isOpenChoreo = api.integration === 'openchoreo';
  const gatewayLabel = isOpenChoreo ? 'OpenChoreo' : 'Self Hosted';
  const discoveryType = isOpenChoreo
    ? 'openchoreo-gateway'
    : 'self-hosted-gateway';

  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'API',
    metadata: {
      name: normalizedName,
      namespace: discoveryNamespace,
      title: displayName,
      ...(api.description ? { description: api.description } : {}),
      annotations: {
        'backstage.io/managed-by-location': `wso2-gateway:${api.environmentName}`,
        'backstage.io/managed-by-origin-location': `wso2-gateway:${api.environmentName}`,
        'wso2-gateway.com/api-id': api.id,
        'wso2-gateway.com/api-name': displayName,
        'wso2-gateway.com/api-version': spec.version || '1.0.0',
        'wso2-gateway.com/api-context': spec.context || '/',
        'wso2.com/api-type': resolveApiType(api, spec),
        'wso2.com/api-gateway': gatewayLabel,
        'wso2.com/api-discovery-type': discoveryType,
        'wso2-gateway.com/api-endpoints': JSON.stringify([
          {
            environmentName: api.environmentName,
            environmentType: api.environmentType || 'WSO2',
            gatewayType: gatewayLabel,
            urls: (api.gatewayUrls || []).map((u: string) => {
              const base = u.replace(/\/$/, '');
              const ctx = spec.context?.startsWith('/')
                ? spec.context
                : `/${spec.context || '/'}`;
              return `${base}${ctx.replace(/\/$/, '')}`;
            }),
          },
        ]),
      },
      tags: [`gateway-${normalizeEntityName(api.environmentName)}`],
    },
    spec: {
      type: resolveApiType(api, spec),
      lifecycle: 'production',
      owner: 'wso2',
      definition: api.fetchedSwagger || '',
    },
  } as ApiEntity;
}
