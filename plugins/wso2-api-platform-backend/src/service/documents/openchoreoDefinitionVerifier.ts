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

import * as yaml from 'js-yaml';
import { ConflictError } from '@backstage/errors';
import { LoggerService } from '@backstage/backend-plugin-api';
import { Wso2ApiPlatformClient } from '../client';
import { ApiRef } from './types';

/** An operation as reported by the gateway's `spec.operations`, or parsed from a definition's `paths`. */
export type DiscoveredOperation = {
  method: string;
  path: string;
};

/**
 * Normalized shape of a `GET {discoveryUrl}/{apiId}` ("/rest-apis/{id}")
 * response, regardless of whether the gateway returned the legacy
 * `{status:'success', api:{...}}` wrapper or a raw gateway-controller 1.2.x
 * `RestApi` custom resource.
 */
export type DiscoveredGatewayApi = {
  id?: string;
  displayName?: string;
  version?: string;
  context?: string;
  operations?: DiscoveredOperation[];
};

function normalizeOperations(raw: unknown): DiscoveredOperation[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const operations = raw
    .map((op: any) => ({ method: op?.method, path: op?.path }))
    .filter(
      (op): op is DiscoveredOperation =>
        typeof op.method === 'string' && typeof op.path === 'string',
    );
  return operations.length > 0 ? operations : undefined;
}

/**
 * Adapts a raw gateway API detail response into a normalized shape. Mirrors
 * the adaptation done for catalog discovery in
 * `catalog-backend-module-wso2-api-platform`'s `gatewayUtils.ts`, which is
 * not part of that package's public surface.
 */
export function adaptDiscoveredGatewayApi(
  raw: unknown,
): DiscoveredGatewayApi | undefined {
  const data = raw as Record<string, any> | undefined;
  if (!data) {
    return undefined;
  }
  if (data.status === 'success' && data.api) {
    const api = data.api;
    return {
      id: api.id,
      displayName: api.displayName ?? api.name,
      version: api.version,
      context: api.context,
      operations: normalizeOperations(api.operations),
    };
  }
  if (data.kind === 'RestApi' && data.spec) {
    return {
      id: data.status?.id ?? data.metadata?.name,
      displayName: data.spec.displayName ?? data.metadata?.name,
      version: data.spec.version,
      context: data.spec.context,
      operations: normalizeOperations(data.spec.operations),
    };
  }
  return undefined;
}

function normalize(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

// OpenAPI path-item keys that are actual HTTP methods, as opposed to
// sibling keys like `parameters`, `summary`, `description`, `$ref`, etc.
const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
];

/** Normalizes a path for comparison: trims, lower-cases, collapses a trailing slash, and blanks out `{param}` names so `{id}` and `{bookId}` are treated the same. */
function normalizePath(path: string): string {
  return path
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '')
    .replace(/\{[^/{}]*\}/g, '{}');
}

function operationKey(op: DiscoveredOperation): string {
  return `${op.method.trim().toUpperCase()} ${normalizePath(op.path)}`;
}

function parseDefinitionInfo(content: string): {
  title?: string;
  version?: string;
  operations?: DiscoveredOperation[];
} {
  try {
    const doc = (yaml.load(content) as Record<string, any>) ?? {};
    const operations: DiscoveredOperation[] = [];
    const paths = doc?.paths ?? {};
    for (const path of Object.keys(paths)) {
      const pathItem = paths[path] ?? {};
      for (const method of HTTP_METHODS) {
        if (pathItem[method]) {
          operations.push({ method, path });
        }
      }
    }
    return {
      title: doc?.info?.title,
      version: doc?.info?.version,
      operations: operations.length > 0 ? operations : undefined,
    };
  } catch {
    return {};
  }
}

function formatOperationList(ops: DiscoveredOperation[], limit = 5): string {
  const shown = ops.slice(0, limit).map(operationKey).join(', ');
  const more = ops.length > limit ? `, and ${ops.length - limit} more` : '';
  return `${shown}${more}`;
}

/**
 * Compares an uploaded OpenAPI definition's `info.title`, `info.version`,
 * and operations (method + path, parsed from `paths`) against the API
 * discovered from the gateway (`displayName`, `version`, `spec.operations`).
 * This is a best-effort identity check (not a full spec diff): its purpose
 * is to catch a definition uploaded for the wrong API, not to validate spec
 * content in general.
 */
