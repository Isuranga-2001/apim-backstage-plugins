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
    description?: string;
    operations: RestApiOperation[];
    [key: string]: unknown;
  };
};

export type RestApiArtifactDiff = {
  displayNameChange?: { from: string; to: string };
  versionChange?: { from: string; to: string };
  descriptionChange?: { from: string; to: string };
  addedOperations: Array<{ method: string; path: string }>;
  removedOperations: Array<{ method: string; path: string }>;
  hasChanges: boolean;
};

/** Adapts a raw `GET {managementApiUrl}/{apiId}` response into a `RestApiArtifact`, dropping the readOnly `status`. */
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
  description?: string;
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
      description: doc?.info?.description,
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
  const { title, version, description, operations } =
    parseDefinitionInfo(content);

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
      ...(description !== undefined ? { description } : {}),
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
  const descriptionChange =
    previous.spec.description !== next.spec.description
      ? {
          from: previous.spec.description ?? '',
          to: next.spec.description ?? '',
        }
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
    !!descriptionChange ||
    addedOperations.length > 0 ||
    removedOperations.length > 0;

  return {
    displayNameChange,
    versionChange,
    descriptionChange,
    addedOperations,
    removedOperations,
    hasChanges,
  };
}

/** Wire shape for the Policy Editor: `spec.policies` plus each operation's own `policies`. */
export type Wso2ApiPolicyArtifact = {
  apiPolicies: unknown;
  operations: Array<{ method: string; path: string; policies: unknown }>;
};

export type PolicyChangeRef = { name: string; version: string };

export type PolicyFlowDiff = {
  flow: 'request' | 'response' | 'fault' | 'flat';
  added: PolicyChangeRef[];
  removed: PolicyChangeRef[];
  changed: PolicyChangeRef[];
};

export type Wso2ApiPolicyDiff = {
  apiLevel: PolicyFlowDiff[];
  operations: Array<{ method: string; path: string; flows: PolicyFlowDiff[] }>;
  hasChanges: boolean;
};

type NormalizedPolicyFlows = {
  request: unknown[];
  response: unknown[];
  fault: unknown[];
};

/**
 * Flat array (a "flat" scope) vs `{request,response,fault}` object (a
 * flow-aware scope) — mirrors the frontend's `normalizeFlowPolicies`.
 *
 * A `RestApi` resource's `policies` (both `spec.policies` and each
 * operation's `policies`) is *always* a flat array per the gateway
 * controller's schema — the `{request,response,fault}` object form doesn't
 * exist for this resource type at all (it belongs to the separate,
 * APIM-Publisher-style `apiPolicies` concept used by the read-only policy
 * view). So a missing/`undefined` `policies` field — an operation that has
 * never had a policy attached — must normalize to flat, not to the object
 * shape; treating it as "object" would re-serialize it as
 * `{request:[],response:[],fault:[]}` on save, which the gateway rejects.
 */
export function normalizePolicyFlows(raw: unknown): {
  flows: NormalizedPolicyFlows;
  isFlat: boolean;
} {
  if (raw == null || Array.isArray(raw)) {
    return {
      flows: { request: raw ?? [], response: [], fault: [] },
      isFlat: true,
    };
  }
  const source = raw as Record<string, any>;
  return {
    flows: {
      request: Array.isArray(source.request) ? source.request : [],
      response: Array.isArray(source.response) ? source.response : [],
      fault: Array.isArray(source.fault) ? source.fault : [],
    },
    isFlat: false,
  };
}

/** Re-emits normalized flow arrays back into a flat array or `{request,response,fault}` object, matching the original scope's shape. */
function denormalizePolicyFlows(
  flows: NormalizedPolicyFlows,
  isFlat: boolean,
): unknown {
  return isFlat
    ? flows.request
    : { request: flows.request, response: flows.response, fault: flows.fault };
}

function toGatewayPolicyVersion(version: string): string {
  const match = /^v?(\d+)/.exec(version.trim());
  return match ? `v${match[1]}` : version;
}

function normalizePolicyEntryVersion(entry: unknown): unknown {
  if (!entry || typeof entry !== 'object') {
    return entry;
  }
  const item = entry as Record<string, unknown>;
  if (typeof item.version !== 'string') {
    return entry;
  }
  const version = toGatewayPolicyVersion(item.version);
  return version === item.version ? entry : { ...item, version };
}

function normalizeFlowsVersions(
  flows: NormalizedPolicyFlows,
): NormalizedPolicyFlows {
  return {
    request: flows.request.map(normalizePolicyEntryVersion),
    response: flows.response.map(normalizePolicyEntryVersion),
    fault: flows.fault.map(normalizePolicyEntryVersion),
  };
}

/** A single policy entry's identity/config, tolerant of either the gateway's `name`/`version`/`params` fields or the legacy `policyName`/`policyVersion`/`parameters` naming. */
function policyIdentity(raw: unknown): {
  name: string;
  version: string;
  params: unknown;
} {
  const p = (raw as Record<string, any>) ?? {};
  return {
    name: p.name ?? p.policyName ?? 'Unknown',
    version: p.version ?? p.policyVersion ?? 'N/A',
    params: p.params ?? p.parameters,
  };
}

function policyKey(raw: unknown): string {
  const { name, version } = policyIdentity(raw);
  return `${name}@${version}`;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {} as Record<string, unknown>);
  }
  return value;
}

