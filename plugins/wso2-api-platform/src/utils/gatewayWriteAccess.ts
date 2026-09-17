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

import { ConfigApi } from '@backstage/core-plugin-api';

/** Master switch for gateway writes. */
export const GATEWAY_WRITE_OPERATIONS_ENABLED_DEFAULT = false;

const GATEWAY_WRITE_OPERATIONS_CONFIG_KEY =
  'wso2ApiPlatformGateway.enableWriteOperations';

/**
 * Full Sync Mode (direct gateway write operations) is intentionally locked
 * off for this initial release, regardless of what
 * `wso2ApiPlatformGateway.enableWriteOperations` is set to in config. Kept
 * in sync with the identical lock in the backend plugin
 * (`service/config.ts`'s `GATEWAY_WRITE_OPERATIONS_LOCKED`) — see that
 * file's comment for why: enabling this today would let any authenticated
 * Backstage user with valid gateway credentials change any API on the
 * gateway, since there is no per-API/per-team authorization model yet.
 *
 * To re-enable in a future release: add the authorization checks described
 * in the backend's comment, then set this back to `false` in both places.
 */
const GATEWAY_WRITE_OPERATIONS_LOCKED = true;

export function isGatewayWriteOperationsEnabled(configApi: ConfigApi): boolean {
  if (GATEWAY_WRITE_OPERATIONS_LOCKED) {
    return false;
  }
  return (
    configApi.getOptionalBoolean(GATEWAY_WRITE_OPERATIONS_CONFIG_KEY) ??
    GATEWAY_WRITE_OPERATIONS_ENABLED_DEFAULT
  );
}
