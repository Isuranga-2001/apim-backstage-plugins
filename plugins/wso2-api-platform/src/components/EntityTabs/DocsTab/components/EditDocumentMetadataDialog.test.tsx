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
import { useApi } from '@backstage/core-plugin-api';
import { EditDocumentMetadataDialog } from './EditDocumentMetadataDialog';

jest.mock('@backstage/core-plugin-api', () => ({
  useApi: jest.fn(),
  createApiRef: jest.fn().mockReturnValue({}),
}));

const entity: any = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'API',
  metadata: { name: 'orders-api', namespace: 'wso2-gateways' },
};

describe('EditDocumentMetadataDialog', () => {
  const mockWso2Api = { updateDocumentMetadata: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue(mockWso2Api);
  });

  it('pre-fills the form and saves the patch', async () => {
    mockWso2Api.updateDocumentMetadata.mockResolvedValue({
      documentId: 'd1',
      name: 'Doc',
    });
    const onUpdated = jest.fn();

    render(
      <EditDocumentMetadataDialog
        entity={entity}
        document={
          {
            documentId: 'd1',
            name: 'Doc',
            type: 'HOWTO',
            sourceType: 'MARKDOWN',
            summary: 'old summary',
          } as any
        }
        open
        onClose={jest.fn()}
        onUpdated={onUpdated}
      />,
    );

    expect(screen.getByDisplayValue('Doc')).toBeDefined();
    expect(screen.queryByLabelText('Source URL')).toBeNull();

    fireEvent.change(screen.getByDisplayValue('old summary'), {
      target: { value: 'new summary' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    expect(mockWso2Api.updateDocumentMetadata).toHaveBeenCalledWith(
      { kind: 'API', namespace: 'wso2-gateways', name: 'orders-api' },
      'd1',
      expect.objectContaining({ summary: 'new summary' }),
    );
  });

  it('shows an editable sourceUrl field only for URL documents (OQ-1)', () => {
    render(
      <EditDocumentMetadataDialog
        entity={entity}
        document={
          {
            documentId: 'd1',
            name: 'Doc',
            type: 'HOWTO',
            sourceType: 'URL',
            sourceUrl: 'https://example.com/old',
          } as any
        }
        open
        onClose={jest.fn()}
        onUpdated={jest.fn()}
      />,
    );

    expect(screen.getByDisplayValue('https://example.com/old')).toBeDefined();
  });

  it('requires otherTypeName when renaming type to OTHER', async () => {
    render(
      <EditDocumentMetadataDialog
        entity={entity}
        document={
          {
            documentId: 'd1',
            name: 'Doc',
            type: 'HOWTO',
            sourceType: 'MARKDOWN',
          } as any
        }
        open
        onClose={jest.fn()}
        onUpdated={jest.fn()}
      />,
    );

    fireEvent.mouseDown(screen.getByText('How To'));
    fireEvent.click(await screen.findByRole('option', { name: 'Other' }));
    fireEvent.click(screen.getByText('Save'));

    expect(
      screen.getByText("Other type name is required when type is 'Other'."),
    ).toBeDefined();
    expect(mockWso2Api.updateDocumentMetadata).not.toHaveBeenCalled();
  });
});
