import { EditableModel } from '../../hooks/usePolicyEditorModel';
import { buildPolicyArtifact, hasLocalChanges } from './policyArtifact';
import { ApiPolicy, FlowPolicies } from './policyModel';

const emptyFlows = (): FlowPolicies => ({
  request: [],
  response: [],
  fault: [],
});

const policy = (name: string): ApiPolicy => ({ name, version: '1' });

describe('buildPolicyArtifact', () => {
  it('serializes flat api-level policies and per-operation policies', () => {
    const apiFlows: FlowPolicies = {
      ...emptyFlows(),
      request: [policy('cors')],
    };
    const operations = [
      {
        method: 'GET',
        path: '/books',
        isFlat: false,
        flows: { ...emptyFlows(), request: [policy('rate-limiting')] },
      },
    ];

    expect(buildPolicyArtifact(apiFlows, true, operations)).toEqual({
      apiPolicies: [{ name: 'cors', version: '1', params: undefined }],
      operations: [
        {
          method: 'GET',
          path: '/books',
          policies: {
            request: [
              { name: 'rate-limiting', version: '1', params: undefined },
            ],
            response: [],
            fault: [],
          },
        },
      ],
    });
  });
});

describe('hasLocalChanges', () => {
  const initialModel: EditableModel = {
    apiFlows: { ...emptyFlows(), request: [policy('cors')] },
    apiIsFlat: true,
    operations: [
      {
        method: 'GET',
        path: '/books',
        isFlat: true,
        flows: { ...emptyFlows(), request: [policy('rate-limiting')] },
      },
    ],
  };

  it('is false when nothing changed', () => {
    expect(
      hasLocalChanges(
        initialModel,
        initialModel.apiFlows,
        initialModel.operations,
      ),
    ).toBe(false);
  });

  it('is true when an api-level policy is added', () => {
    const apiFlows = {
      ...initialModel.apiFlows,
      request: [policy('cors'), policy('new')],
    };
    expect(
      hasLocalChanges(initialModel, apiFlows, initialModel.operations),
    ).toBe(true);
  });

  it('is true when an operation policy is removed', () => {
    const operations = [{ ...initialModel.operations[0], flows: emptyFlows() }];
    expect(
      hasLocalChanges(initialModel, initialModel.apiFlows, operations),
    ).toBe(true);
  });
});
