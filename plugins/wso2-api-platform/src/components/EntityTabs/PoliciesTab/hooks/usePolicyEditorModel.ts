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

import { useMemo } from 'react';
import {
  FlowPolicies,
  normalizeFlowPolicies,
} from '../components/PolicyEditor/policyModel';

export type EditableOperation = {
  method: string;
  path: string;
  flows: FlowPolicies;
  isFlat: boolean;
};

export type EditableModel = {
  apiFlows: FlowPolicies;
  apiIsFlat: boolean;
  operations: EditableOperation[];
};

/**
 * Normalizes `useWso2ApiPolicies`'s output into the flat, flow-keyed local
 * state shape the policy editor works with. Mirrors the exact
 * gateway-data-wins-over-annotation precedence already implemented in
 * `PublisherPoliciesList.tsx`, so both views agree on what data is shown.
 */
export function usePolicyEditorModel(options: {
  details?: any;
  gatewayOperations?: any[];
  gatewayApiPolicies?: any;
}): { initialModel: EditableModel } {
  const { details, gatewayOperations, gatewayApiPolicies } = options;

  const initialModel = useMemo(() => {
    // `gatewayApiPolicies`/`op.policies` being present-but-empty (`[]`, a
    // real "no policies attached" gateway artifact) must win over `details`
    // — falling back just because it's empty would re-normalize it through
    // the `{}` default below and silently flip a flat scope's `isFlat` off,
    // which corrupts what gets sent back on save (see normalizeFlowPolicies).
    const rawApiPolicies =
      gatewayApiPolicies !== undefined
        ? gatewayApiPolicies
        : details?.apiPolicies;
    const { flows: apiFlows, isFlat: apiIsFlat } =
      normalizeFlowPolicies(rawApiPolicies);

    const rawOperations: any[] =
      gatewayOperations && gatewayOperations.length > 0
        ? gatewayOperations
        : details?.operations || [];

    const operations: EditableOperation[] = rawOperations.map((op: any) => {
      const rawOpPolicies = op.operationPolicies ?? op.policies;
      const { flows, isFlat } = normalizeFlowPolicies(rawOpPolicies);
      return {
        method: String(op.verb || op.method || 'UNKNOWN').toUpperCase(),
        path: op.target || op.path || '/',
        flows,
        isFlat,
      };
    });

    return { apiFlows, apiIsFlat, operations };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details, gatewayOperations, gatewayApiPolicies]);

  return { initialModel };
}
