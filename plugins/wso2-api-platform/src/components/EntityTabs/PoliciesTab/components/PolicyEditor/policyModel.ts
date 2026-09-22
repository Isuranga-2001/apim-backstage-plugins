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

export type PolicyFlow = 'request' | 'response' | 'fault';

export const POLICY_FLOWS: PolicyFlow[] = ['request', 'response', 'fault'];

export type ApiPolicy = {
  name: string;
  version: string;
  params?: Record<string, unknown>;
  raw?: Record<string, unknown>;
};

export type FlowPolicies = {
  request: ApiPolicy[];
  response: ApiPolicy[];
  fault: ApiPolicy[];
};

export type PolicyScope =
  | { kind: 'api'; flow: PolicyFlow }
  | { kind: 'operation'; index: number; flow: PolicyFlow };

export const scopeId = (scope: PolicyScope): string =>
  scope.kind === 'api'
    ? `api-${scope.flow}`
    : `op-${scope.index}-${scope.flow}`;

/** Normalizes a raw policy entry (from annotations or a gateway definition,
 * which use varying field names) into the flat `ApiPolicy` shape. */
export function toApiPolicy(raw: any): ApiPolicy {
  return {
    name: raw?.policyName || raw?.name || 'Unknown',
    version: raw?.policyVersion || raw?.version || 'N/A',
    params: raw?.parameters || raw?.params || undefined,
    raw: raw && typeof raw === 'object' ? raw : undefined,
  };
}

/** Inverse of `normalizeFlowPolicies`: turns edited `FlowPolicies` back into
 * the raw shape the backend expects, respecting the scope's original
 * flat-vs-object shape and preserving any fields this editor doesn't model. */
export function denormalizeFlowPolicies(
  flows: FlowPolicies,
  isFlat: boolean,
): unknown {
  const toRaw = (p: ApiPolicy) => ({
    ...(p.raw ?? {}),
    name: p.name,
    version: p.version,
    params: p.params,
  });
  if (isFlat) {
    return flows.request.map(toRaw);
  }
  return {
    request: flows.request.map(toRaw),
    response: flows.response.map(toRaw),
    fault: flows.fault.map(toRaw),
  };
}

/**
 * Normalizes a raw policies value into `{request,response,fault}` flow
 * arrays. Mirrors the flat-array vs `{request,response,fault}`-object
 * handling already established in `PublisherPoliciesList.tsx`.
 *
 * A gateway (OpenChoreo) `RestApi`'s policies are *always* a flat array —
 * an operation that has never had a policy attached has no `policies` field
 * at all, never an empty `{request,response,fault}` object. So a
 * missing/`null`/`undefined` value must normalize to flat (isFlat: true),
 * not fall through to the object shape — otherwise saving re-serializes an
 * untouched operation as `{request:[],response:[],fault:[]}`, which the
 * gateway rejects as an invalid `policies` shape.
 */
export function normalizeFlowPolicies(raw: any): {
  flows: FlowPolicies;
  isFlat: boolean;
} {
  if (raw === null || raw === undefined || Array.isArray(raw)) {
    return {
      flows: {
        request: ((raw as any[]) ?? []).map(toApiPolicy),
        response: [],
        fault: [],
      },
      isFlat: true,
    };
  }
  return {
    flows: {
      request: (raw.request || []).map(toApiPolicy),
      response: (raw.response || []).map(toApiPolicy),
      fault: (raw.fault || []).map(toApiPolicy),
    },
    isFlat: false,
  };
}

export function formatPolicyVersion(version: string): string {
  return /^v\d/i.test(version) ? version : `v${version}`;
}

/** Moves the item at `from` to `to`, returning a new array. */
export function reorderPolicies(
  policies: ApiPolicy[],
  from: number,
  to: number,
): ApiPolicy[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= policies.length ||
    to >= policies.length
  ) {
    return policies;
  }
  const next = [...policies];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
