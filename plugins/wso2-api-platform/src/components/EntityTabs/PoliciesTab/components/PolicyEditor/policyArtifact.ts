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

import { Wso2ApiPolicyArtifact } from '../../../../../api';
import {
  EditableModel,
  EditableOperation,
} from '../../hooks/usePolicyEditorModel';
import {
  ApiPolicy,
  FlowPolicies,
  POLICY_FLOWS,
  denormalizeFlowPolicies,
} from './policyModel';

/** Builds the wire-shape artifact from the editor's current local state. */
export function buildPolicyArtifact(
  apiFlows: FlowPolicies,
  apiIsFlat: boolean,
  operations: EditableOperation[],
): Wso2ApiPolicyArtifact {
  return {
    apiPolicies: denormalizeFlowPolicies(apiFlows, apiIsFlat),
    operations: operations.map(op => ({
      method: op.method,
      path: op.path,
      policies: denormalizeFlowPolicies(op.flows, op.isFlat),
    })),
  };
}

function policiesEqual(a: ApiPolicy[], b: ApiPolicy[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (p, i) =>
      p.name === b[i].name &&
      p.version === b[i].version &&
      JSON.stringify(p.params ?? {}) === JSON.stringify(b[i].params ?? {}),
  );
}

function flowPoliciesEqual(a: FlowPolicies, b: FlowPolicies): boolean {
  return POLICY_FLOWS.every(flow => policiesEqual(a[flow], b[flow]));
}

/** Order-sensitive structural comparison, used to drive the Save button
 * without a network call. */
export function hasLocalChanges(
  initialModel: EditableModel,
  currentApiFlows: FlowPolicies,
  currentOperations: EditableOperation[],
): boolean {
  if (!flowPoliciesEqual(initialModel.apiFlows, currentApiFlows)) return true;
  if (initialModel.operations.length !== currentOperations.length) return true;
  return initialModel.operations.some(
    (op, i) => !flowPoliciesEqual(op.flows, currentOperations[i].flows),
  );
}
