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
  resolveOpenChoreoGateway,
} from './openchoreoDefinitionVerifier';
import {
  RestApiArtifact,
  Wso2ApiPolicyArtifact,
  Wso2ApiPolicyDiff,
  diffPolicyArtifacts,
  mapPoliciesToRestApiArtifact,
} from './restApiArtifactMapper';

/** UPDATE preview: returns the diff for the frontend's confirm step. No ADD-time gate exists here — policies only ever edit an already-discovered API. */
export async function previewOpenChoreoPolicyUpdate(
  client: Wso2ApiPlatformClient,
  apiRef: Pick<ApiRef, 'sourceKind' | 'gatewayId' | 'apiId'>,
  input: Wso2ApiPolicyArtifact,
  logger: LoggerService,
): Promise<Wso2ApiPolicyDiff | undefined> {
  if (apiRef.sourceKind !== 'openchoreo') {
    return undefined;
  }
  const gateway = resolveOpenChoreoGateway(client, apiRef, logger);
  if (!gateway) {
    return undefined;
  }

  const previous = await fetchDiscoveredArtifact(client, gateway, apiRef.apiId);
  const next = mapPoliciesToRestApiArtifact(input, previous);
  return diffPolicyArtifacts(previous, next);
}

/** UPDATE commit: re-fetches fresh and pushes the merged artifact via `PUT {managementApiUrl}/{apiId}`, returning it so the route can respond without a second gateway round-trip. */
export async function applyOpenChoreoPolicyUpdate(
  client: Wso2ApiPlatformClient,
  apiRef: Pick<ApiRef, 'sourceKind' | 'gatewayId' | 'apiId'>,
  input: Wso2ApiPolicyArtifact,
  logger: LoggerService,
): Promise<RestApiArtifact | undefined> {
  if (apiRef.sourceKind !== 'openchoreo') {
    return undefined;
  }
  const gateway = resolveOpenChoreoGateway(client, apiRef, logger);
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
      `Failed to apply the policy update to the OpenChoreo gateway for ` +
        `API '${apiRef.apiId}': ${e.message}`,
    );
  }

  return next;
}
