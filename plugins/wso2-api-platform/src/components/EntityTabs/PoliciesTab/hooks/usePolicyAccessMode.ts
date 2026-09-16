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
import { useGatewayStatus } from '../../../common/useGatewayStatus';
import { isGatewayWriteOperationsEnabled } from '../../../../utils/gatewayWriteAccess';

const DISCOVERY_TYPE_ANNOTATION = 'wso2.com/api-discovery-type';

export type PolicyAccessMode = 'editable' | 'read-only';

export type PolicyAccessInfo = {
  mode: PolicyAccessMode;
  editingDisabledReason?: string;
  /** Whether this API was discovered from a gateway. */
  isGatewayDiscovered: boolean;
};

/** Returns the Policies tab access mode. */
export function usePolicyAccessMode(entity: Entity): PolicyAccessInfo {
  const configApi = useApi(configApiRef);
  const gatewayStatus = useGatewayStatus(entity);

  const annotations = entity.metadata.annotations ?? {};
  const discoveryType = annotations[DISCOVERY_TYPE_ANNOTATION];
  const isGatewayDiscovered = discoveryType === 'api-platform-gateway';

  const storageEnabled =
    configApi.getOptionalBoolean('wso2ApiPlatform.storage.enabled') ?? true;
  const writeOperationsEnabled = isGatewayWriteOperationsEnabled(configApi);

  const mode: PolicyAccessMode =
    isGatewayDiscovered && storageEnabled && writeOperationsEnabled
      ? 'editable'
      : 'read-only';

  const editingDisabledReason =
    mode === 'editable' && gatewayStatus.applicable && !gatewayStatus.active
      ? 'Gateway is currently inactive'
      : undefined;

  return { mode, editingDisabledReason, isGatewayDiscovered };
}
