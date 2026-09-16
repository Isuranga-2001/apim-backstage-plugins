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
import { ApiDefinitionViewer } from './ApiDefinitionViewer';

jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: () => <div data-testid="monaco-editor" />,
}));

jest.mock('./SwaggerDefinitionPreview', () => ({
  SwaggerDefinitionPreview: ({ onValidityChange }: any) => (
    <div data-testid="swagger-definition-preview">
      <button onClick={() => onValidityChange(true)}>simulate-error</button>
      <button onClick={() => onValidityChange(false)}>simulate-valid</button>
    </div>
  ),
}));

const VALUE = 'openapi: 3.0.0\ninfo:\n  title: Orders\n';

describe('ApiDefinitionViewer', () => {
  it('disables Save once the Swagger preview reports an error, and re-enables it once fixed', () => {
    render(<ApiDefinitionViewer value={VALUE} onSaveClick={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeEnabled();

    fireEvent.click(screen.getByText('simulate-error'));
    expect(saveButton).toBeDisabled();

    fireEvent.click(screen.getByText('simulate-valid'));
    expect(saveButton).toBeEnabled();
  });

  it('resets the error state after cancelling and re-entering edit mode', () => {
    render(<ApiDefinitionViewer value={VALUE} onSaveClick={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByText('simulate-error'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('does not show the Swagger preview outside edit mode', () => {
    render(<ApiDefinitionViewer value={VALUE} onSaveClick={jest.fn()} />);
    expect(screen.queryByTestId('swagger-definition-preview')).toBeNull();
  });

  it('shows the "Applying Changes" wait screen by default while a save is pending', async () => {
    let resolveSave: () => void = () => {};
    const onSaveClick = jest.fn(
      () =>
        new Promise<void>(resolve => {
          resolveSave = resolve;
        }),
    );
    render(<ApiDefinitionViewer value={VALUE} onSaveClick={onSaveClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const dialogSaveButtons = screen.getAllByRole('button', { name: 'Save' });
    fireEvent.click(dialogSaveButtons[dialogSaveButtons.length - 1]);

    expect(await screen.findByText('Applying Changes')).toBeInTheDocument();
    expect(
      screen.getByText(/Saving the definition and syncing the catalog/),
    ).toBeInTheDocument();

    resolveSave();
    await waitFor(() => expect(onSaveClick).toHaveBeenCalled());
  });

  it('skips the wait screen and closes the confirm dialog immediately once a DB-only save resolves, when showSavingWaitDialog is false', async () => {
    const onSaveClick = jest.fn().mockResolvedValue(undefined);
    render(
      <ApiDefinitionViewer
        value={VALUE}
        onSaveClick={onSaveClick}
        showSavingWaitDialog={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const dialogSaveButtons = screen.getAllByRole('button', { name: 'Save' });
    fireEvent.click(dialogSaveButtons[dialogSaveButtons.length - 1]);

    await waitFor(() => expect(onSaveClick).toHaveBeenCalled());
    expect(screen.queryByText('Applying Changes')).toBeNull();
    await waitFor(() => {
      expect(screen.queryByText('Save Definition')).toBeNull();
    });
  });
});
