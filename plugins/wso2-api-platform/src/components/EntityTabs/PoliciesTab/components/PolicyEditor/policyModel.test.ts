import {
  denormalizeFlowPolicies,
  normalizeFlowPolicies,
  reorderPolicies,
  scopeId,
  toApiPolicy,
} from './policyModel';

describe('toApiPolicy', () => {
  it('normalizes annotation-style field names', () => {
    const raw = {
      policyName: 'foo',
      policyVersion: '1.0.0',
      parameters: { a: 1 },
    };
    expect(toApiPolicy(raw)).toEqual({
      name: 'foo',
      version: '1.0.0',
      params: { a: 1 },
      raw,
    });
  });

  it('normalizes flat name/version/params field names', () => {
    const raw = { name: 'bar', version: '2.0.0', params: { b: 2 } };
    expect(toApiPolicy(raw)).toEqual({
      name: 'bar',
      version: '2.0.0',
      params: { b: 2 },
      raw,
    });
  });

  it('falls back to Unknown/N/A when fields are missing', () => {
    expect(toApiPolicy({})).toEqual({
      name: 'Unknown',
      version: 'N/A',
      params: undefined,
      raw: {},
    });
  });
});

describe('normalizeFlowPolicies', () => {
  it('treats a flat array as the request flow and marks isFlat', () => {
    const { flows, isFlat } = normalizeFlowPolicies([
      { name: 'a', version: '1' },
    ]);
    expect(isFlat).toBe(true);
    expect(flows.request).toEqual([
      {
        name: 'a',
        version: '1',
        params: undefined,
        raw: { name: 'a', version: '1' },
      },
    ]);
    expect(flows.response).toEqual([]);
    expect(flows.fault).toEqual([]);
  });

  it('passes through a {request,response,fault}-shaped object', () => {
    const { flows, isFlat } = normalizeFlowPolicies({
      request: [{ name: 'a', version: '1' }],
      response: [{ name: 'b', version: '2' }],
      fault: [],
    });
    expect(isFlat).toBe(false);
    expect(flows.request).toHaveLength(1);
    expect(flows.response).toHaveLength(1);
    expect(flows.fault).toHaveLength(0);
  });

  it('treats missing input as flat (a gateway RestApi has no object-shaped policies form)', () => {
    expect(normalizeFlowPolicies(undefined)).toEqual({
      flows: { request: [], response: [], fault: [] },
      isFlat: true,
    });
    expect(normalizeFlowPolicies(null)).toEqual({
      flows: { request: [], response: [], fault: [] },
      isFlat: true,
    });
  });
});

describe('reorderPolicies', () => {
  const policies = [
    { name: 'a', version: '1' },
    { name: 'b', version: '1' },
    { name: 'c', version: '1' },
  ];

  it('moves an item from one index to another', () => {
    expect(reorderPolicies(policies, 0, 2).map(p => p.name)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });

  it('is a no-op for out-of-range indices', () => {
    expect(reorderPolicies(policies, 0, 10)).toBe(policies);
    expect(reorderPolicies(policies, -1, 1)).toBe(policies);
  });

  it('is a no-op when from === to', () => {
    expect(reorderPolicies(policies, 1, 1)).toBe(policies);
  });
});

describe('scopeId', () => {
  it('builds a stable id per scope+flow', () => {
    expect(scopeId({ kind: 'api', flow: 'request' })).toBe('api-request');
    expect(scopeId({ kind: 'operation', index: 2, flow: 'fault' })).toBe(
      'op-2-fault',
    );
  });
});

describe('denormalizeFlowPolicies', () => {
  it('serializes a flat scope back to a plain array', () => {
    const { flows } = normalizeFlowPolicies([{ name: 'a', version: '1' }]);
    expect(denormalizeFlowPolicies(flows, true)).toEqual([
      { name: 'a', version: '1', params: undefined },
    ]);
  });

  it('serializes a non-flat scope back to a {request,response,fault} object', () => {
    const { flows } = normalizeFlowPolicies({
      request: [{ name: 'a', version: '1' }],
      response: [{ name: 'b', version: '2' }],
      fault: [],
    });
    expect(denormalizeFlowPolicies(flows, false)).toEqual({
      request: [{ name: 'a', version: '1', params: undefined }],
      response: [{ name: 'b', version: '2', params: undefined }],
      fault: [],
    });
  });

  it('preserves unmodeled fields carried on the original raw entry', () => {
    const { flows } = normalizeFlowPolicies([
      { name: 'a', version: '1', executionCondition: 'always' },
    ]);
    expect(denormalizeFlowPolicies(flows, true)).toEqual([
      {
        name: 'a',
        version: '1',
        params: undefined,
        executionCondition: 'always',
      },
    ]);
  });
});
