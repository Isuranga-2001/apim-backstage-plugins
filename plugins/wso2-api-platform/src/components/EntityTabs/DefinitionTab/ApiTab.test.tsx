/** @jest-environment jsdom */
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

import { render, screen, waitFor } from '@testing-library/react';
import { EntityWso2ApiDefinitionTab } from './ApiTab';

const mockConfigApi = {
  getOptionalBoolean: jest.fn().mockReturnValue(true),
  getOptionalNumber: jest.fn().mockReturnValue(1024),
};
const mockWso2Api = {
  getDefinition: jest.fn(),
  getApiWsdl: jest.fn(),
};

let mockEntity: any;

jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({ entity: mockEntity }),
}));

jest.mock('@backstage/core-plugin-api', () => ({
  configApiRef: { id: 'core.config' },
  createApiRef: jest.fn().mockReturnValue({}),
  useApi: (apiRef: any) =>
    apiRef.id === 'core.config' ? mockConfigApi : mockWso2Api,
}));

jest.mock('@backstage/core-components', () => ({
  InfoCard: ({ children }: any) => <section>{children}</section>,
  EmptyState: ({ title, description }: any) => (
    <div>
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}));

jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ value }: any) => (
    <pre data-testid="definition-viewer">{value}</pre>
  ),
}));

const GATEWAY_ENTITY = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'API',
  metadata: {
    name: 'orders-api',
    namespace: 'wso2-gateways',
    annotations: {
      'wso2.com/api-discovery-type': 'self-hosted-gateway',
      'wso2-gateway.com/api-id': 'gw-api-1',
    },
  },
  spec: {},
};

const APIM_ENTITY = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'API',
  metadata: {
    name: 'orders-api',
    namespace: 'default',
    annotations: { 'wso2.com/api-id': 'apim-api-1' },
  },
  spec: { definition: 'openapi: 3.0.0\ninfo:\n  title: Orders' },
};

describe('EntityWso2ApiDefinitionTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigApi.getOptionalBoolean.mockReturnValue(true);
  });

  it('shows an "Add Definition" button for a gateway API with no definition yet', async () => {
    mockEntity = GATEWAY_ENTITY;
    mockWso2Api.getDefinition.mockResolvedValue({
      definition: null,
      capabilities: { read: true, write: true },
    });

    render(<EntityWso2ApiDefinitionTab />);

    expect(
      await screen.findByRole('button', { name: 'Add Definition' }),
    ).toBeDefined();
    expect(screen.queryByTestId('definition-viewer')).toBeNull();
  });

  it('shows the viewer and an "Update Definition" button once a gateway API has a definition', async () => {
    mockEntity = GATEWAY_ENTITY;
    mockWso2Api.getDefinition.mockResolvedValue({
      definition: { content: 'openapi: 3.0.0', format: 'YAML' },
      capabilities: { read: true, write: true },
    });

    render(<EntityWso2ApiDefinitionTab />);

    expect(
      await screen.findByRole('button', { name: 'Update Definition' }),
    ).toBeDefined();
    expect(screen.getByTestId('definition-viewer').textContent).toContain(
      'openapi: 3.0.0',
    );
  });

  it('renders the on-prem definition from the catalog with no Add/Update button (regression)', async () => {
    mockEntity = APIM_ENTITY;

    render(<EntityWso2ApiDefinitionTab />);

    await waitFor(() =>
      expect(screen.getByTestId('definition-viewer').textContent).toContain(
        'openapi: 3.0.0',
      ),
    );
    expect(screen.queryByRole('button', { name: 'Add Definition' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Update Definition' }),
    ).toBeNull();
    expect(mockWso2Api.getDefinition).not.toHaveBeenCalled();
  });
});
