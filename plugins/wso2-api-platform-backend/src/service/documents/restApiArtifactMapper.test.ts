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
  RestApiArtifact,
  Wso2ApiPolicyArtifact,
  adaptRawRestApiArtifact,
  diffPolicyArtifacts,
  diffRestApiArtifacts,
  mapDefinitionToRestApiArtifact,
  mapPoliciesToRestApiArtifact,
  normalizePolicyFlows,
  toPolicyArtifact,
} from './restApiArtifactMapper';

const PREVIOUS: RestApiArtifact = {
  apiVersion: 'gateway.api-platform.wso2.com/v1',
  kind: 'RestApi',
  metadata: { name: 'reading-list-api-v1.0' },
  spec: {
    displayName: 'Reading-List-API',
    version: 'v1.0',
    context: '/reading-list/$version',
    upstream: { main: { url: 'https://apis.example.com/reading-list/v1.0' } },
    policies: [{ name: 'cors', version: 'v1' }],
    operations: [
      { method: 'GET', path: '/books' },
      { method: 'POST', path: '/books' },
      {
        method: 'GET',
        path: '/books/{id}',
        policies: [{ name: 'set-headers', version: 'v1' }],
      },
      { method: 'PUT', path: '/books/{id}' },
      { method: 'DELETE', path: '/books/{id}' },
    ],
  },
};

const DEFINITION_SAME_SHAPE = `openapi: 3.0.0
info:
  title: Reading-List-API
  version: v1.0
paths:
  /books:
    get: {}
    post: {}
  /books/{bookId}:
    get: {}
    put: {}
    delete: {}
`;

describe('adaptRawRestApiArtifact', () => {
  it('strips the readOnly status field from a RestApi CR response', () => {
    const raw = {
      ...PREVIOUS,
      status: { id: 'reading-list-api-v1.0', state: 'deployed' },
    };
    expect(adaptRawRestApiArtifact(raw)).toEqual({
      apiVersion: PREVIOUS.apiVersion,
      kind: PREVIOUS.kind,
      metadata: PREVIOUS.metadata,
      spec: PREVIOUS.spec,
    });
  });

  it('returns undefined for a response that is not a RestApi resource', () => {
    expect(
      adaptRawRestApiArtifact({ status: 'success', api: {} }),
    ).toBeUndefined();
    expect(adaptRawRestApiArtifact(undefined)).toBeUndefined();
    expect(adaptRawRestApiArtifact({ kind: 'RestApi' })).toBeUndefined();
  });
});

describe('mapDefinitionToRestApiArtifact', () => {
  it('never touches metadata.name, apiVersion, kind, or non-derivable spec fields', () => {
    const next = mapDefinitionToRestApiArtifact(
      DEFINITION_SAME_SHAPE,
      PREVIOUS,
    );
    expect(next.metadata).toBe(PREVIOUS.metadata);
    expect(next.apiVersion).toBe(PREVIOUS.apiVersion);
    expect(next.kind).toBe(PREVIOUS.kind);
    expect(next.spec.context).toBe(PREVIOUS.spec.context);
    expect(next.spec.upstream).toBe(PREVIOUS.spec.upstream);
    expect(next.spec.policies).toBe(PREVIOUS.spec.policies);
  });

  it("preserves an existing operation's extra fields (e.g. policies) when only its path-param name changes", () => {
    const next = mapDefinitionToRestApiArtifact(
      DEFINITION_SAME_SHAPE,
      PREVIOUS,
    );
    const getById = next.spec.operations.find(
      op => op.method === 'GET' && op.path === '/books/{bookId}',
    );
    expect(getById).toEqual({
      method: 'GET',
      path: '/books/{bookId}',
      policies: [{ name: 'set-headers', version: 'v1' }],
    });
  });

  it('drops operations no longer present in the definition and adds new bare ones', () => {
    const definition = `openapi: 3.0.0
info:
  title: Reading-List-API
  version: v1.0
paths:
  /books:
    get: {}
  /authors:
    get: {}
`;
    const next = mapDefinitionToRestApiArtifact(definition, PREVIOUS);
    expect(next.spec.operations).toEqual([
      { method: 'GET', path: '/books' },
      { method: 'GET', path: '/authors' },
    ]);
  });

  it('updates displayName and version from info.title/info.version', () => {
    const definition = `openapi: 3.0.0
info:
  title: Renamed API
  version: v2.0
paths: {}
`;
    const next = mapDefinitionToRestApiArtifact(definition, PREVIOUS);
    expect(next.spec.displayName).toBe('Renamed API');
    expect(next.spec.version).toBe('v2.0');
  });
});

