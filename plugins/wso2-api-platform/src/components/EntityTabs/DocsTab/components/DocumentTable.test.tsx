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

import { fireEvent, render, screen } from '@testing-library/react';
import { Wso2DocumentTable } from './DocumentTable';

// The real Table pulls in react-syntax-highlighter's ESM build, which Jest
// can't parse without extra transform config unrelated to this component —
// stub it with a minimal table that still exercises each column's render().
jest.mock('@backstage/core-components', () => ({
  Table: ({ columns, data }: any) => (
    <table>
      <tbody>
        {data.map((row: any, i: number) => (
          <tr key={i}>
            {columns.map((col: any) => (
              <td key={col.field}>
                {col.render ? col.render(row) : row[col.field]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

const documents = [
  {
    id: 'd1',
    documentId: 'd1',
    name: 'Getting Started',
    type: 'HOWTO',
    sourceType: 'MARKDOWN',
    summary: 'A guide',
  },
] as any;

describe('Wso2DocumentTable', () => {
  it('renders no Actions column when capabilities are omitted (on-prem, unchanged)', () => {
    render(
      <Wso2DocumentTable
        documents={documents}
        onPreview={jest.fn()}
        onDownload={jest.fn()}
      />,
    );

    expect(screen.queryByText('Actions')).toBeNull();
    expect(screen.queryByLabelText(/Edit metadata/)).toBeNull();
    expect(screen.queryByLabelText(/^Delete /)).toBeNull();
  });

  it('renders no Actions column when the store reports no write capabilities', () => {
    render(
      <Wso2DocumentTable
        documents={documents}
        onPreview={jest.fn()}
        onDownload={jest.fn()}
        capabilities={{
          read: true,
          create: false,
          updateMetadata: false,
          updateContent: false,
          delete: false,
        }}
      />,
    );

    expect(screen.queryByText('Actions')).toBeNull();
  });

  it('renders View/Edit/Delete actions when capabilities allow it', () => {
    const onEditMetadata = jest.fn();
    const onDelete = jest.fn();
    const onPreview = jest.fn();

    render(
      <Wso2DocumentTable
        documents={documents}
        onPreview={onPreview}
        onDownload={jest.fn()}
        capabilities={{
          read: true,
          create: true,
          updateMetadata: true,
          updateContent: false,
          delete: true,
        }}
        onEditMetadata={onEditMetadata}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByLabelText('View Getting Started'));
    expect(onPreview).toHaveBeenCalledWith(documents[0]);

    fireEvent.click(screen.getByLabelText('Edit metadata of Getting Started'));
    expect(onEditMetadata).toHaveBeenCalledWith(documents[0]);

    fireEvent.click(screen.getByLabelText('Delete Getting Started'));
    expect(onDelete).toHaveBeenCalledWith(documents[0]);
  });

  it('only renders the Edit action when delete is not permitted', () => {
    render(
      <Wso2DocumentTable
        documents={documents}
        onPreview={jest.fn()}
        onDownload={jest.fn()}
        capabilities={{
          read: true,
          create: true,
          updateMetadata: true,
          updateContent: false,
          delete: false,
        }}
        onEditMetadata={jest.fn()}
      />,
    );

    expect(
      screen.getByLabelText('Edit metadata of Getting Started'),
    ).toBeDefined();
    expect(screen.queryByLabelText('Delete Getting Started')).toBeNull();
  });
});
