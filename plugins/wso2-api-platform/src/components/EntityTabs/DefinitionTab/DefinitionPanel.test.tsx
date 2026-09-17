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

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { DefinitionPanel } from './DefinitionPanel';
import { useApiDefinition } from './hooks/useApiDefinition';
import { useApiDefinitionSource } from './hooks/useApiDefinitionSource';
import { useDefinitionMutations } from './hooks/useDefinitionMutations';
import { useGatewayStatus } from '../../common/useGatewayStatus';
import { useGatewayWriteOperationsEnabled } from '../../common/useGatewayWriteAccess';

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('@backstage/core-components', () => ({
  InfoCard: ({ children }: any) => {
    const React = require('react');
    return React.createElement('div', null, children);
  },
  EmptyState: ({ title, description }: any) => {
    const React = require('react');
    return React.createElement(
      'div',
      null,
      React.createElement('div', null, title || ''),
      React.createElement('div', null, description || ''),
    );
  },
}));

jest.mock('@backstage/core-plugin-api', () => ({
  useRouteRef: () => () => '/wso2-api-platform',
  createRouteRef: jest.fn().mockReturnValue({}),
  createExternalRouteRef: jest.fn().mockReturnValue({}),
}));

jest.mock('./hooks/useApiDefinition', () => ({
  useApiDefinition: jest.fn(),
}));

jest.mock('./hooks/useApiDefinitionSource', () => ({
  useApiDefinitionSource: jest.fn(),
}));

jest.mock('./hooks/useDefinitionMutations', () => ({
  useDefinitionMutations: jest.fn(),
}));

jest.mock('../../common/useGatewayStatus', () => ({
  useGatewayStatus: jest.fn(),
}));

jest.mock('../../common/useGatewayWriteAccess', () => ({
  useGatewayWriteOperationsEnabled: jest.fn(),
}));

jest.mock('./DefinitionUploadDialog', () => ({
  DefinitionUploadDialog: () => null,
}));

jest.mock('./DeleteDefinitionDialog', () => ({
  DeleteDefinitionDialog: ({ onDeleted }: any) => (
    <button onClick={onDeleted}>Confirm Delete</button>
  ),
}));

jest.mock('./ApiDefinitionViewer', () => ({
  ApiDefinitionViewer: ({
    onSaveClick,
    onDeleteClick,
    showSavingWaitDialog,
  }: any) => (
    <div>
      <span data-testid="show-saving-wait-dialog">
        {String(showSavingWaitDialog)}
      </span>
      <button onClick={() => onSaveClick?.('new content')}>Save</button>
      {onDeleteClick && <button onClick={onDeleteClick}>Delete</button>}
    </div>
  ),
}));

const ENTITY = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'API',
  metadata: {
    name: 'orders-api',
    namespace: 'wso2-gateways',
    annotations: {
      'wso2.com/api-discovery-type': 'api-platform-gateway',
    },
  },
  spec: { type: 'openapi', lifecycle: 'production', owner: '' },
} as any;

describe('DefinitionPanel', () => {
  const navigate = jest.fn();
  const refresh = jest.fn();
  const upsertDefinition = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigate as jest.Mock).mockReturnValue(navigate);
    (useApiDefinitionSource as jest.Mock).mockReturnValue({ mode: 'store' });
    (useApiDefinition as jest.Mock).mockReturnValue({
      definition: { content: 'openapi: 3.0.0', fileName: 'definition.yaml' },
      capabilities: { read: true, write: true, delete: true },
      refresh,
    });
    (useDefinitionMutations as jest.Mock).mockReturnValue({
      upsertDefinition,
      previewDiff: jest.fn(),
    });
    (useGatewayStatus as jest.Mock).mockReturnValue({
      applicable: false,
      active: true,
    });
  });

  it('does not navigate home and refreshes in place when gateway write operations are disabled (default)', async () => {
    (useGatewayWriteOperationsEnabled as jest.Mock).mockReturnValue(false);

    render(<DefinitionPanel entity={ENTITY} />);
    expect(screen.getByTestId('show-saving-wait-dialog').textContent).toBe(
      'false',
    );

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
  });

  it('navigates home after a save that pushes to the gateway once write operations are enabled', async () => {
    (useGatewayWriteOperationsEnabled as jest.Mock).mockReturnValue(true);

    render(<DefinitionPanel entity={ENTITY} />);
    expect(screen.getByTestId('show-saving-wait-dialog').textContent).toBe(
      'true',
    );

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/wso2-api-platform'),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  describe('deletion', () => {
    beforeEach(() => {
      (useGatewayWriteOperationsEnabled as jest.Mock).mockReturnValue(false);
    });

    it('shows a Delete button that opens the delete-confirmation dialog', () => {
      render(<DefinitionPanel entity={ENTITY} />);

      expect(screen.queryByText('Confirm Delete')).toBeNull();
      fireEvent.click(screen.getByText('Delete'));

      expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
    });

    it('does not show a Delete button when the definition store does not allow it', () => {
      (useApiDefinition as jest.Mock).mockReturnValue({
        definition: { content: 'openapi: 3.0.0', fileName: 'definition.yaml' },
        capabilities: { read: true, write: true, delete: false },
        refresh,
      });

      render(<DefinitionPanel entity={ENTITY} />);

      expect(screen.queryByText('Delete')).toBeNull();
    });
  });
});
