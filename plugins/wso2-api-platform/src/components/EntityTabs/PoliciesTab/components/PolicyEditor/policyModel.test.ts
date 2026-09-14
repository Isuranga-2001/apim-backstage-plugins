import {
  normalizeFlowPolicies,
  reorderPolicies,
  scopeId,
  toApiPolicy,
} from './policyModel';

describe('toApiPolicy', () => {
  it('normalizes annotation-style field names', () => {
    expect(
      toApiPolicy({ policyName: 'foo', policyVersion: '1.0.0', parameters: { a: 1 } }),
    ).toEqual({ name: 'foo', version: '1.0.0', params: { a: 1 } });
  });

  it('normalizes flat name/version/params field names', () => {
    expect(toApiPolicy({ name: 'bar', version: '2.0.0', params: { b: 2 } })).toEqual({
      name: 'bar',
      version: '2.0.0',
      params: { b: 2 },
    });
  });

  it('falls back to Unknown/N/A when fields are missing', () => {
    expect(toApiPolicy({})).toEqual({ name: 'Unknown', version: 'N/A', params: undefined });
  });
});

describe('normalizeFlowPolicies', () => {
  it('treats a flat array as the request flow and marks isFlat', () => {
    const { flows, isFlat } = normalizeFlowPolicies([{ name: 'a', version: '1' }]);
    expect(isFlat).toBe(true);
    expect(flows.request).toEqual([{ name: 'a', version: '1', params: undefined }]);
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

  it('handles missing/empty input', () => {
    expect(normalizeFlowPolicies(undefined)).toEqual({
      flows: { request: [], response: [], fault: [] },
      isFlat: false,
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
    expect(reorderPolicies(policies, 0, 2).map(p => p.name)).toEqual(['b', 'c', 'a']);
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
    expect(scopeId({ kind: 'operation', index: 2, flow: 'fault' })).toBe('op-2-fault');
  });
});