describe('diffRestApiArtifacts', () => {
  it('reports no changes for an artifact that only differs in path-param naming', () => {
    const next = mapDefinitionToRestApiArtifact(
      DEFINITION_SAME_SHAPE,
      PREVIOUS,
    );
    const diff = diffRestApiArtifacts(PREVIOUS, next);
    expect(diff).toEqual({
      displayNameChange: undefined,
      versionChange: undefined,
      addedOperations: [],
      removedOperations: [],
      hasChanges: false,
    });
  });

  it('reports added and removed operations', () => {
    const definition = `openapi: 3.0.0
info:
  title: Reading-List-API
  version: v1.0
paths:
  /books:
    get: {}
    post: {}
  /books/{id}:
    get: {}
    patch: {}
`;
    const next = mapDefinitionToRestApiArtifact(definition, PREVIOUS);
    const diff = diffRestApiArtifacts(PREVIOUS, next);
    expect(diff.hasChanges).toBe(true);
    expect(diff.addedOperations).toEqual([
      { method: 'PATCH', path: '/books/{id}' },
    ]);
    expect(diff.removedOperations).toEqual(
      expect.arrayContaining([
        { method: 'PUT', path: '/books/{id}' },
        { method: 'DELETE', path: '/books/{id}' },
      ]),
    );
  });

  it('reports title/version changes exactly, even when only formatting differs', () => {
    // Regression: a normalized comparison hid "Payment-API-Service" -> "Payment API Service".
    const onlyFormattingDiffers = mapDefinitionToRestApiArtifact(
      `openapi: 3.0.0
info:
  title: reading list api
  version: V1.0
paths:
  /books:
    get: {}
    post: {}
  /books/{id}:
    get: {}
    put: {}
    delete: {}
`,
      PREVIOUS,
    );
    const formattingDiff = diffRestApiArtifacts(
      PREVIOUS,
      onlyFormattingDiffers,
    );
    expect(formattingDiff.hasChanges).toBe(true);
    expect(formattingDiff.displayNameChange).toEqual({
      from: 'Reading-List-API',
      to: 'reading list api',
    });
    expect(formattingDiff.versionChange).toEqual({ from: 'v1.0', to: 'V1.0' });

    const renamed = mapDefinitionToRestApiArtifact(
      `openapi: 3.0.0
info:
  title: Totally Different API
  version: v9.9
paths: {}
`,
      PREVIOUS,
    );
    const diff = diffRestApiArtifacts(PREVIOUS, renamed);
    expect(diff.displayNameChange).toEqual({
      from: 'Reading-List-API',
      to: 'Totally Different API',
    });
    expect(diff.versionChange).toEqual({ from: 'v1.0', to: 'v9.9' });
  });

  it('reports no title/version change when the definition is identical', () => {
    const next = mapDefinitionToRestApiArtifact(
      DEFINITION_SAME_SHAPE,
      PREVIOUS,
    );
    const diff = diffRestApiArtifacts(PREVIOUS, next);
    expect(diff.displayNameChange).toBeUndefined();
    expect(diff.versionChange).toBeUndefined();
  });
});

describe('normalizePolicyFlows', () => {
  it('treats a flat array as the request flow only, isFlat: true', () => {
    const raw = [{ name: 'cors', version: 'v1' }];
    expect(normalizePolicyFlows(raw)).toEqual({
      flows: { request: raw, response: [], fault: [] },
      isFlat: true,
    });
  });

  it('passes through a {request,response,fault} object, isFlat: false', () => {
    const raw = {
      request: [{ name: 'cors', version: 'v1' }],
      response: [{ name: 'set-headers', version: 'v1' }],
      fault: [],
    };
    expect(normalizePolicyFlows(raw)).toEqual({ flows: raw, isFlat: false });
  });

  it('defaults missing flow keys on an object to empty arrays', () => {
    expect(
      normalizePolicyFlows({ request: [{ name: 'cors', version: 'v1' }] }),
    ).toEqual({
      flows: {
        request: [{ name: 'cors', version: 'v1' }],
        response: [],
        fault: [],
      },
      isFlat: false,
    });
  });

  it('treats null/undefined as flat — a RestApi has no object-shaped policies form, so a missing field must never be re-emitted as {request:[],response:[],fault:[]}', () => {
    expect(normalizePolicyFlows(undefined)).toEqual({
      flows: { request: [], response: [], fault: [] },
      isFlat: true,
    });
    expect(normalizePolicyFlows(null)).toEqual({
      flows: { request: [], response: [], fault: [] },
      isFlat: true,
    });
  });
});