/** Order-insensitive, key-sorted comparison so two params objects that differ only in key order compare equal. */
function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

/** Maps the Policy Editor's edited artifact onto `previous`: only `spec.policies` and each matched operation's `policies` are derived; everything else (including operations present in `previous` but absent from `input`) carries over untouched, since `PUT` is a full-replace. */
export function mapPoliciesToRestApiArtifact(
  input: Wso2ApiPolicyArtifact,
  previous: RestApiArtifact,
): RestApiArtifact {
  const { isFlat: apiIsFlat } = normalizePolicyFlows(previous.spec.policies);
  const { flows: nextApiFlows } = normalizePolicyFlows(input.apiPolicies);
  const nextApiPolicies = denormalizePolicyFlows(
    normalizeFlowsVersions(nextApiFlows),
    apiIsFlat,
  );

  const inputOperationsByKey = new Map(
    input.operations.map(op => [operationKey(op), op]),
  );

  const nextOperations = (previous.spec.operations ?? []).map(op => {
    const match = inputOperationsByKey.get(operationKey(op));
    if (!match) {
      return op;
    }
    const { isFlat: opIsFlat } = normalizePolicyFlows(op.policies);
    const { flows: nextOpFlows } = normalizePolicyFlows(match.policies);
    return {
      ...op,
      policies: denormalizePolicyFlows(
        normalizeFlowsVersions(nextOpFlows),
        opIsFlat,
      ),
    };
  });

  return {
    apiVersion: previous.apiVersion,
    kind: previous.kind,
    metadata: previous.metadata,
    spec: {
      ...previous.spec,
      policies: nextApiPolicies,
      operations: nextOperations,
    },
  };
}

/** Diffs one flow-aware scope (a "flat" policies array, or a `{request,response,fault}` object) between `previous`/`next`, keyed by `${name}@${version}`. */
function diffPolicyScope(
  previousRaw: unknown,
  nextRaw: unknown,
): PolicyFlowDiff[] {
  const { flows: previousFlows, isFlat } = normalizePolicyFlows(previousRaw);
  const { flows: nextFlows } = normalizePolicyFlows(nextRaw);

  const diffOneFlow = (
    flow: PolicyFlowDiff['flow'],
    previousItems: unknown[],
    nextItems: unknown[],
  ): PolicyFlowDiff | undefined => {
    const previousByKey = new Map(previousItems.map(p => [policyKey(p), p]));
    const nextByKey = new Map(nextItems.map(p => [policyKey(p), p]));

    const refOf = (raw: unknown): PolicyChangeRef => {
      const { name, version } = policyIdentity(raw);
      return { name, version };
    };

    const added: PolicyChangeRef[] = [];
    const removed: PolicyChangeRef[] = [];
    const changed: PolicyChangeRef[] = [];

    for (const [key, item] of nextByKey) {
      if (!previousByKey.has(key)) {
        added.push(refOf(item));
      }
    }
    for (const [key, item] of previousByKey) {
      const nextItem = nextByKey.get(key);
      if (!nextItem) {
        removed.push(refOf(item));
      } else if (
        stableStringify(policyIdentity(item).params) !==
        stableStringify(policyIdentity(nextItem).params)
      ) {
        changed.push(refOf(item));
      }
    }

    if (added.length === 0 && removed.length === 0 && changed.length === 0) {
      return undefined;
    }
    return { flow, added, removed, changed };
  };

  if (isFlat) {
    const diff = diffOneFlow('flat', previousFlows.request, nextFlows.request);
    return diff ? [diff] : [];
  }

  return (['request', 'response', 'fault'] as const)
    .map(flow => diffOneFlow(flow, previousFlows[flow], nextFlows[flow]))
    .filter((d): d is PolicyFlowDiff => !!d);
}

/** Reports added/removed/changed policies at API level and per-operation, keyed by `${name}@${version}` within each flow. Only non-empty flows/operations are included. */
export function diffPolicyArtifacts(
  previous: RestApiArtifact,
  next: RestApiArtifact,
): Wso2ApiPolicyDiff {
  const apiLevel = diffPolicyScope(previous.spec.policies, next.spec.policies);

  const previousOperationsByKey = new Map(
    (previous.spec.operations ?? []).map(op => [operationKey(op), op]),
  );

  const operations: Wso2ApiPolicyDiff['operations'] = [];
  for (const nextOp of next.spec.operations ?? []) {
    const previousOp = previousOperationsByKey.get(operationKey(nextOp));
    const flows = diffPolicyScope(
      (previousOp as any)?.policies,
      (nextOp as any).policies,
    );
    if (flows.length > 0) {
      operations.push({ method: nextOp.method, path: nextOp.path, flows });
    }
  }

  const hasChanges = apiLevel.length > 0 || operations.length > 0;
  return { apiLevel, operations, hasChanges };
}

/** Small mapper for the GET route: pulls just the policy-relevant fields out of a full `RestApiArtifact`. */
export function toPolicyArtifact(
  artifact: RestApiArtifact,
): Wso2ApiPolicyArtifact {
  return {
    apiPolicies: artifact.spec.policies,
    operations: (artifact.spec.operations ?? []).map(op => ({
      method: op.method,
      path: op.path,
      policies: (op as any).policies,
    })),
  };
}
