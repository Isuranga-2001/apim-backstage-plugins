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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Entity, getCompoundEntityRef } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import {
  Wso2ApiDefinition,
  Wso2ApiDefinitionCapabilities,
  wso2ApiPlatformApiRef,
} from '../../../../api';
import { ApiDefinitionSourceMode } from './useApiDefinitionSource';

const PLACEHOLDER = 'WSO2 API Document content placeholder';

const NO_WRITE_CAPABILITIES: Wso2ApiDefinitionCapabilities = {
  read: false,
  write: false,
};

export const useApiDefinition = (
  entity: Entity,
  mode: ApiDefinitionSourceMode,
) => {
  const wso2Api = useApi(wso2ApiPlatformApiRef);
  const entityRef = useMemo(() => getCompoundEntityRef(entity), [entity]);

  const [storeDefinition, setStoreDefinition] =
    useState<Wso2ApiDefinition | null>(null);
  const [storeCapabilities, setStoreCapabilities] =
    useState<Wso2ApiDefinitionCapabilities>(NO_WRITE_CAPABILITIES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  const fetchStoreDefinition = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const res = await wso2Api.getDefinition(entityRef);
      setStoreDefinition(res.definition);
      setStoreCapabilities(res.capabilities);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [wso2Api, entityRef]);

  useEffect(() => {
    if (mode === 'store') {
      fetchStoreDefinition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, entityRef.kind, entityRef.namespace, entityRef.name]);

  if (mode === 'store') {
    return {
      definition: storeDefinition,
      capabilities: storeCapabilities,
      loading,
      error,
      refresh: fetchStoreDefinition,
    };
  }

  if (mode === 'unsupported') {
    return {
      definition: null,
      capabilities: NO_WRITE_CAPABILITIES,
      loading: false,
      error: undefined,
      refresh: () => {},
    };
  }

  const definitionStr = entity.spec?.definition as string | undefined;
  const definition: Wso2ApiDefinition | null =
    definitionStr && definitionStr !== PLACEHOLDER
      ? { content: definitionStr, format: 'YAML' }
      : null;

  return {
    definition,
    capabilities: { read: true, write: false },
    loading: false,
    error: undefined,
    refresh: () => {},
  };
};