describe('mapPoliciesToRestApiArtifact', () => {
  const PREVIOUS_WITH_POLICIES: RestApiArtifact = {
    ...PREVIOUS,
    spec: {
      ...PREVIOUS.spec,
      policies: [{ name: 'cors', version: 'v1' }],
      operations: [
        { method: 'GET', path: '/books' },
        {
          method: 'POST',
          path: '/books',
          policies: {
            request: [{ name: 'validate', version: 'v1' }],
            response: [],
            fault: [],
          },
        },
        {
          method: 'GET',
          path: '/books/{id}',
          policies: [{ name: 'set-headers', version: 'v1' }],
        },
      ],
    },
  };

  it("overwrites spec.policies and only the matched operations' policies, denormalized to each scope's own original shape", () => {
    const input: Wso2ApiPolicyArtifact = {
      apiPolicies: [{ name: 'cors', version: 'v2' }],
      operations: [
        {
          method: 'GET',
          path: '/books/{bookId}',
          policies: [{ name: 'set-headers', version: 'v2' }],
        },
      ],
    };

    const next = mapPoliciesToRestApiArtifact(input, PREVIOUS_WITH_POLICIES);

    expect(next.spec.policies).toEqual([{ name: 'cors', version: 'v2' }]);
    const updatedOp = next.spec.operations.find(
      op => op.method === 'GET' && op.path === '/books/{id}',
    );
    expect(updatedOp?.policies).toEqual([
      { name: 'set-headers', version: 'v2' },
    ]);
  });

  it('leaves operations absent from input.operations untouched (never clears their policies)', () => {
    const input: Wso2ApiPolicyArtifact = {
      apiPolicies: [{ name: 'cors', version: 'v1' }],
      operations: [],
    };

    const next = mapPoliciesToRestApiArtifact(input, PREVIOUS_WITH_POLICIES);

    expect(next.spec.operations).toEqual(
      PREVIOUS_WITH_POLICIES.spec.operations,
    );
  });

  it("does not add or remove operations, even if input.operations names one that isn't in previous", () => {
    const input: Wso2ApiPolicyArtifact = {
      apiPolicies: [],
      operations: [{ method: 'DELETE', path: '/books/{id}', policies: [] }],
    };

    const next = mapPoliciesToRestApiArtifact(input, PREVIOUS_WITH_POLICIES);

    expect(next.spec.operations).toHaveLength(
      PREVIOUS_WITH_POLICIES.spec.operations.length,
    );
  });

  it('never touches metadata, apiVersion, kind, or other non-policy spec fields', () => {
    const input: Wso2ApiPolicyArtifact = { apiPolicies: [], operations: [] };
    const next = mapPoliciesToRestApiArtifact(input, PREVIOUS_WITH_POLICIES);

    expect(next.metadata).toBe(PREVIOUS_WITH_POLICIES.metadata);
    expect(next.apiVersion).toBe(PREVIOUS_WITH_POLICIES.apiVersion);
    expect(next.kind).toBe(PREVIOUS_WITH_POLICIES.kind);
    expect(next.spec.displayName).toBe(PREVIOUS_WITH_POLICIES.spec.displayName);
    expect(next.spec.context).toBe(PREVIOUS_WITH_POLICIES.spec.context);
  });
});

