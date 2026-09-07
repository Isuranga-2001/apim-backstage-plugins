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
import { DeleteDocumentDialog } from './DeleteDocumentDialog';

jest.mock('@backstage/core-plugin-api', () => ({
  useApi: jest.fn(),
  createApiRef: jest.fn().mockReturnValue({}),
}));

const entity: any = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'API',
  metadata: { name: 'orders-api', namespace: 'wso2-gateways' },
};

const document: any = { documentId: 'd1', name: 'Getting Started' };

describe('DeleteDocumentDialog', () => {
  const mockWso2Api = { deleteDocument: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue(mockWso2Api);
  });

  it('shows a permanence warning naming the document', () => {
    render(
      <DeleteDocumentDialog
        entity={entity}
        document={document}
        open
        onClose={jest.fn()}
        onDeleted={jest.fn()}
      />,
    );

    expect(
      screen.getByText(/will be permanently deleted/),
    ).toBeDefined();
    expect(screen.getByText(/"Getting Started"/)).toBeDefined();
  });

  it('calls deleteDocument and onDeleted on confirm', async () => {
    mockWso2Api.deleteDocument.mockResolvedValue(undefined);
    const onDeleted = jest.fn();

    render(
      <DeleteDocumentDialog
        entity={entity}
        document={document}
        open
        onClose={jest.fn()}
        onDeleted={onDeleted}
      />,
    );

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(mockWso2Api.deleteDocument).toHaveBeenCalledWith(
      { kind: 'API', namespace: 'wso2-gateways', name: 'orders-api' },
      'd1',
    );
  });

  it('keeps the dialog open and shows an inline error on failure', async () => {
    mockWso2Api.deleteDocument.mockRejectedValue(new Error('server exploded'));
    const onDeleted = jest.fn();

    render(
      <DeleteDocumentDialog
        entity={entity}
        document={document}
        open
        onClose={jest.fn()}
        onDeleted={onDeleted}
      />,
    );

    fireEvent.click(screen.getByText('Delete'));

    expect(
      await screen.findByText('server exploded', {}, { timeout: 5000 }),
    ).toBeDefined();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    render(
      <DeleteDocumentDialog
        entity={entity}
        document={document}
        open
        onClose={onClose}
        onDeleted={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
