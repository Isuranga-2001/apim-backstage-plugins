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
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DefinitionUploadDialog } from './DefinitionUploadDialog';

const ENTITY_PATH = '/catalog/default/api/orders-api';

function renderDialog(props: {
  entity: any;
  open: boolean;
  hasExistingDefinition: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  return render(
    <MemoryRouter initialEntries={[ENTITY_PATH]}>
      <Routes>
        <Route
          path={ENTITY_PATH}
          element={<DefinitionUploadDialog {...props} />}
        />
        <Route path="/wso2-api-platform" element={<div>Home Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const mockConfigApi = {
  getOptionalNumber: jest.fn().mockReturnValue(1024),
};
const mockWso2Api = {
  upsertDefinition: jest.fn(),
  previewDefinitionDiff: jest.fn(),
};

jest.mock('@backstage/core-plugin-api', () => ({
  configApiRef: { id: 'core.config' },
  createApiRef: jest.fn().mockReturnValue({}),
  createRouteRef: jest.fn().mockReturnValue({}),
  createExternalRouteRef: jest.fn().mockReturnValue({}),
  useApi: (apiRef: any) =>
    apiRef.id === 'core.config' ? mockConfigApi : mockWso2Api,
  useRouteRef: () => () => '/wso2-api-platform',
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
    renderDialog({
      entity: entity,
      open: true,
      hasExistingDefinition: false,
      onClose: jest.fn(),
      onSaved: jest.fn(),
    });
    expect(screen.getByText('Add Definition')).toBeDefined();
  });

  it('shows "Upload Definition" as the title when a definition already exists', () => {
    renderDialog({
      entity: entity,
      open: true,
      hasExistingDefinition: true,
      onClose: jest.fn(),
      onSaved: jest.fn(),
    });
    expect(screen.getByText('Upload Definition')).toBeDefined();
  });

  it('requires a file before saving', () => {
    renderDialog({
      entity: entity,
      open: true,
      hasExistingDefinition: false,
      onClose: jest.fn(),
      onSaved: jest.fn(),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      screen.getByText('Choose a YAML or JSON file to upload.'),
    ).toBeDefined();
    expect(mockWso2Api.upsertDefinition).not.toHaveBeenCalled();
  });

  it('rejects a disallowed file extension', async () => {
    renderDialog({
      entity: entity,
      open: true,
      hasExistingDefinition: false,
      onClose: jest.fn(),
      onSaved: jest.fn(),
    });

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
    renderDialog({
      entity: entity,
      open: true,
      hasExistingDefinition: false,
      onClose: jest.fn(),
      onSaved: jest.fn(),
    });

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

    renderDialog({
      entity: entity,
      open: true,
      hasExistingDefinition: false,
      onClose: jest.fn(),
      onSaved: onSaved,
    });

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

  it('blocks all actions behind a wait screen while saving, until the save (and its catalog sync) resolves', async () => {
    let resolveUpsert: () => void = () => {};
    mockWso2Api.upsertDefinition.mockReturnValue(
      new Promise(resolve => {
        resolveUpsert = () =>
          resolve({
            definition: { content: 'openapi: 3.0.0', format: 'YAML' },
            capabilities: { read: true, write: true },
          });
      }),
    );
    const onSaved = jest.fn();

    renderDialog({
      entity,
      open: true,
      hasExistingDefinition: false,
      onClose: jest.fn(),
      onSaved,
    });

    const file = new File(['openapi: 3.0.0'], 'openapi.yaml', {
      type: 'application/yaml',
    });
    fireEvent.change(screen.getByTestId('definition-file-input'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Applying Changes')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

    resolveUpsert();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('stays blocked (no backdrop-close) through save completion, and navigates to the home page', async () => {
    let resolveUpsert: () => void = () => {};
    mockWso2Api.upsertDefinition.mockReturnValue(
      new Promise(resolve => {
        resolveUpsert = () =>
          resolve({
            definition: { content: 'openapi: 3.0.0', format: 'YAML' },
            capabilities: { read: true, write: true },
          });
      }),
    );
    const onClose = jest.fn();

    renderDialog({
      entity,
      open: true,
      hasExistingDefinition: false,
      onClose,
      onSaved: jest.fn(),
    });

    const file = new File(['openapi: 3.0.0'], 'openapi.yaml', {
      type: 'application/yaml',
    });
    fireEvent.change(screen.getByTestId('definition-file-input'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('Applying Changes');

    resolveUpsert();
    fireEvent.click(document.querySelector('.MuiBackdrop-root')!);
    expect(onClose).not.toHaveBeenCalled();

    expect(await screen.findByText('Home Page')).toBeDefined();
  });

  it('rejects a file larger than the configured limit', async () => {
    mockConfigApi.getOptionalNumber.mockReturnValue(0.001);
    renderDialog({
      entity: entity,
      open: true,
      hasExistingDefinition: false,
      onClose: jest.fn(),
      onSaved: jest.fn(),
    });

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

  describe('replacing an existing definition', () => {
    it('previews the diff before saving instead of saving immediately', async () => {
      mockWso2Api.previewDefinitionDiff.mockResolvedValue({
        diff: {
          displayNameChange: undefined,
          versionChange: undefined,
          addedOperations: [{ method: 'GET', path: '/books' }],
          removedOperations: [],
          hasChanges: true,
        },
      });

      renderDialog({
        entity: entity,
        open: true,
        hasExistingDefinition: true,
        onClose: jest.fn(),
        onSaved: jest.fn(),
      });

      const file = new File(['openapi: 3.0.0'], 'openapi.yaml', {
        type: 'application/yaml',
      });
      fireEvent.change(screen.getByTestId('definition-file-input'), {
        target: { files: [file] },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('Review Changes')).toBeDefined();
      expect(screen.getByText('+ GET /books')).toBeDefined();
      expect(mockWso2Api.upsertDefinition).not.toHaveBeenCalled();
    });

    it('saves after the user confirms the reviewed changes', async () => {
      mockWso2Api.previewDefinitionDiff.mockResolvedValue({
        diff: {
          addedOperations: [{ method: 'GET', path: '/books' }],
          removedOperations: [],
          hasChanges: true,
        },
      });
      mockWso2Api.upsertDefinition.mockResolvedValue({
        definition: { content: 'openapi: 3.0.0', format: 'YAML' },
        capabilities: { read: true, write: true },
      });
      const onSaved = jest.fn();

      renderDialog({
        entity: entity,
        open: true,
        hasExistingDefinition: true,
        onClose: jest.fn(),
        onSaved: onSaved,
      });

      const file = new File(['openapi: 3.0.0'], 'openapi.yaml', {
        type: 'application/yaml',
      });
      fireEvent.change(screen.getByTestId('definition-file-input'), {
        target: { files: [file] },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await screen.findByText('Review Changes');
      fireEvent.click(screen.getByRole('button', { name: 'Confirm & Save' }));

      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect(mockWso2Api.upsertDefinition).toHaveBeenCalledWith(
        { kind: 'API', namespace: 'wso2-gateways', name: 'orders-api' },
        { fileName: 'openapi.yaml', content: 'openapi: 3.0.0' },
      );
    });

    it('returns to the file picker without saving when the user clicks Back', async () => {
      mockWso2Api.previewDefinitionDiff.mockResolvedValue({
        diff: { addedOperations: [], removedOperations: [], hasChanges: false },
      });

      renderDialog({
        entity: entity,
        open: true,
        hasExistingDefinition: true,
        onClose: jest.fn(),
        onSaved: jest.fn(),
      });

      const file = new File(['openapi: 3.0.0'], 'openapi.yaml', {
        type: 'application/yaml',
      });
      fireEvent.change(screen.getByTestId('definition-file-input'), {
        target: { files: [file] },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await screen.findByText('Review Changes');
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));

      expect(await screen.findByText('Upload Definition')).toBeDefined();
      expect(mockWso2Api.upsertDefinition).not.toHaveBeenCalled();
    });

    it('disables Confirm & Save when the diff reports no changes', async () => {
      mockWso2Api.previewDefinitionDiff.mockResolvedValue({
        diff: { addedOperations: [], removedOperations: [], hasChanges: false },
      });

      renderDialog({
        entity: entity,
        open: true,
        hasExistingDefinition: true,
        onClose: jest.fn(),
        onSaved: jest.fn(),
      });

      const file = new File(['openapi: 3.0.0'], 'openapi.yaml', {
        type: 'application/yaml',
      });
      fireEvent.change(screen.getByTestId('definition-file-input'), {
        target: { files: [file] },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await screen.findByText('Review Changes');
      const confirmButton = screen.getByRole('button', {
        name: 'Confirm & Save',
      }) as HTMLButtonElement;
      expect(confirmButton.disabled).toBe(true);
      expect(mockWso2Api.upsertDefinition).not.toHaveBeenCalled();
    });

    it('shows an error and stays on the file picker if the diff preview fails', async () => {
      mockWso2Api.previewDefinitionDiff.mockRejectedValue(
        new Error('Could not reach the OpenChoreo gateway'),
      );

      renderDialog({
        entity: entity,
        open: true,
        hasExistingDefinition: true,
        onClose: jest.fn(),
        onSaved: jest.fn(),
      });

      const file = new File(['openapi: 3.0.0'], 'openapi.yaml', {
        type: 'application/yaml',
      });
      fireEvent.change(screen.getByTestId('definition-file-input'), {
        target: { files: [file] },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(
        await screen.findByText('Could not reach the OpenChoreo gateway'),
      ).toBeDefined();
      expect(screen.getByText('Upload Definition')).toBeDefined();
      expect(mockWso2Api.upsertDefinition).not.toHaveBeenCalled();
    });
  });
});