describe('diffPolicyArtifacts', () => {
  const BASE: RestApiArtifact = {
    apiVersion: 'gateway.api-platform.wso2.com/v1',
    kind: 'RestApi',
    metadata: { name: 'reading-list-api-v1.0' },
    spec: {
      displayName: 'Reading-List-API',
      version: 'v1.0',
      policies: [{ name: 'cors', version: 'v1', params: { origin: '*' } }],
      operations: [
        {
          method: 'GET',
          path: '/books',
          policies: {
            request: [
              { name: 'rate-limit', version: 'v1', params: { count: 10 } },
            ],
            response: [],
            fault: [],
          },
        },
      ],
    },
  };

  it('reports no changes for identical artifacts', () => {
    const diff = diffPolicyArtifacts(BASE, BASE);
    expect(diff).toEqual({ apiLevel: [], operations: [], hasChanges: false });
  });

  it('detects added/removed/changed for a flat ("flag") scope, keyed by name@version', () => {
    const next: RestApiArtifact = {
      ...BASE,
      spec: {
        ...BASE.spec,
        policies: [
          {
            name: 'cors',
            version: 'v1',
            params: { origin: 'https://example.com' },
          },
          { name: 'logging', version: 'v1' },
        ],
      },
    };

    const diff = diffPolicyArtifacts(BASE, next);

    expect(diff.hasChanges).toBe(true);
    expect(diff.apiLevel).toEqual([
      {
        flow: 'flat',
        added: [{ name: 'logging', version: 'v1' }],
        removed: [],
        changed: [{ name: 'cors', version: 'v1' }],
      },
    ]);
  });

  it('detects added/removed for a flow-based (request/response/fault) scope, and reports per-operation diffs only for touched operations', () => {
    const next: RestApiArtifact = {
      ...BASE,
      spec: {
        ...BASE.spec,
        operations: [
          {
            method: 'GET',
            path: '/books',
            policies: {
              request: [],
              response: [{ name: 'cache', version: 'v1' }],
              fault: [],
            },
          },
        ],
      },
    };

    const diff = diffPolicyArtifacts(BASE, next);

    expect(diff.hasChanges).toBe(true);
    expect(diff.operations).toEqual([
      {
        method: 'GET',
        path: '/books',
        flows: [
          {
            flow: 'request',
            added: [],
            removed: [{ name: 'rate-limit', version: 'v1' }],
            changed: [],
          },
          {
            flow: 'response',
            added: [{ name: 'cache', version: 'v1' }],
            removed: [],
            changed: [],
          },
        ],
      },
    ]);
  });

  it('does not report changes when only params key-order differs (stable-stringify compare)', () => {
    const next: RestApiArtifact = {
      ...BASE,
      spec: {
        ...BASE.spec,
        policies: [{ name: 'cors', version: 'v1', params: { origin: '*' } }],
      },
    };
    const diff = diffPolicyArtifacts(BASE, next);
    expect(diff.hasChanges).toBe(false);
  });
});

describe('toPolicyArtifact', () => {
  it('extracts spec.policies and each operation method/path/policies', () => {
    const artifact: RestApiArtifact = {
      apiVersion: 'v1',
      kind: 'RestApi',
      metadata: { name: 'reading-list-api-v1.0' },
      spec: {
        displayName: 'Reading-List-API',
        version: 'v1.0',
        policies: [{ name: 'cors', version: 'v1' }],
        operations: [
          {
            method: 'GET',
            path: '/books',
            policies: [{ name: 'rate-limit', version: 'v1' }],
          },
        ],
      },
    };

    expect(toPolicyArtifact(artifact)).toEqual({
      apiPolicies: [{ name: 'cors', version: 'v1' }],
      operations: [
        {
          method: 'GET',
          path: '/books',
          policies: [{ name: 'rate-limit', version: 'v1' }],
        },
      ],
    });
  });
});

