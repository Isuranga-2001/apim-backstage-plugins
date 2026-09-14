/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react';
import { usePolicyEditorModel } from './usePolicyEditorModel';

describe('usePolicyEditorModel', () => {
  it('normalizes a flat gatewayApiPolicies array as the request flow', () => {
    const { result } = renderHook(() =>
      usePolicyEditorModel({
        gatewayApiPolicies: [{ policyName: 'cors', policyVersion: '1.0.0' }],
        gatewayOperations: [],
      }),
    );
    expect(result.current.initialModel.apiIsFlat).toBe(true);
    expect(result.current.initialModel.apiFlows.request).toEqual([
      { name: 'cors', version: '1.0.0', params: undefined },
    ]);
    expect(result.current.initialModel.apiFlows.response).toEqual([]);
  });

  it('passes through a {request,response,fault}-shaped gatewayApiPolicies object', () => {
    const { result } = renderHook(() =>
      usePolicyEditorModel({
        gatewayApiPolicies: {
          request: [{ name: 'a', version: '1' }],
          response: [{ name: 'b', version: '1' }],
        },
        gatewayOperations: [],
      }),
    );
    expect(result.current.initialModel.apiIsFlat).toBe(false);
    expect(result.current.initialModel.apiFlows.request).toHaveLength(1);
    expect(result.current.initialModel.apiFlows.response).toHaveLength(1);
  });

  it('falls back to details when gateway data is absent', () => {
    const { result } = renderHook(() =>
      usePolicyEditorModel({
        details: {
          apiPolicies: [{ name: 'a', version: '1' }],
          operations: [{ method: 'GET', path: '/foo', policies: [] }],
        },
        gatewayOperations: [],
        gatewayApiPolicies: {},
      }),
    );
    expect(result.current.initialModel.apiFlows.request).toHaveLength(1);
    expect(result.current.initialModel.operations).toHaveLength(1);
    expect(result.current.initialModel.operations[0].method).toBe('GET');
    expect(result.current.initialModel.operations[0].path).toBe('/foo');
  });

  it('normalizes operations using verb/target and operationPolicies field variants', () => {
    const { result } = renderHook(() =>
      usePolicyEditorModel({
        gatewayOperations: [
          {
            verb: 'post',
            target: '/orders',
            operationPolicies: { request: [{ name: 'rl', version: '1' }] },
          },
        ],
        gatewayApiPolicies: {},
      }),
    );
    const [op] = result.current.initialModel.operations;
    expect(op.method).toBe('POST');
    expect(op.path).toBe('/orders');
    expect(op.flows.request).toHaveLength(1);
    expect(op.isFlat).toBe(false);
  });
});
