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

import { discoverWSO2PlatformGatewayApis } from './gatewayUtils';
import { Wso2Client } from '../../client';
import { PlatformGateway } from './types';
import { gatewayStatusTracker } from '../../gatewayStatusTracker';

jest.mock('../../client');

describe('gateway/gatewayUtils', () => {
  let mockGetGatewayApis: jest.Mock;
  let mockGetGatewayApiDetail: jest.Mock;
  let mockClient: Wso2Client;

  beforeEach(() => {
    jest.clearAllMocks();
    gatewayStatusTracker.reset();
    mockGetGatewayApis = jest.fn();
    mockGetGatewayApiDetail = jest.fn();

    (Wso2Client as jest.Mock).mockImplementation(() => ({
      getGatewayApis: mockGetGatewayApis,
      getGatewayApiDetail: mockGetGatewayApiDetail,
    }));
    mockClient = new Wso2Client({} as any);
  });

  it('should skip discovery if no gateway has discoveryUrl configured', async () => {
    const gateways: PlatformGateway[] = [
      {
        environmentName: 'gw-1',
        environmentType: 'PROD',
        urls: ['https://gw1.com'],
      },
    ];

    const result = await discoverWSO2PlatformGatewayApis(gateways, mockClient);
    expect(result).toEqual([]);
    expect(mockGetGatewayApis).not.toHaveBeenCalled();
  });

  it('should successfully discover and map APIs from gateways', async () => {
    const gateways: PlatformGateway[] = [
      {
        environmentName: 'MySelfHostedGate',
        environmentType: 'PRODUCTION',
        urls: ['https://gateway.com'],
        discoveryUrl: 'https://discovery-service.com/apis',
        discoveryAuth: 'Basic abc-auth',
      },
    ];

    const mockApisList = {
      apis: [
        { id: 'api-1', name: 'Service One' },
        { id: 'api-2', name: 'Service Two' },
      ],
    };

    const mockApiDetail1 = {
      status: 'success',
      api: {
        id: 'api-1',
        description: 'Details 1',
        configuration: { spec: { version: '1.0.0', context: 's1' } },
      },
    };

    const mockApiDetail2 = {
      status: 'success',
      api: {
        id: 'api-2',
        description: 'Details 2',
        configuration: { spec: { version: '2.0.0', context: 's2' } },
      },
    };

    mockGetGatewayApis.mockResolvedValueOnce(mockApisList);
    mockGetGatewayApiDetail.mockImplementation(async (_url, id) => {
      if (id === 'api-1') return mockApiDetail1;
      if (id === 'api-2') return mockApiDetail2;
      return null;
    });

    const result = await discoverWSO2PlatformGatewayApis(gateways, mockClient);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'api-1',
        description: 'Details 1',
        environmentType: 'PRODUCTION',
        initiatedFromGateway: true,
        isDirectDiscovery: true,
        environmentName: 'MySelfHostedGate',
        gatewayUrls: ['https://gateway.com'],
        fullConfig: mockApiDetail1.api.configuration,
        fetchedSwagger: JSON.stringify(
          mockApiDetail1.api.configuration.spec,
          null,
          2,
        ),
      }),
    );

    expect(mockGetGatewayApis).toHaveBeenCalledWith(
      'https://discovery-service.com/apis',
      'Basic abc-auth',
    );
    expect(gatewayStatusTracker.getStatus('MySelfHostedGate').active).toBe(
      true,
    );
  });

  it('should discover APIs from gateway-controller 1.2.x raw RestApi responses', async () => {
    const gateways: PlatformGateway[] = [
      {
        environmentName: 'oc-poc-gateway',
        environmentType: 'PRODUCTION',
        urls: ['https://gateway.com'],
        discoveryUrl: 'https://controller.com/rest-apis',
        discoveryAuth: 'Basic abc-auth',
      },
    ];

    const rawRestApi = {
      apiVersion: 'gateway.api-platform.wso2.com/v1alpha1',
      kind: 'RestApi',
      metadata: { name: 'orders-api-dev-55b5a86f' },
      spec: {
        displayName: 'Orders API',
        version: 'v1.0',
        context: '/orders-api-dev-55b5a86f',
        policies: [{ name: 'cors', version: 'v1' }],
        operations: [{ method: 'GET', path: '/orders' }],
      },
      status: { id: '019ff545-0000-0000-0000-000000000000', state: 'Deployed' },
    };

    mockGetGatewayApis.mockResolvedValueOnce({ items: [rawRestApi] });
    mockGetGatewayApiDetail.mockResolvedValueOnce(rawRestApi);

    const result = await discoverWSO2PlatformGatewayApis(gateways, mockClient);

    expect(mockGetGatewayApiDetail).toHaveBeenCalledWith(
      'https://controller.com/rest-apis',
      'orders-api-dev-55b5a86f',
      'Basic abc-auth',
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: '019ff545-0000-0000-0000-000000000000',
        name: 'Orders API',
        version: 'v1.0',
        context: '/orders-api-dev-55b5a86f',
        lifeCycleStatus: 'Deployed',
        initiatedFromGateway: true,
        isDirectDiscovery: true,
        environmentName: 'oc-poc-gateway',
        fullConfig: rawRestApi,
      }),
    );
  });

  it('should gracefully log and continue if one of the detail fetches fails', async () => {
    const gateways: PlatformGateway[] = [
      {
        environmentName: 'MySelfHostedGate',
        environmentType: 'PRODUCTION',
        urls: ['https://gateway.com'],
        discoveryUrl: 'https://discovery-service.com/apis',
        discoveryAuth: 'Basic abc-auth',
      },
    ];

    mockGetGatewayApis.mockResolvedValueOnce({ apis: [{ id: 'api-1' }] });
    mockGetGatewayApiDetail.mockRejectedValueOnce(
      new Error('Connection abort'),
    );

    const result = await discoverWSO2PlatformGatewayApis(gateways, mockClient);
    expect(result).toEqual([]);
  });

  it('should gracefully log and catch outer fetch connection errors', async () => {
    const gateways: PlatformGateway[] = [
      {
        environmentName: 'MySelfHostedGate',
        environmentType: 'PRODUCTION',
        urls: ['https://gateway.com'],
        discoveryUrl: 'https://discovery-service.com/apis',
      },
    ];

    mockGetGatewayApis.mockRejectedValueOnce(
      new Error('Discovery service offline'),
    );

    const result = await discoverWSO2PlatformGatewayApis(gateways, mockClient);
    expect(result).toEqual([]);
    const status = gatewayStatusTracker.getStatus('MySelfHostedGate');
    expect(status.active).toBe(false);
    expect(status.lastError).toBe('Discovery service offline');
  });
});