describe('mapPoliciesToRestApiArtifact (real gateway payload regression)', () => {
  // Exact `GET /rest-apis/{id}` response for an OpenChoreo-discovered API
  // that has both an API-level and an operation-level policy attached.
  const LIVE_PAYMENT_API: RestApiArtifact = {
    apiVersion: 'gateway.api-platform.wso2.com/v1alpha1',
    kind: 'RestApi',
    metadata: { name: 'payment-api-service-v1.0' },
    spec: {
      context: '/payments-api/$version',
      displayName: 'Payment API Service',
      operations: [
        {
          method: 'GET',
          path: '/payments',
          policies: [
            {
              name: 'basic-ratelimit',
              params: { limits: [{ duration: '1m', requests: 1 }] },
              version: 'v1',
            },
          ],
        },
        { method: 'POST', path: '/payments' },
        { method: 'GET', path: '/payments/{id}' },
        { method: 'PUT', path: '/payments/{id}' },
        { method: 'DELETE', path: '/payments/{id}' },
      ],
      policies: [
        {
          name: 'basic-ratelimit',
          params: { limits: [{ duration: '1m', requests: 5 }] },
          version: 'v1',
        },
      ],
      upstream: {
        main: {
          url: 'https://b34ce240-7c65-448b-992a-5e83a1f68c1d-prod.e1-us-east-azure.choreoapis.dev/default/payment-api-service/v1.0',
        },
      },
      version: '1.0.0',
      vhosts: { main: '*', sandbox: 'sandbox-*' },
    },
  };

  // The Policy Editor's wire-format request body after removing every
  // policy (api-level and the one operation-level policy).
  const REMOVE_ALL_POLICIES_INPUT: Wso2ApiPolicyArtifact = {
    apiPolicies: [],
    operations: [
      { method: 'GET', path: '/payments', policies: [] },
      {
        method: 'POST',
        path: '/payments',
        policies: { request: [], response: [], fault: [] },
      },
      {
        method: 'GET',
        path: '/payments/{id}',
        policies: { request: [], response: [], fault: [] },
      },
      {
        method: 'PUT',
        path: '/payments/{id}',
        policies: { request: [], response: [], fault: [] },
      },
      {
        method: 'DELETE',
        path: '/payments/{id}',
        policies: { request: [], response: [], fault: [] },
      },
    ],
  };

  it("coerces a Policy Hub-style full version (e.g. '1.0') to the gateway's required major-only 'vN' format", () => {
    const input: Wso2ApiPolicyArtifact = {
      apiPolicies: [
        { name: 'basic-ratelimit', version: '1.0', params: { limits: [] } },
        { name: 'basic-auth', version: '2.3.1', params: {} },
        { name: 'already-correct', version: 'v3', params: {} },
      ],
      operations: [],
    };

    const next = mapPoliciesToRestApiArtifact(input, LIVE_PAYMENT_API);

    expect(next.spec.policies).toEqual([
      { name: 'basic-ratelimit', version: 'v1', params: { limits: [] } },
      { name: 'basic-auth', version: 'v2', params: {} },
      { name: 'already-correct', version: 'v3', params: {} },
    ]);
  });

  it('produces a full RestApi CR — every field the gateway requires (kind, apiVersion, metadata.name, spec.displayName/version/context/upstream/operations) survives a policy-only edit', () => {
    const next = mapPoliciesToRestApiArtifact(
      REMOVE_ALL_POLICIES_INPUT,
      LIVE_PAYMENT_API,
    );

    expect(next.kind).toBe('RestApi');
    expect(next.apiVersion).toBe('gateway.api-platform.wso2.com/v1alpha1');
    expect(next.metadata).toEqual({ name: 'payment-api-service-v1.0' });
    expect(next.spec.displayName).toBe('Payment API Service');
    expect(next.spec.version).toBe('1.0.0');
    expect(next.spec.context).toBe('/payments-api/$version');
    expect(next.spec.upstream).toEqual(LIVE_PAYMENT_API.spec.upstream);
    expect(next.spec.vhosts).toEqual(LIVE_PAYMENT_API.spec.vhosts);
    expect(next.spec.operations).toHaveLength(5);

    // Policies are the only thing that actually changed.
    expect(next.spec.policies).toEqual([]);
    expect(next.spec.operations[0]).toEqual({
      method: 'GET',
      path: '/payments',
      policies: [],
    });

    // The other 4 operations never had a `policies` field at all in the
    // live artifact — the gateway rejects `{request:[],response:[],fault:[]}`
    // here (its schema only ever accepts a flat array for RestApi
    // policies), so removing/leaving-untouched must resolve to `[]`, not
    // the object shape the frontend's editor model would otherwise infer
    // for a field it's never seen.
    expect(next.spec.operations.slice(1)).toEqual([
      { method: 'POST', path: '/payments', policies: [] },
      { method: 'GET', path: '/payments/{id}', policies: [] },
      { method: 'PUT', path: '/payments/{id}', policies: [] },
      { method: 'DELETE', path: '/payments/{id}', policies: [] },
    ]);
  });
});
