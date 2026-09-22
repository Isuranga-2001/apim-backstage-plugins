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

import { useEffect, useMemo, useState } from 'react';
import { Entity, getCompoundEntityRef } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { Wso2ApiPortalInfo, wso2ApiPlatformApiRef } from '../../../../api';

const UNAVAILABLE: Wso2ApiPortalInfo = {
  enabled: false,
  capabilities: {
    publish: false,
    reason: 'Failed to load the API Portal status.',
  },
  auth: { mode: 'platform-login' },
};

/** Fetches the API Portal enablement + publish capability for this entity. */
export function useApiPortalCapabilities(
  entity: Entity,
  enabled: boolean = true,
): {
  info: Wso2ApiPortalInfo | undefined;
  loading: boolean;
} {
  const wso2Api = useApi(wso2ApiPlatformApiRef);
  const entityRef = useMemo(() => getCompoundEntityRef(entity), [entity]);
  const [info, setInfo] = useState<Wso2ApiPortalInfo | undefined>(undefined);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setInfo(undefined);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    wso2Api
      .getApiPortalInfo(entityRef)
      .then(result => {
        if (!cancelled) {
          setInfo(result);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setInfo(
            e instanceof Error && e.message
              ? {
                  enabled: false,
                  capabilities: { publish: false, reason: e.message },
                  auth: { mode: 'platform-login' },
                }
              : UNAVAILABLE,
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [entityRef, wso2Api, enabled]);

  return { info, loading };
}
