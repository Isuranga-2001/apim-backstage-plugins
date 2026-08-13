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

import { Wso2DiscoveryService } from './discoveryService';
import { mockServices } from '@backstage/backend-test-utils';

// Domain Mocks
import { fetchGlobalSettings } from './domains/settings';
import { fetchApiList, mapWso2ApiToEntity } from './domains/api';
import { fetchApiProductList, mapWso2ProductToEntity } from './domains/product';
import { fetchMcpServerList, mapWso2McpToEntity } from './domains/mcp';
import { fetchServiceList, mapWso2ServiceToEntity } from './domains/service';
import {
  discoverWSO2PlatformGatewayApis,
  mapDiscoveredApiToEntity,
} from './domains/gateway';

jest.mock('./domains/settings', () => ({ fetchGlobalSettings: jest.fn() }));
jest.mock('./domains/api', () => ({
  fetchApiList: jest.fn(),
  mapWso2ApiToEntity: jest.fn(),
}));
jest.mock('./domains/product', () => ({
  fetchApiProductList: jest.fn(),
  mapWso2ProductToEntity: jest.fn(),
}));
jest.mock('./domains/mcp', () => ({
  fetchMcpServerList: jest.fn(),
  mapWso2McpToEntity: jest.fn(),
}));
jest.mock('./domains/service', () => ({
  fetchServiceList: jest.fn(),
  mapWso2ServiceToEntity: jest.fn(),
}));
jest.mock('./domains/gateway', () => ({
  discoverWSO2PlatformGatewayApis: jest.fn(),
  mapDiscoveredApiToEntity: jest.fn(),
}));

const mockFetchGlobalSettings = jest.mocked(fetchGlobalSettings);
const mockFetchApiList = jest.mocked(fetchApiList);
const mockMapWso2ApiToEntity = jest.mocked(mapWso2ApiToEntity);
const mockFetchApiProductList = jest.mocked(fetchApiProductList);
const mockMapWso2ProductToEntity = jest.mocked(mapWso2ProductToEntity);
const mockFetchMcpServerList = jest.mocked(fetchMcpServerList);
const mockMapWso2McpToEntity = jest.mocked(mapWso2McpToEntity);
const mockFetchServiceList = jest.mocked(fetchServiceList);
const mockMapWso2ServiceToEntity = jest.mocked(mapWso2ServiceToEntity);
const mockDiscoverWSO2PlatformGatewayApis = jest.mocked(
  discoverWSO2PlatformGatewayApis,
);
const mockMapDiscoveredApiToEntity = jest.mocked(mapDiscoveredApiToEntity);

