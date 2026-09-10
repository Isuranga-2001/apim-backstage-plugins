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

import { useEffect, useState } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { wso2ApiPlatformApiRef } from '../../api';

const DISCOVERY_TYPE_ANNOTATION = 'wso2.com/api-discovery-type';
const GATEWAY_API_ENDPOINTS_ANNOTATION = 'wso2-gateway.com/api-endpoints';
const POLL_INTERVAL_MS = 15000;

function extractOpenChoreoGatewayId(
  entity: Entity | undefined,
): string | undefined {
  const annotations = entity?.metadata.annotations ?? {};
  if (annotations[DISCOVERY_TYPE_ANNOTATION] !== 'openchoreo-gateway') {
    return undefined;
  }
  try {
    const endpoints = JSON.parse(
      annotations[GATEWAY_API_ENDPOINTS_ANNOTATION] ?? '[]',
    );
    return Array.isArray(endpoints) ? endpoints[0]?.environmentName : undefined;
  } catch {
    return undefined;
  }
}

export type GatewayStatus = {
  /** Whether gateway status applies to this entity. */
  applicable: boolean;
  active: boolean;
};

/** Polls the entity gateway's active status. */
export function useGatewayStatus(entity: Entity | undefined): GatewayStatus {
  const wso2Api = useApi(wso2ApiPlatformApiRef);
  const gatewayId = extractOpenChoreoGatewayId(entity);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!gatewayId) {
      return undefined;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const gateways = await wso2Api.getGateways();
        const match = gateways.find(gw => gw.name === gatewayId);
        if (!cancelled) {
          setActive(!!match?.active);
        }
      } catch {
        if (!cancelled) {
          setActive(false);
        }
      }
    };
    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [gatewayId, wso2Api]);

  if (!gatewayId) {
    return { applicable: false, active: true };
  }
  return { applicable: true, active };
}
