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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DefinitionUploadDialog } from './DefinitionUploadDialog';

const mockConfigApi = {
  getOptionalNumber: jest.fn().mockReturnValue(1024),
};
const mockWso2Api = { upsertDefinition: jest.fn() };

jest.mock('@backstage/core-plugin-api', () => ({
  configApiRef: { id: 'core.config' },
  createApiRef: jest.fn().mockReturnValue({}),
  useApi: (apiRef: any) =>
    apiRef.id === 'core.config' ? mockConfigApi : mockWso2Api,
}));

const entity: any = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'API',
  metadata: { name: 'orders-api', namespace: 'wso2-gateways' },
};

describe('DefinitionUploadDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigApi.getOptionalNumber.mockReturnValue(1024);
  });

  it('shows "Add Definition" as the title when there is no existing definition', () => {
    render(
      <DefinitionUploadDialog
        entity={entity}
        open
        hasExistingDefinition={false}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );
    expect(screen.getByText('Add Definition')).toBeDefined();
  });

  it('shows "Upload Definition" as the title when a definition already exists', () => {
    render(
      <DefinitionUploadDialog
        entity={entity}
        open
        hasExistingDefinition
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );
    expect(screen.getByText('Upload Definition')).toBeDefined();
  });

  it('requires a file before saving', () => {
    render(
      <DefinitionUploadDialog
        entity={entity}
        open
        hasExistingDefinition={false}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      screen.getByText('Choose a YAML or JSON file to upload.'),
    ).toBeDefined();
    expect(mockWso2Api.upsertDefinition).not.toHaveBeenCalled();
  });

  it('rejects a disallowed file extension', async () => {
    render(
      <DefinitionUploadDialog
        entity={entity}
        open
        hasExistingDefinition={false}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    const file = new File(['openapi: 3.0.0'], 'openapi.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(screen.getByTestId('definition-file-input'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText(/is not supported\. Allowed: yaml, yml, json/),
    ).toBeDefined();
    expect(mockWso2Api.upsertDefinition).not.toHaveBeenCalled();
  });

  it('rejects content that is not valid YAML or JSON', async () => {
    render(
      <DefinitionUploadDialog
        entity={entity}
        open
        hasExistingDefinition={false}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    const file = new File(['"unterminated'], 'openapi.yaml', {
      type: 'application/yaml',
    });
    fireEvent.change(screen.getByTestId('definition-file-input'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('The file does not contain valid YAML or JSON.'),
    ).toBeDefined();
    expect(mockWso2Api.upsertDefinition).not.toHaveBeenCalled();
  });

  it('uploads a valid YAML definition and calls onSaved', async () => {
    mockWso2Api.upsertDefinition.mockResolvedValue({
      definition: { content: 'openapi: 3.0.0', format: 'YAML' },
      capabilities: { read: true, write: true },
    });
    const onSaved = jest.fn();

    render(
      <DefinitionUploadDialog
        entity={entity}
        open
        hasExistingDefinition={false}
        onClose={jest.fn()}
        onSaved={onSaved}
      />,
    );

    const file = new File(['openapi: 3.0.0'], 'openapi.yaml', {
      type: 'application/yaml',
    });
    fireEvent.change(screen.getByTestId('definition-file-input'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mockWso2Api.upsertDefinition).toHaveBeenCalledWith(
      { kind: 'API', namespace: 'wso2-gateways', name: 'orders-api' },
      { fileName: 'openapi.yaml', content: 'openapi: 3.0.0' },
    );
  });

  it('rejects a file larger than the configured limit', async () => {
    mockConfigApi.getOptionalNumber.mockReturnValue(0.001);
    render(
      <DefinitionUploadDialog
        entity={entity}
        open
        hasExistingDefinition={false}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    const file = new File(['openapi: 3.0.0'.repeat(50)], 'openapi.yaml', {
      type: 'application/yaml',
    });
    fireEvent.change(screen.getByTestId('definition-file-input'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/exceeds the .* limit/)).toBeDefined();
    expect(mockWso2Api.upsertDefinition).not.toHaveBeenCalled();
  });
});
