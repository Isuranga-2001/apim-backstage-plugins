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

import { ConflictError, InputError } from '@backstage/errors';
import { LoggerService } from '@backstage/backend-plugin-api';
import { Wso2ApiPlatformClient } from '../client';
import { ApiRef } from './types';
import {
  RestApiArtifact,
  RestApiArtifactDiff,
  adaptRawRestApiArtifact,
  diffRestApiArtifacts,
  mapDefinitionToRestApiArtifact,
  normalize,
  parseDefinitionInfo,
} from './restApiArtifactMapper';

type OpenChoreoGateway = {
  discoveryUrl: string;
  discoveryAuth?: string;
};

/** Resolves the configured OpenChoreo gateway, or undefined (fail open) if none has a discovery URL. */
function resolveOpenChoreoGateway(
  client: Wso2ApiPlatformClient,
  apiRef: Pick<ApiRef, 'gatewayId' | 'apiId'>,
  logger: LoggerService,
): OpenChoreoGateway | undefined {
  const gateway = client
    .getConfig()
    .selfHostedGateways.find(
      gw => gw.name === apiRef.gatewayId && gw.integration === 'openchoreo',
    );

  if (!gateway?.discoveryUrl) {
    logger.warn(
      `[OpenChoreo-Verify] No discovery URL configured for gateway ` +
        `'${apiRef.gatewayId}'; skipping definition verification for API ` +
        `'${apiRef.apiId}'.`,
    );
    return undefined;
  }
  return {
    discoveryUrl: gateway.discoveryUrl,
    discoveryAuth: gateway.discoveryAuth,
  };
}

/** Fetches and adapts the currently-discovered API into a `RestApiArtifact`. Fails closed on any error. */
async function fetchDiscoveredArtifact(
  client: Wso2ApiPlatformClient,
  gateway: OpenChoreoGateway,
  apiId: string,
): Promise<RestApiArtifact> {
  let raw: unknown;
  try {
    raw = await client.getGatewayApiDetail(
      gateway.discoveryUrl,
      apiId,
      gateway.discoveryAuth,
    );
  } catch (e: any) {
    throw new ConflictError(
      `Could not reach the OpenChoreo gateway to verify API '${apiId}' at ` +
        `${gateway.discoveryUrl}/${apiId}: ${e.message}`,
    );
  }

  const artifact = adaptRawRestApiArtifact(raw);
  if (!artifact) {
    throw new ConflictError(
      `Received an unrecognized response from the OpenChoreo gateway for ` +
        `API '${apiId}'; cannot verify or apply the uploaded definition.`,
    );
  }
  return artifact;
}

function assertLooksLikeOpenApi(content: string) {
  const { title, operations } = parseDefinitionInfo(content);
  if (!title && (!operations || operations.length === 0)) {
    throw new InputError(
      'The uploaded file does not look like a valid OpenAPI definition ' +
        '(missing info.title and no operations under "paths").',
    );
  }
}

function formatOperations(
  ops: Array<{ method: string; path: string }>,
  limit = 5,
): string {
  const shown = ops
    .slice(0, limit)
    .map(op => `${op.method} ${op.path}`)
    .join(', ');
  const more = ops.length > limit ? `, and ${ops.length - limit} more` : '';
  return `${shown}${more}`;
}

/** Builds the ADD-gate's rejection message from a fuzzy title/version mismatch, not `diff`'s exact one (see below). */
function describeMismatch(args: {
  titleMismatch?: { from: string; to: string };
  versionMismatch?: { from: string; to: string };
  addedOperations: RestApiArtifactDiff['addedOperations'];
  removedOperations: RestApiArtifactDiff['removedOperations'];
}): string {
  const parts: string[] = [];
  if (args.titleMismatch) {
    parts.push(
      `title "${args.titleMismatch.to}" does not match the discovered ` +
        `API's title "${args.titleMismatch.from}"`,
    );
  }
  if (args.versionMismatch) {
    parts.push(
      `version "${args.versionMismatch.to}" does not match the discovered ` +
        `API's version "${args.versionMismatch.from}"`,
    );
  }
  if (args.addedOperations.length > 0) {
    parts.push(
      `operations not present on the discovered API: ` +
        formatOperations(args.addedOperations),
    );
  }
  if (args.removedOperations.length > 0) {
    parts.push(
      `operations missing from the definition: ` +
        formatOperations(args.removedOperations),
    );
  }
  return parts.join('; ');
}

