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

import { Entity } from '@backstage/catalog-model';
import {
  apiDescriptionOverrideTracker,
  DefinitionDescriptionProcessor,
} from './apiDescriptionOverride';

function apiEntity(discoveryType?: string): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'API',
    metadata: {
      name: 'orders-api',
      namespace: 'wso2-gateways',
      annotations: discoveryType
        ? { 'wso2.com/api-discovery-type': discoveryType }
        : {},
    },
    spec: {},
  };
}

describe('apiDescriptionOverride', () => {
  const processor = new DefinitionDescriptionProcessor();

  beforeEach(() => {
    apiDescriptionOverrideTracker.reset();
  });

  it('applies a tracked description to gateway/OpenChoreo API entities, and clears it back out', async () => {
    apiDescriptionOverrideTracker.set(
      'api:wso2-gateways/orders-api',
      'Orders API from its definition',
    );

    const gatewayResult = await processor.postProcessEntity!(
      apiEntity('self-hosted-gateway'),
    );
    expect(gatewayResult.metadata.description).toBe(
      'Orders API from its definition',
    );

    const openchoreoResult = await processor.postProcessEntity!(
      apiEntity('openchoreo-gateway'),
    );
    expect(openchoreoResult.metadata.description).toBe(
      'Orders API from its definition',
    );

    apiDescriptionOverrideTracker.set('api:wso2-gateways/orders-api', '');
    expect(
      apiDescriptionOverrideTracker.get('api:wso2-gateways/orders-api'),
    ).toBeUndefined();
  });

  it('leaves the entity untouched unless there is a tracked description for a gateway/OpenChoreo API entity', async () => {
    const untracked = await processor.postProcessEntity!(
      apiEntity('self-hosted-gateway'),
    );

    apiDescriptionOverrideTracker.set('api:wso2-gateways/orders-api', 'Orders');
    const notGatewayDiscovered = await processor.postProcessEntity!(
      apiEntity(),
    );
    const nonApiKind = await processor.postProcessEntity!({
      ...apiEntity('self-hosted-gateway'),
      kind: 'Component',
    });

    expect(untracked.metadata.description).toBeUndefined();
    expect(notGatewayDiscovered.metadata.description).toBeUndefined();
    expect(nonApiKind.metadata.description).toBeUndefined();
  });
});
