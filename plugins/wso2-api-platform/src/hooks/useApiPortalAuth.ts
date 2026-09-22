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
import {
  createApiRef,
  OAuthApi,
  useApiHolder,
} from '@backstage/core-plugin-api';
import { Wso2ApiPortalAuthConfig } from '../api';

export type ApiPortalAuthState =
  // Today's paste-a-token dialog. `error` is set only when an idp strategy
  // was configured but couldn't be resolved, so the dialog can fall back
  // to the manual field instead of dead-ending.
  | { mode: 'manual'; error?: string }
  // The backend holds its own API Portal identity; no token is sent at all.
  | { mode: 'service-account' }
  // reuse-signin: the frontend fetches the token itself.
  | { mode: 'auto'; getToken: () => Promise<string> };

/** Resolves how the Publish dialog should obtain an API Portal access token. */
export function useApiPortalAuth(
  config: Wso2ApiPortalAuthConfig,
): ApiPortalAuthState {
  const apiHolder = useApiHolder();

  return useMemo<ApiPortalAuthState>(() => {
    if (!config.strategy || config.strategy === 'manual') {
      return { mode: 'manual' };
    }
    if (config.strategy === 'service-account') {
      return { mode: 'service-account' };
    }

    const providerConfig = config.reuseSignIn;
    if (!providerConfig?.providerId) {
      return {
        mode: 'manual',
        error: 'apiPortal.auth.idp.reuseSignIn.providerId is not configured',
      };
    }

    // Backstage's ApiHolder resolves an ApiRef by its `id` string, so an
    // already-registered provider can be looked up by the id named in
    // config, without a compile-time import of it.
    const authApiRef = createApiRef<OAuthApi>({
      id: providerConfig.providerId,
    });
    const authApi = apiHolder.get(authApiRef);
    if (!authApi) {
      return {
        mode: 'manual',
        error: `apiPortal.auth.idp.reuseSignIn.providerId '${providerConfig.providerId}' is not a registered Backstage auth provider`,
      };
    }

    return {
      mode: 'auto',
      getToken: () => authApi.getAccessToken(providerConfig.scopes),
    };
  }, [apiHolder, config]);
}
