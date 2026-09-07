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
import { AddDocumentDialog } from './AddDocumentDialog';

const mockConfigApi = {
  getOptionalNumber: jest.fn(),
  getOptionalStringArray: jest.fn().mockReturnValue(['pdf', 'txt']),
};
const mockWso2Api = { createDocument: jest.fn() };

jest.mock('@backstage/core-plugin-api', () => ({
  configApiRef: { id: 'core.config' },
  createApiRef: jest.fn().mockReturnValue({}),
  useApi: (apiRef: any) =>
    apiRef.id === 'core.config' ? mockConfigApi : mockWso2Api,
}));

// Monaco needs a real browser layout engine it doesn't get in jsdom; stub it
// with a plain textarea that still round-trips onChange, matching how other
// suites in this repo avoid loading it.
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ value, onChange }: any) => (
    <textarea
      aria-label="markdown-editor"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  ),
}));

jest.mock('@backstage/core-components', () => ({
  MarkdownContent: ({ content }: any) => <div>{content}</div>,
}));

const entity: any = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'API',
  metadata: { name: 'orders-api', namespace: 'wso2-gateways' },
};

describe('AddDocumentDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigApi.getOptionalStringArray.mockReturnValue(['pdf', 'txt']);
    mockConfigApi.getOptionalNumber.mockImplementation((key: string) =>
      key.includes('maxFileSizeMb') ? 10 : 512,
    );
  });

  it('requires a name and content before submitting a MARKDOWN document', () => {
    render(
      <AddDocumentDialog
        entity={entity}
        open
        onClose={jest.fn()}
        onCreated={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Document' }));

    expect(screen.getByText('Name is required.')).toBeDefined();
    expect(mockWso2Api.createDocument).not.toHaveBeenCalled();
  });

  it('creates a MARKDOWN document with the write-mode Monaco editor', async () => {
    mockWso2Api.createDocument.mockResolvedValue({
      documentId: 'd1',
      name: 'Getting Started',
    });
    const onCreated = jest.fn();

    render(
      <AddDocumentDialog
        entity={entity}
        open
        onClose={jest.fn()}
        onCreated={onCreated}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: 'Getting Started' },
    });
    fireEvent.change(screen.getByLabelText('markdown-editor'), {
      target: { value: '# Hello' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Document' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(mockWso2Api.createDocument).toHaveBeenCalledWith(
      { kind: 'API', namespace: 'wso2-gateways', name: 'orders-api' },
      expect.objectContaining({
        name: 'Getting Started',
        sourceType: 'MARKDOWN',
        inlineContent: '# Hello',
      }),
    );
  });

  it('requires an http(s) URL for URL documents', () => {
    render(
      <AddDocumentDialog
        entity={entity}
        open
        onClose={jest.fn()}
        onCreated={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: 'Docs link' },
    });
    fireEvent.click(screen.getByText('URL'));
    fireEvent.change(screen.getByLabelText(/^Source URL/), {
      target: { value: 'not-a-url' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Document' }));

    expect(
      screen.getByText('A valid http:// or https:// URL is required.'),
    ).toBeDefined();
    expect(mockWso2Api.createDocument).not.toHaveBeenCalled();
  });

  it('creates a URL document', async () => {
    mockWso2Api.createDocument.mockResolvedValue({
      documentId: 'd1',
      name: 'Docs link',
    });
    const onCreated = jest.fn();

    render(
      <AddDocumentDialog
        entity={entity}
        open
        onClose={jest.fn()}
        onCreated={onCreated}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: 'Docs link' },
    });
    fireEvent.click(screen.getByText('URL'));
    fireEvent.change(screen.getByLabelText(/^Source URL/), {
      target: { value: 'https://example.com/docs' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Document' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(mockWso2Api.createDocument).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sourceType: 'URL',
        sourceUrl: 'https://example.com/docs',
      }),
    );
  });

  it('requires a file for FILE documents', () => {
    render(
      <AddDocumentDialog
        entity={entity}
        open
        onClose={jest.fn()}
        onCreated={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: 'Spec' },
    });
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByRole('button', { name: 'Add Document' }));

    expect(screen.getByText('A file is required.')).toBeDefined();
    expect(mockWso2Api.createDocument).not.toHaveBeenCalled();
  });

  it('creates a FILE document', async () => {
    mockWso2Api.createDocument.mockResolvedValue({
      documentId: 'd1',
      name: 'Spec',
    });
    const onCreated = jest.fn();

    render(
      <AddDocumentDialog
        entity={entity}
        open
        onClose={jest.fn()}
        onCreated={onCreated}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: 'Spec' },
    });
    fireEvent.click(screen.getByText('File'));

    const file = new File(['hello'], 'spec.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByTestId('file-content-input'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Document' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(mockWso2Api.createDocument).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sourceType: 'FILE', file }),
    );
  });

  it('rejects a disallowed file extension client-side', () => {
    render(
      <AddDocumentDialog
        entity={entity}
        open
        onClose={jest.fn()}
        onCreated={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: 'Spec' },
    });
    fireEvent.click(screen.getByText('File'));

    const file = new File(['bad'], 'malware.exe', {
      type: 'application/octet-stream',
    });
    fireEvent.change(screen.getByTestId('file-content-input'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Document' }));

    expect(screen.getByText(/is not in the allowed list/)).toBeDefined();
    expect(mockWso2Api.createDocument).not.toHaveBeenCalled();
  });
});
