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

/** One `spec.operations[]` entry; extra fields are only ever carried over, never authored here. */
export type RestApiOperation = {
  method: string;
  path: string;
  [key: string]: unknown;
};

/** `RestAPIRequest` shape (`RestAPI` minus `status`) — the full-replace body `PUT /rest-apis/{id}` expects. */
export type RestApiArtifact = {
  apiVersion?: string;
  kind?: string;
  metadata: {
    name: string;
    [key: string]: unknown;
  };
  spec: {
    displayName: string;
    version: string;
    operations: RestApiOperation[];
    [key: string]: unknown;
  };
};

export type RestApiArtifactDiff = {
  displayNameChange?: { from: string; to: string };
  versionChange?: { from: string; to: string };
  addedOperations: Array<{ method: string; path: string }>;
  removedOperations: Array<{ method: string; path: string }>;
  hasChanges: boolean;
};

/** Adapts a raw `GET {discoveryUrl}/{apiId}` response into a `RestApiArtifact`, dropping the readOnly `status`. */
export function adaptRawRestApiArtifact(
  raw: unknown,
): RestApiArtifact | undefined {
  const data = raw as Record<string, any> | undefined;
  if (!data || data.kind !== 'RestApi' || !data.spec || !data.metadata?.name) {
    return undefined;
  }
  return {
    apiVersion: data.apiVersion,
    kind: data.kind,
    metadata: data.metadata,
    spec: data.spec,
  };
}

/** Case/whitespace/separator-insensitive string comparison (e.g. "Payment API" == "payment-api"). */
export function normalize(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

// Real HTTP methods only (no `trace`, which the gateway doesn't support).
const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
];

/** Normalizes a path for comparison: trims, lower-cases, drops a trailing slash, and blanks `{param}` names so `{id}` and `{bookId}` compare equal. */
export function normalizePath(path: string): string {
  return path
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '')
    .replace(/\{[^/{}]*\}/g, '{}');
}

export function operationKey(op: { method: string; path: string }): string {
  return `${op.method.trim().toUpperCase()} ${normalizePath(op.path)}`;
}

/** Parses an OpenAPI YAML/JSON definition's `info.title`, `info.version`, and operations (from `paths`). */
export function parseDefinitionInfo(content: string): {
  title?: string;
  version?: string;
  operations?: RestApiOperation[];
} {
  try {
    const doc = (yaml.load(content) as Record<string, any>) ?? {};
    const operations: RestApiOperation[] = [];
    const paths = doc?.paths ?? {};
    for (const path of Object.keys(paths)) {
      const pathItem = paths[path] ?? {};
      for (const method of HTTP_METHODS) {
        if (pathItem[method]) {
          operations.push({ method: method.toUpperCase(), path });
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

/** Maps a definition onto `previous`: only `displayName`/`version`/`operations` are derived; everything else carries over, since `PUT` is a full-replace. */
export function mapDefinitionToRestApiArtifact(
  content: string,
  previous: RestApiArtifact,
): RestApiArtifact {
  const { title, version, operations } = parseDefinitionInfo(content);

  const previousByKey = new Map(
    (previous.spec.operations ?? []).map(op => [operationKey(op), op]),
  );

  const nextOperations: RestApiOperation[] = (operations ?? []).map(op => {
    const existing = previousByKey.get(operationKey(op));
    return existing
      ? { ...existing, method: op.method, path: op.path }
      : { method: op.method, path: op.path };
  });

  return {
    apiVersion: previous.apiVersion,
    kind: previous.kind,
    metadata: previous.metadata,
    spec: {
      ...previous.spec,
      displayName: title ?? previous.spec.displayName,
      version: version ?? previous.spec.version,
      operations: nextOperations,
    },
  };
}

/** Reports what changed: `displayName`/`version` (exact — must match what's actually sent) and added/removed operations (via `operationKey`, ignoring path-param names). */
export function diffRestApiArtifacts(
  previous: RestApiArtifact,
  next: RestApiArtifact,
): RestApiArtifactDiff {
  const displayNameChange =
    previous.spec.displayName !== next.spec.displayName
      ? { from: previous.spec.displayName, to: next.spec.displayName }
      : undefined;
  const versionChange =
    previous.spec.version !== next.spec.version
      ? { from: previous.spec.version, to: next.spec.version }
      : undefined;

  const previousOperations = previous.spec.operations ?? [];
  const nextOperations = next.spec.operations ?? [];
  const previousKeys = new Set(previousOperations.map(operationKey));
  const nextKeys = new Set(nextOperations.map(operationKey));

  const addedOperations = nextOperations
    .filter(op => !previousKeys.has(operationKey(op)))
    .map(op => ({ method: op.method, path: op.path }));
  const removedOperations = previousOperations
    .filter(op => !nextKeys.has(operationKey(op)))
    .map(op => ({ method: op.method, path: op.path }));

  const hasChanges =
    !!displayNameChange ||
    !!versionChange ||
    addedOperations.length > 0 ||
    removedOperations.length > 0;

  return {
    displayNameChange,
    versionChange,
    addedOperations,
    removedOperations,
    hasChanges,
  };
}