/** ADD-time gate: rejects a new definition unless it matches the live gateway state. Only for `sourceKind === 'openchoreo'`. */
export async function assertMatchesDiscoveredOpenChoreoApi(
  client: Wso2ApiPlatformClient,
  apiRef: Pick<ApiRef, 'sourceKind' | 'gatewayId' | 'apiId'>,
  content: string,
  logger: LoggerService,
): Promise<void> {
  if (apiRef.sourceKind !== 'openchoreo') {
    return;
  }
  const gateway = resolveOpenChoreoGateway(client, apiRef, logger);
  if (!gateway) {
    return;
  }

  assertLooksLikeOpenApi(content);
  const previous = await fetchDiscoveredArtifact(client, gateway, apiRef.apiId);
  const next = mapDefinitionToRestApiArtifact(content, previous);
  const diff = diffRestApiArtifacts(previous, next);

  // Loosely compared: this gate should catch a wholly different API, not formatting differences.
  const titleMismatch =
    normalize(previous.spec.displayName) !== normalize(next.spec.displayName)
      ? { from: previous.spec.displayName, to: next.spec.displayName }
      : undefined;
  const versionMismatch =
    normalize(previous.spec.version) !== normalize(next.spec.version)
      ? { from: previous.spec.version, to: next.spec.version }
      : undefined;

  if (
    titleMismatch ||
    versionMismatch ||
    diff.addedOperations.length > 0 ||
    diff.removedOperations.length > 0
  ) {
    throw new ConflictError(
      `Uploaded definition does not match the discovered OpenChoreo API: ${describeMismatch(
        {
          titleMismatch,
          versionMismatch,
          addedOperations: diff.addedOperations,
          removedOperations: diff.removedOperations,
        },
      )}.`,
    );
  }
}

/** UPDATE preview: returns the diff instead of rejecting on a mismatch, for the frontend's confirm step. */
export async function previewOpenChoreoDefinitionUpdate(
  client: Wso2ApiPlatformClient,
  apiRef: Pick<ApiRef, 'sourceKind' | 'gatewayId' | 'apiId'>,
  content: string,
  logger: LoggerService,
): Promise<RestApiArtifactDiff | undefined> {
  if (apiRef.sourceKind !== 'openchoreo') {
    return undefined;
  }
  const gateway = resolveOpenChoreoGateway(client, apiRef, logger);
  if (!gateway) {
    return undefined;
  }

  assertLooksLikeOpenApi(content);
  const previous = await fetchDiscoveredArtifact(client, gateway, apiRef.apiId);
  const next = mapDefinitionToRestApiArtifact(content, previous);
  return diffRestApiArtifacts(previous, next);
}

/** UPDATE commit: re-fetches fresh and pushes the mapped artifact via `PUT {discoveryUrl}/{apiId}`. */
export async function applyOpenChoreoDefinitionUpdate(
  client: Wso2ApiPlatformClient,
  apiRef: Pick<ApiRef, 'sourceKind' | 'gatewayId' | 'apiId'>,
  content: string,
  logger: LoggerService,
): Promise<void> {
  if (apiRef.sourceKind !== 'openchoreo') {
    return;
  }
  const gateway = resolveOpenChoreoGateway(client, apiRef, logger);
  if (!gateway) {
    return;
  }

  assertLooksLikeOpenApi(content);
  const previous = await fetchDiscoveredArtifact(client, gateway, apiRef.apiId);
  const next = mapDefinitionToRestApiArtifact(content, previous);

  try {
    await client.updateGatewayRestApi(
      gateway.discoveryUrl,
      apiRef.apiId,
      next,
      gateway.discoveryAuth,
    );
  } catch (e: any) {
    throw new ConflictError(
      `Failed to apply the definition update to the OpenChoreo gateway for ` +
        `API '${apiRef.apiId}': ${e.message}`,
    );
  }
}
