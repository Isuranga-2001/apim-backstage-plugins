/**
 * @jest-environment jsdom
 */
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

import { fireEvent, render, screen } from '@testing-library/react';
import { EntityWso2DocumentsCard } from './DocumentsCard';

let mockEntity: any;
let mockStorageEnabled: boolean;
let mockWso2Api: { listDocuments: jest.Mock };

jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({
    entity: mockEntity,
  }),
}));

jest.mock('@backstage/core-plugin-api', () => ({
  configApiRef: { id: 'core.config' },
  fetchApiRef: { id: 'core.fetch' },
  createApiRef: (config: { id: string }) => config,
  useApi: (apiRef: { id: string }) => {
    if (apiRef.id === 'core.config') {
      return {
        getString: () => 'http://localhost:7007',
        getOptionalBoolean: () => mockStorageEnabled,
      };
    }
    if (apiRef.id === 'core.fetch') {
      return {
        fetch: jest.fn(),
      };
    }
    if (apiRef.id === 'plugin.wso2-api-platform.service') {
      return mockWso2Api;
    }
    throw new Error(`Unexpected apiRef: ${apiRef.id}`);
  },
}));

jest.mock('@backstage/core-components', () => ({
  EmptyState: ({ title, description }: any) => (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  ),
  InfoCard: ({ children }: any) => <div>{children}</div>,
  Progress: () => <div>Loading</div>,
  WarningPanel: ({ title, children }: any) => (
    <section role="alert">
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

jest.mock('./components/DocumentPreview', () => ({
  Wso2DocumentPreview: ({ showBackButton }: any) => (
    <div>Document preview (backButton: {showBackButton ? 'yes' : 'no'})</div>
  ),
}));

jest.mock('./components/DocumentTable', () => ({
  Wso2DocumentTable: ({ documents, onPreview }: any) => (
    <div>
      Document table
      {documents.map((doc: any) => (
        <button key={doc.id} onClick={() => onPreview(doc)}>
          View {doc.name}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('./components/SingleDocumentView', () => ({
  Wso2SingleDocumentView: () => <div>Single document</div>,
}));

jest.mock('./components/DocumentsToolbar', () => ({
  DocumentsToolbar: ({ canAdd }: any) => (
    <div>Toolbar {canAdd ? '(Add enabled)' : '(Add disabled)'}</div>
  ),
}));

jest.mock('./components/AddDocumentDialog', () => ({
  AddDocumentDialog: () => <div>Add dialog</div>,
}));

jest.mock('./components/EditDocumentMetadataDialog', () => ({
  EditDocumentMetadataDialog: () => <div>Edit dialog</div>,
}));

jest.mock('./components/DeleteDocumentDialog', () => ({
  DeleteDocumentDialog: () => <div>Delete dialog</div>,
}));

describe('EntityWso2DocumentsCard', () => {
  beforeEach(() => {
    mockStorageEnabled = true;
    mockWso2Api = {
      listDocuments: jest.fn().mockResolvedValue({
        count: 1,
        list: [
          {
            id: 'doc-1',
            documentId: 'doc-1',
            name: 'Gateway Guide',
            sourceType: 'MARKDOWN',
          },
        ],
        capabilities: {
          read: true,
          create: true,
          updateMetadata: true,
          updateContent: false,
          delete: true,
        },
      }),
    };
    mockEntity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: {
        name: 'test-api',
        namespace: 'default',
        annotations: {
          'wso2.com/api-id': 'api-1',
        },
      },
    };
  });

  it('renders the document store table with Add enabled for self-hosted gateway APIs', async () => {
    mockEntity.metadata.namespace = 'wso2-gateways';
    delete mockEntity.metadata.annotations['wso2.com/api-id'];
    mockEntity.metadata.annotations['wso2.com/api-discovery-type'] =
      'self-hosted-gateway';
    mockEntity.metadata.annotations['wso2-gateway.com/api-id'] = 'gw-api-1';
    mockEntity.metadata.annotations['wso2-gateway.com/api-endpoints'] =
      JSON.stringify([{ environmentName: 'dev' }]);

    render(<EntityWso2DocumentsCard />);

    expect(await screen.findByText('Document table')).toBeDefined();
    expect(screen.getByText('Toolbar (Add enabled)')).toBeDefined();
    expect(screen.queryByText('Documents unavailable')).toBeNull();
    expect(mockWso2Api.listDocuments).toHaveBeenCalledWith({
      kind: 'API',
      namespace: 'wso2-gateways',
      name: 'test-api',
    });
  });

  it('renders the document store table with Add disabled when the store reports no create capability (e.g. on-prem via the same route)', async () => {
    mockEntity.metadata.namespace = 'wso2-gateways';
    delete mockEntity.metadata.annotations['wso2.com/api-id'];
    mockEntity.metadata.annotations['wso2.com/api-discovery-type'] =
      'openchoreo-gateway';
    mockEntity.metadata.annotations['wso2-gateway.com/api-id'] = 'gw-api-2';
    mockWso2Api.listDocuments.mockResolvedValue({
      count: 0,
      list: [],
      capabilities: {
        read: true,
        create: false,
        updateMetadata: false,
        updateContent: false,
        delete: false,
      },
    });

    render(<EntityWso2DocumentsCard />);

    expect(await screen.findByText('Toolbar (Add disabled)')).toBeDefined();
    expect(await screen.findByText('No documents yet — add one above.')).toBeDefined();
  });

  it('shows a back button when viewing the only document in store mode', async () => {
    mockEntity.metadata.namespace = 'wso2-gateways';
    delete mockEntity.metadata.annotations['wso2.com/api-id'];
    mockEntity.metadata.annotations['wso2.com/api-discovery-type'] =
      'self-hosted-gateway';
    mockEntity.metadata.annotations['wso2-gateway.com/api-id'] = 'gw-api-1';

    render(<EntityWso2DocumentsCard />);

    const viewButton = await screen.findByText('View Gateway Guide');
    fireEvent.click(viewButton);

    expect(
      await screen.findByText(/backButton: yes/),
    ).toBeDefined();
  });

  it('shows the unavailable empty state for gateway APIs when storage.enabled is false', async () => {
    mockStorageEnabled = false;
    mockEntity.metadata.namespace = 'wso2-gateways';
    delete mockEntity.metadata.annotations['wso2.com/api-id'];
    mockEntity.metadata.annotations['wso2.com/api-discovery-type'] =
      'self-hosted-gateway';
    mockEntity.metadata.annotations['wso2-gateway.com/api-id'] = 'gw-api-1';

    render(<EntityWso2DocumentsCard />);

    expect(screen.getByText('Documents unavailable')).toBeDefined();
    expect(mockWso2Api.listDocuments).not.toHaveBeenCalled();
  });

  it('shows the unavailable empty state for on-prem APIs deployed via an API Platform Gateway', () => {
    mockEntity.metadata.annotations['wso2.com/platform-gateway-endpoints'] =
      '[]';

    render(<EntityWso2DocumentsCard />);

    expect(screen.getByText('Documents unavailable')).toBeDefined();
    expect(
      screen.getByText(
        'Documents are not supported for API Platform APIs discovered from self-hosted gateways. Please check the WSO2 API Platform directly for documentation.',
      ),
    ).toBeDefined();
    expect(screen.queryByText('Document table')).toBeNull();
  });

  it('uses the regular empty state for Publisher APIs with no attached documents', () => {
    render(<EntityWso2DocumentsCard />);

    expect(screen.getByText('No documents')).toBeDefined();
    expect(
      screen.getByText(
        'This API has no documents attached in WSO2 API Manager.',
      ),
    ).toBeDefined();
  });
});
