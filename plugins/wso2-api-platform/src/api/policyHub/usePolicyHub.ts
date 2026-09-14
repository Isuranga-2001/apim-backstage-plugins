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

import { useAsyncRetry } from 'react-use';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import {
  DEFAULT_POLICY_HUB_BASE_URL,
  getPolicyDefinition,
  listPolicies,
  listPolicyCategories,
  resolvePolicyHubVersion,
} from './policyHubClient';

/** Resolves the configured Policy Hub base URL, falling back to the default. */
export function usePolicyHubBaseUrl(): string {
  const configApi = useApi(configApiRef);
  return (
    configApi.getOptionalString('wso2ApiPlatform.policyHub.baseUrl') ??
    DEFAULT_POLICY_HUB_BASE_URL
  );
}

export function usePolicyHubPolicies(
  page: number,
  pageSize: number,
  categories: string[],
  enabled = true,
) {
  const baseUrl = usePolicyHubBaseUrl();
  const categoriesKey = categories.join(',');
  return useAsyncRetry(async () => {
    if (!enabled) return { policies: [], total: 0 };
    return listPolicies(baseUrl, page, pageSize, categories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, page, pageSize, categoriesKey, enabled]);
}

export function usePolicyHubCategories(enabled = true) {
  const baseUrl = usePolicyHubBaseUrl();
  return useAsyncRetry(async () => {
    if (!enabled) return [];
    return listPolicyCategories(baseUrl);
  }, [baseUrl, enabled]);
}

export function usePolicyDefinition(
  name?: string,
  version?: string,
  enabled = true,
) {
  const baseUrl = usePolicyHubBaseUrl();
  return useAsyncRetry(async () => {
    if (!enabled || !name || !version) return undefined;
    const resolvedVersion = await resolvePolicyHubVersion(
      baseUrl,
      name,
      version,
    );
    return getPolicyDefinition(baseUrl, name, resolvedVersion);
  }, [baseUrl, name, version, enabled]);
}
