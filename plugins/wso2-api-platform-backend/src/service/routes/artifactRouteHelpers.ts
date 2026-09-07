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

import {
  BackstageCredentials,
  BackstageUserPrincipal,
  LoggerService,
} from '@backstage/backend-plugin-api';
import { NotImplementedError } from '@backstage/errors';
import type { CatalogService } from '@backstage/plugin-catalog-node';
import { Actor } from '../documents/types';

export function actorFor(
  credentials: BackstageCredentials<BackstageUserPrincipal>,
): Actor {
  return { userEntityRef: credentials.principal.userEntityRef };
}

export function assertEnabled(enabled: boolean, message: string): void {
  if (!enabled) {
    throw new NotImplementedError(message);
  }
}

export async function refreshCatalogEntityAdvisory(
  catalog: CatalogService,
  entityRef: string,
  credentials: BackstageCredentials,
  logger: LoggerService,
): Promise<void> {
  try {
    await catalog.refreshEntity(entityRef, { credentials });
  } catch (e) {
    logger.debug(
      `Catalog refresh after artifact mutation is advisory; ignored: ${e}`,
    );
  }
}