describe('Wso2DiscoveryService', () => {
  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${
      expect.getState().currentTestName
    }\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  const logger = mockServices.logger.mock();
  const mockClient = {
    getDispatcher: jest.fn().mockReturnValue({}),
  } as any;

  let service: Wso2DiscoveryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new Wso2DiscoveryService({ client: mockClient, logger });
  });

  it('should orchestrate and map settings, apis, products, mcps, and gateway discovery successfully', async () => {
    const namespace = 'default';
    const providerId = 'wso2-provider';
    const platformGateways = [
      { environmentName: 'gw-1', urls: ['https://gw1.com'] },
    ] as any;

    const mockSettings = { environment: [] };
    const mockApis = [
      {
        id: 'api-1',
        name: 'api-1',
        version: '1.0.0',
        context: '/api-1',
        provider: 'admin',
        type: 'HTTP',
        lifeCycleStatus: 'PUBLISHED',
      },
    ];
    const mockProducts = [
      {
        id: 'product-1',
        name: 'product-1',
        version: '1.0.0',
        context: '/product-1',
        provider: 'admin',
      },
    ];
    const mockMcps = [{ id: 'mcp-1', name: 'mcp-1' }];
    const mockServicesList = [{ id: 'service-1', name: 'service-1' }];
    const mockDiscoveredGatewayApis = [{ id: 'gate-api-1' }];

    mockFetchGlobalSettings.mockResolvedValueOnce(mockSettings);
    mockFetchApiList.mockResolvedValueOnce(mockApis);
    mockFetchApiProductList.mockResolvedValueOnce(mockProducts);
    mockFetchMcpServerList.mockResolvedValueOnce(mockMcps);
    mockFetchServiceList.mockResolvedValueOnce(mockServicesList);
    mockDiscoverWSO2PlatformGatewayApis.mockResolvedValueOnce(
      mockDiscoveredGatewayApis,
    );

    // Mapped entities
    const apiEntity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: { name: 'api-1' },
    } as any;
    const productEntity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: { name: 'product-1' },
    } as any;
    const mcpEntity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: { name: 'mcp-1' },
    } as any;
    const serviceEntity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: { name: 'service-1' },
    } as any;
    const discoveredEntity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: { name: 'discovered-1' },
    } as any;

    mockMapWso2ApiToEntity.mockReturnValueOnce(apiEntity);
    mockMapWso2ProductToEntity.mockReturnValueOnce(productEntity);
    mockMapWso2McpToEntity.mockReturnValueOnce(mcpEntity);
    mockMapWso2ServiceToEntity.mockReturnValueOnce(serviceEntity);
    mockMapDiscoveredApiToEntity.mockReturnValueOnce(discoveredEntity);

    const result = await service.discoverAll({
      namespace,
      providerId,
      platformGateways,
      apiManagerEnabled: true,
    });

    expect(result).toHaveLength(5);
    expect(result).toContain(apiEntity);
    expect(result).toContain(productEntity);
    expect(result).toContain(mcpEntity);
    expect(result).toContain(serviceEntity);
    expect(result).toContain(discoveredEntity);

    expect(mockFetchGlobalSettings).toHaveBeenCalledWith(mockClient);
    expect(mockFetchApiList).toHaveBeenCalledWith(mockClient, {
      onProgress: undefined,
    });
    expect(mockFetchApiProductList).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ onTotal: expect.any(Function) }),
    );
    expect(mockFetchMcpServerList).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ onTotal: expect.any(Function) }),
    );
    expect(mockFetchServiceList).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ onTotal: expect.any(Function) }),
    );
    expect(mockDiscoverWSO2PlatformGatewayApis).toHaveBeenCalledWith(
      platformGateways,
      mockClient,
    );

    expect(logger.info).toHaveBeenCalledWith(
      '[Wso2DiscoveryService] Starting discovery for provider wso2-provider',
    );
    expect(logger.info).toHaveBeenCalledWith(
      '[Wso2DiscoveryService] Discovery complete. Found 5 entities.',
    );

    console.log(
      formatTestCaseDoc(`
=== [Discovery Service: Full Ingestion Orchestration] ===
Fetched Counts:
  Settings: Deployed successfully
  Publisher APIs: 1
  API Products: 1
  MCP Servers: 1
  Services: 1
  Gateway APIs Discovered: 1
Total Backstage entities registered: ${result.length}
`),
    );
  });

  it('should run gateway discovery without a client when API Manager is disabled', async () => {
    const gatewayOnlyService = new Wso2DiscoveryService({
      client: undefined,
      logger,
    });
    const platformGateways = [
      { environmentName: 'gw-1', urls: ['https://gw1.com'] },
    ] as any;

    const discoveredEntity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: { name: 'discovered-1' },
    } as any;
    mockDiscoverWSO2PlatformGatewayApis.mockResolvedValueOnce([
      { id: 'gate-api-1' },
    ]);
    mockMapDiscoveredApiToEntity.mockReturnValueOnce(discoveredEntity);

    const result = await gatewayOnlyService.discoverAll({
      namespace: 'default',
      providerId: 'wso2-provider',
      platformGateways,
      apiManagerEnabled: false,
    });

    expect(result).toEqual([discoveredEntity]);
    expect(mockDiscoverWSO2PlatformGatewayApis).toHaveBeenCalledWith(
      platformGateways,
      undefined,
    );
    expect(mockFetchGlobalSettings).not.toHaveBeenCalled();
    expect(mockFetchApiList).not.toHaveBeenCalled();
  });
});
