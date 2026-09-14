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
      {
        name: 'cors',
        version: '1.0.0',
        params: undefined,
        raw: { policyName: 'cors', policyVersion: '1.0.0' },
      },
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
        gatewayApiPolicies: undefined,
      }),
    );
    expect(result.current.initialModel.apiFlows.request).toHaveLength(1);
    expect(result.current.initialModel.operations).toHaveLength(1);
    expect(result.current.initialModel.operations[0].method).toBe('GET');
    expect(result.current.initialModel.operations[0].path).toBe('/foo');
  });

  it('treats an operation with no policies field at all as flat, not as an empty {request,response,fault} object', () => {
    // A gateway RestApi operation that has never had a policy attached
    // simply omits `policies` — it must normalize to an empty flat array,
    // never the object shape, or saving re-serializes it as
    // {request:[],response:[],fault:[]}, which the gateway rejects.
    const { result } = renderHook(() =>
      usePolicyEditorModel({
        gatewayOperations: [{ method: 'POST', path: '/payments' }],
        gatewayApiPolicies: [],
      }),
    );
    const [op] = result.current.initialModel.operations;
    expect(op.isFlat).toBe(true);
    expect(op.flows.request).toEqual([]);
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
