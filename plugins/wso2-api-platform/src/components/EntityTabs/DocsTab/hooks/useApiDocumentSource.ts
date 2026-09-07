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

import { Entity } from '@backstage/catalog-model';
import { configApiRef, useApi } from '@backstage/core-plugin-api';

export type ApiDocumentSourceMode = 'store' | 'annotation' | 'unsupported';

const DISCOVERY_TYPE_ANNOTATION = 'wso2.com/api-discovery-type';
const PLATFORM_GATEWAY_ENDPOINTS_ANNOTATION =
  'wso2.com/platform-gateway-endpoints';
const GATEWAY_API_ENDPOINTS_ANNOTATION = 'wso2-gateway.com/api-endpoints';

/**
 * Decides which Docs tab data source an entity should use:
 * - 'store': self-hosted/OpenChoreo gateway APIs, backed by this plugin's
 *   own document store (unless disabled via wso2ApiPlatform.storage.enabled).
 * - 'annotation': on-prem APIM APIs — existing path, unchanged.
 * - 'unsupported': neither (also covers storage.enabled=false), renders
 *   today's "Documents unavailable" empty state.
 */
export function useApiDocumentSource(entity: Entity): {
  mode: ApiDocumentSourceMode;
} {
  const configApi = useApi(configApiRef);
  const annotations = entity.metadata.annotations ?? {};
  const discoveryType = annotations[DISCOVERY_TYPE_ANNOTATION];
  const isGatewayDiscovered =
    discoveryType === 'self-hosted-gateway' ||
    discoveryType === 'openchoreo-gateway';

  if (isGatewayDiscovered) {
    const storageEnabled =
      configApi.getOptionalBoolean('wso2ApiPlatform.storage.enabled') ?? true;
    return { mode: storageEnabled ? 'store' : 'unsupported' };
  }

  const isApiPlatform = !!annotations[PLATFORM_GATEWAY_ENDPOINTS_ANNOTATION];
  const isLegacyGatewayFlag = !!annotations[GATEWAY_API_ENDPOINTS_ANNOTATION];
  if (isApiPlatform || isLegacyGatewayFlag) {
    return { mode: 'unsupported' };
  }

  return { mode: 'annotation' };
}
