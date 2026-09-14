/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PolicyDiffSummary } from './PolicyDiffSummary';

describe('PolicyDiffSummary', () => {
  it('renders added, changed and removed policies grouped by flow and operation', () => {
    render(
      <PolicyDiffSummary
        diff={{
          apiLevel: [
            {
              flow: 'request',
              added: [{ name: 'cors', version: '1' }],
              removed: [],
              changed: [],
            },
          ],
          operations: [
            {
              method: 'GET',
              path: '/books',
              flows: [
                {
                  flow: 'flat',
                  added: [],
                  removed: [{ name: 'old-policy', version: '1' }],
                  changed: [{ name: 'rate-limiting', version: '1' }],
                },
              ],
            },
          ],
          hasChanges: true,
        }}
      />,
    );

    expect(screen.getByText(/\+ Cors \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/~ Rate Limiting \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/- Old Policy \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('GET /books')).toBeInTheDocument();
  });

  it('shows a no-changes message when the diff has nothing to report', () => {
    render(
      <PolicyDiffSummary
        diff={{ apiLevel: [], operations: [], hasChanges: false }}
      />,
    );
    expect(
      screen.getByText('No changes to the policies were detected.'),
    ).toBeInTheDocument();
  });
});
