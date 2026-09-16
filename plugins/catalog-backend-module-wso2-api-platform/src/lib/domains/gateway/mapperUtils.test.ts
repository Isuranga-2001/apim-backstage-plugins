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

import { mapDiscoveredApiToEntity } from './mapperUtils';

describe('gateway/mapperUtils', () => {
  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${
      expect.getState().currentTestName
    }\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  it('should cleanly map raw gateway discovered APIs to API entities', () => {
    const api = {
      id: 'discovered-api-id-000',
      name: 'User Core API',
      description: 'Discovered from gateway-1',
      discoveredFrom: 'gateway-1',
      environmentName: 'gateway-1',
      environmentType: 'wso2',
      gatewayUrls: ['https://gateway-1.wso2.com/'],
      context: 'users/1.2.0',
      fetchedSwagger: 'openapi: 3.0.0...',
      organizationId: 'wso2-org',
      documents: [{ name: 'Gateway Info' }],
      fullConfig: {
        spec: {
          displayName: 'User Core API',
          version: '1.2.0',
          context: 'users',
        },
      },
    };

    const entity = mapDiscoveredApiToEntity(api);

    expect(entity).toEqual({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: {
        name: 'user-core-api-1-2-0',
        namespace: 'wso2-gateways',
        title: 'User Core API',
        annotations: {
          'backstage.io/managed-by-location': 'wso2-gateway:gateway-1',
          'backstage.io/managed-by-origin-location': 'wso2-gateway:gateway-1',
          'wso2-gateway.com/api-id': 'discovered-api-id-000',
          'wso2-gateway.com/api-name': 'User Core API',
          'wso2-gateway.com/api-version': '1.2.0',
          'wso2-gateway.com/api-context': 'users/1.2.0',
          'wso2.com/api-type': 'openapi',
          'wso2.com/api-gateway': 'API Platform',
          'wso2.com/api-discovery-type': 'api-platform-gateway',
          'wso2-gateway.com/api-endpoints': JSON.stringify([
            {
              environmentName: 'gateway-1',
              environmentType: 'wso2',
              gatewayType: 'API Platform',
              urls: ['https://gateway-1.wso2.com/users/1.2.0'],
            },
          ]),
        },
        tags: ['gateway-gateway-1'],
      },
      spec: {
        type: 'openapi',
        lifecycle: 'production',
        owner: 'wso2',
        definition: 'openapi: 3.0.0...',
      },
    });

    console.log(
      formatTestCaseDoc(`
=== [Mapper Utility: Discovered Gateway API Mapping] ===
Input Discovered Gateway API:
  Discovered From: "${api.discoveredFrom}"
  Resolved Name: "${entity.metadata.name}"
  Gateway endpoints: ${JSON.stringify(
    JSON.parse(entity.metadata.annotations!['wso2-gateway.com/api-endpoints']!),
    null,
    2,
  )}
`),
    );
  });
});