export function definitionMatchesDiscoveredApi(
  content: string,
  discovered: DiscoveredGatewayApi,
): { matches: boolean; reason?: string } {
  const { title, version, operations } = parseDefinitionInfo(content);

  if (!title && !version) {
    return {
      matches: false,
      reason:
        'the uploaded file does not look like a valid OpenAPI definition ' +
        '(missing info.title/info.version)',
    };
  }

  const titleMatches = normalize(title) === normalize(discovered.displayName);
  const versionMatches =
    !discovered.version || normalize(version) === normalize(discovered.version);

  if (!titleMatches || !versionMatches) {
    return {
      matches: false,
      reason:
        `definition info.title/info.version ("${title ?? ''}", ` +
        `version ${version ?? 'unknown'}) does not match the discovered ` +
        `API "${discovered.displayName ?? discovered.id ?? ''}" ` +
        `(version ${discovered.version ?? 'unknown'})`,
    };
  }

  if (discovered.operations && discovered.operations.length > 0) {
    if (!operations || operations.length === 0) {
      return {
        matches: false,
        reason:
          'the uploaded definition has no operations under "paths", but the ' +
          `discovered API exposes ${discovered.operations.length} ` +
          `operation(s) (${formatOperationList(discovered.operations)})`,
      };
    }

    const discoveredKeys = new Set(discovered.operations.map(operationKey));
    const definitionKeys = new Set(operations.map(operationKey));

    const missing = discovered.operations.filter(
      op => !definitionKeys.has(operationKey(op)),
    );
    const extra = operations.filter(
      op => !discoveredKeys.has(operationKey(op)),
    );

    if (missing.length > 0 || extra.length > 0) {
      const parts: string[] = [];
      if (missing.length > 0) {
        parts.push(
          `missing from the definition: ${formatOperationList(missing)}`,
        );
      }
      if (extra.length > 0) {
        parts.push(
          `not present on the discovered API: ${formatOperationList(extra)}`,
        );
      }
      return {
        matches: false,
        reason: `definition operations do not match the discovered API (${parts.join(
          '; ',
        )})`,
      };
    }
  }

  return { matches: true };
}

/**
 * For an API discovered via an OpenChoreo gateway, re-fetches the API from
 * `{discoveryUrl}/{apiId}` (the same endpoint catalog discovery uses, e.g.
 * `http://localhost:9095/rest-apis/{id}`) and throws a `ConflictError` if
 * the uploaded definition does not appear to describe that same API.
 *
 * No-op for any `apiRef.sourceKind` other than `'openchoreo'`.
 *
 * Fails open (logs a warning and allows the upload) when the gateway isn't
 * configured for verification, since that's a deployment gap rather than a
 * problem with this specific upload. Fails closed (throws) when the gateway
 * is reachable-in-principle but the request itself fails, or when the
 * content doesn't match, since letting an unverified definition through
 * defeats the point of the check.
 */
export async function assertMatchesDiscoveredOpenChoreoApi(
  client: Wso2ApiPlatformClient,
  apiRef: Pick<ApiRef, 'sourceKind' | 'gatewayId' | 'apiId'>,
  content: string,
  logger: LoggerService,
): Promise<void> {
  if (apiRef.sourceKind !== 'openchoreo') {
    return;
  }

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
    return;
  }

  let raw: unknown;
  try {
    raw = await client.getGatewayApiDetail(
      gateway.discoveryUrl,
      apiRef.apiId,
      gateway.discoveryAuth,
    );
  } catch (e: any) {
    throw new ConflictError(
      `Could not verify the uploaded definition against the discovered ` +
        `OpenChoreo API '${apiRef.apiId}' at ` +
        `${gateway.discoveryUrl}/${apiRef.apiId}: ${e.message}`,
    );
  }

  const discovered = adaptDiscoveredGatewayApi(raw);
  if (!discovered) {
    throw new ConflictError(
      `Received an unrecognized response from the OpenChoreo gateway for ` +
        `API '${apiRef.apiId}'; cannot verify the uploaded definition.`,
    );
  }

  const result = definitionMatchesDiscoveredApi(content, discovered);
  if (!result.matches) {
    throw new ConflictError(
      `Uploaded definition does not match the discovered OpenChoreo API: ${result.reason}.`,
    );
  }
}
