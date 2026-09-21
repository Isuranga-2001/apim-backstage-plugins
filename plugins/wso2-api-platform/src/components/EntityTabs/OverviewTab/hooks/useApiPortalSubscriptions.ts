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
import { wso2ApiPlatformApiRef } from '../../../../api';

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Loads and toggles this API's selected API Portal subscription plans; each toggle saves immediately. */
export function useApiPortalSubscriptions(entity: Entity) {
  const wso2Api = useApi(wso2ApiPlatformApiRef);
  const entityRef = useMemo(() => getCompoundEntityRef(entity), [entity]);

  const [availableCustomPlanIds, setAvailableCustomPlanIds] = useState<
    string[]
  >([]);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    wso2Api
      .getApiPortalSubscriptions(entityRef)
      .then(result => {
        if (!cancelled) {
          setAvailableCustomPlanIds(result.availableCustomPlanIds);
          setSelectedPlanIds(result.selectedPlanIds);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(messageOf(e));
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
  }, [entityRef, wso2Api]);

  const toggle = async (planId: string) => {
    const nextSelection = selectedPlanIds.includes(planId)
      ? selectedPlanIds.filter(id => id !== planId)
      : [...selectedPlanIds, planId];

    setSaving(true);
    setError(null);
    try {
      const result = await wso2Api.updateApiPortalSubscriptions(
        entityRef,
        nextSelection,
      );
      setSelectedPlanIds(result.selectedPlanIds);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setSaving(false);
    }
  };

  return {
    availableCustomPlanIds,
    selectedPlanIds,
    loading,
    saving,
    error,
    toggle,
  };
}
