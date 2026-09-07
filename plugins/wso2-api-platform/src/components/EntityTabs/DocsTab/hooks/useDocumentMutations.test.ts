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

import { act, renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { useDocumentMutations } from './useDocumentMutations';

jest.mock('@backstage/core-plugin-api', () => ({
  useApi: jest.fn(),
  createApiRef: jest.fn().mockReturnValue({}),
}));

const entity: any = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'API',
  metadata: { name: 'orders-api', namespace: 'wso2-gateways' },
};

describe('useDocumentMutations', () => {
  const mockWso2Api = {
    createDocument: jest.fn(),
    updateDocumentMetadata: jest.fn(),
    deleteDocument: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue(mockWso2Api);
  });

  it('creates a document and shows a success snackbar', async () => {
    mockWso2Api.createDocument.mockResolvedValue({
      documentId: 'd1',
      name: 'Doc',
    });

    const { result } = renderHook(() => useDocumentMutations(entity));

    await act(async () => {
      await result.current.createDocument({
        name: 'Doc',
        type: 'HOWTO',
        sourceType: 'URL',
        sourceUrl: 'https://example.com',
      });
    });

    expect(mockWso2Api.createDocument).toHaveBeenCalledWith(
      { kind: 'API', namespace: 'wso2-gateways', name: 'orders-api' },
      expect.objectContaining({ name: 'Doc' }),
    );
    await waitFor(() =>
      expect(result.current.snackbar).toMatchObject({
        open: true,
        severity: 'success',
      }),
    );
  });

  it('surfaces a failed create as an error snackbar and rethrows', async () => {
    mockWso2Api.createDocument.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useDocumentMutations(entity));

    await act(async () => {
      await expect(
        result.current.createDocument({
          name: 'Doc',
          type: 'HOWTO',
          sourceType: 'URL',
          sourceUrl: 'https://example.com',
        }),
      ).rejects.toThrow('boom');
    });

    expect(result.current.snackbar).toMatchObject({
      open: true,
      message: 'boom',
      severity: 'error',
    });
  });

  it('updates document metadata', async () => {
    mockWso2Api.updateDocumentMetadata.mockResolvedValue({
      documentId: 'd1',
      name: 'Doc',
    });

    const { result } = renderHook(() => useDocumentMutations(entity));

    await act(async () => {
      await result.current.updateDocumentMetadata('d1', { summary: 'x' });
    });

    expect(mockWso2Api.updateDocumentMetadata).toHaveBeenCalledWith(
      { kind: 'API', namespace: 'wso2-gateways', name: 'orders-api' },
      'd1',
      { summary: 'x' },
    );
  });

  it('deletes a document', async () => {
    mockWso2Api.deleteDocument.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDocumentMutations(entity));

    await act(async () => {
      await result.current.deleteDocument('d1', 'Doc');
    });

    expect(mockWso2Api.deleteDocument).toHaveBeenCalledWith(
      { kind: 'API', namespace: 'wso2-gateways', name: 'orders-api' },
      'd1',
    );
    expect(result.current.snackbar).toMatchObject({
      open: true,
      message: 'Document "Doc" deleted.',
      severity: 'success',
    });
  });

  it('resets the snackbar when closeSnackbar is called', async () => {
    mockWso2Api.deleteDocument.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDocumentMutations(entity));

    await act(async () => {
      await result.current.deleteDocument('d1', 'Doc');
    });
    act(() => {
      result.current.closeSnackbar();
    });

    expect(result.current.snackbar.open).toBe(false);
  });
});
