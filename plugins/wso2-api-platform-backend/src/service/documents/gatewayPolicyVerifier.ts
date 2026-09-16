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

import { ConflictError } from '@backstage/errors';
import { LoggerService } from '@backstage/backend-plugin-api';
import { Wso2ApiPlatformClient } from '../client';
import { ApiRef } from './types';
import {
  fetchDiscoveredArtifact,
  resolvePlatformGateway,
} from './gatewayDefinitionVerifier';
import {
  RestApiArtifact,
  Wso2ApiPolicyArtifact,
  Wso2ApiPolicyDiff,
  diffPolicyArtifacts,
  mapPoliciesToRestApiArtifact,
} from './restApiArtifactMapper';

function isGatewayDiscovered(sourceKind: ApiRef['sourceKind']): boolean {
  return sourceKind === 'gateway';
}

/** Returns the policy diff when gateway writes are enabled. */
export async function previewGatewayPolicyUpdate(
  client: Wso2ApiPlatformClient,
  apiRef: Pick<ApiRef, 'sourceKind' | 'gatewayId' | 'apiId'>,
  input: Wso2ApiPolicyArtifact,
  logger: LoggerService,
): Promise<Wso2ApiPolicyDiff | undefined> {
  if (
    !isGatewayDiscovered(apiRef.sourceKind) ||
    !client.getConfig().platformGateway.enableWriteOperations
  ) {
    return undefined;
  }
  const gateway = resolvePlatformGateway(client, apiRef, logger);
  if (!gateway) {
    return undefined;
  }

  const previous = await fetchDiscoveredArtifact(client, gateway, apiRef.apiId);
  const next = mapPoliciesToRestApiArtifact(input, previous);
  return diffPolicyArtifacts(previous, next);
}

/** Pushes the merged policy and returns it. */
export async function applyGatewayPolicyUpdate(
  client: Wso2ApiPlatformClient,
  apiRef: Pick<ApiRef, 'sourceKind' | 'gatewayId' | 'apiId'>,
  input: Wso2ApiPolicyArtifact,
  logger: LoggerService,
): Promise<RestApiArtifact | undefined> {
  if (
    !isGatewayDiscovered(apiRef.sourceKind) ||
    !client.getConfig().platformGateway.enableWriteOperations
  ) {
    return undefined;
  }
  const gateway = resolvePlatformGateway(client, apiRef, logger);
  if (!gateway) {
    return undefined;
  }

  const previous = await fetchDiscoveredArtifact(client, gateway, apiRef.apiId);
  const next = mapPoliciesToRestApiArtifact(input, previous);

  try {
    await client.updateGatewayRestApi(
      gateway.managementApiUrl,
      apiRef.apiId,
      next,
      gateway.managementApiAuth,
    );
  } catch (e: any) {
    throw new ConflictError(
      `Failed to apply the policy update to the API Platform gateway for ` +
        `API '${apiRef.apiId}': ${e.message}`,
    );
  }

  return next;
}
