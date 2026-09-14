/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider } from '@material-ui/core/styles';
import { lightTheme } from '@backstage/theme';
import { Wso2PublisherPoliciesList } from './PublisherPoliciesList';

const renderList = (props: React.ComponentProps<typeof Wso2PublisherPoliciesList>) =>
  render(
    <ThemeProvider theme={lightTheme}>
      <Wso2PublisherPoliciesList {...props} />
    </ThemeProvider>,
  );

describe('Wso2PublisherPoliciesList', () => {
  it('shows global policy rows and opens a details dialog on click', () => {
    renderList({
      details: {},
      gatewayApiPolicies: {
        request: [
          {
            policyName: 'rate-limiting',
            policyVersion: '1.0.0',
            parameters: { limit: 10 },
          },
        ],
      },
      gatewayOperations: [],
    });

    expect(screen.getByText('Rate Limiting')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Rate Limiting'));

    // Dialog title repeats the friendly name; parameter renders inside.
    expect(screen.getAllByText('Rate Limiting').length).toBeGreaterThan(1);
    expect(screen.getByText('Limit')).toBeInTheDocument();
  });

  it('renders "No Global API policies found" when there are none', () => {
    renderList({ details: {}, gatewayApiPolicies: {}, gatewayOperations: [] });
    expect(screen.getByText('No Global API policies found.')).toBeInTheDocument();
  });

  it('skips operation-level policies for GraphQL APIs', () => {
    renderList({
      details: {},
      gatewayApiPolicies: {},
      gatewayOperations: [{ method: 'POST', path: '/graphql', policies: [] }],
      apiType: 'GRAPHQL',
    });
    expect(
      screen.getByText('Operational level policies are not supported for GraphQL APIs.'),
    ).toBeInTheDocument();
  });
});
