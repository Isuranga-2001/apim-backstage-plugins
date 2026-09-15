/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EntityWso2ApiPoliciesTab } from './ApiPoliciesTab';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useWso2ApiPolicies } from './hooks/useApiPolicies';
import { usePolicyAccessMode } from './hooks/usePolicyAccessMode';
import { usePolicyArtifact } from './hooks/usePolicyArtifact';
import { usePolicyMutations } from './hooks/usePolicyMutations';
import { ThemeProvider } from '@material-ui/core/styles';
import { lightTheme } from '@backstage/theme';

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

jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: jest.fn(),
}));

jest.mock('@backstage/core-plugin-api', () => ({
  useApi: jest.fn(),
  createApiRef: jest.fn().mockReturnValue({}),
  createRouteRef: jest.fn().mockReturnValue({}),
  createExternalRouteRef: jest.fn().mockReturnValue({}),
  useRouteRef: () => () => '/wso2-api-platform',
  alertApiRef: { id: 'alertApiRef' },
}));

jest.mock('./hooks/useApiPolicies', () => ({
  useWso2ApiPolicies: jest.fn(),
}));

jest.mock('./hooks/usePolicyAccessMode', () => ({
  usePolicyAccessMode: jest.fn(),
}));

jest.mock('./hooks/usePolicyArtifact', () => ({
  usePolicyArtifact: jest.fn(),
}));

jest.mock('./hooks/usePolicyMutations', () => ({
  usePolicyMutations: jest.fn(),
}));

jest.mock('./components/PublisherPoliciesList', () => ({
  Wso2PublisherPoliciesList: () => {
    const React = require('react');
    return React.createElement(
      'div',
      { 'data-testid': 'policies-list' },
      'Policies List',
    );
  },
}));

jest.mock('./components/PolicyEditor', () => ({
  PolicyEditorView: () => {
    const React = require('react');
    return React.createElement(
      'div',
      { 'data-testid': 'policy-editor' },
      'Policy Editor',
    );
  },
}));

describe('EntityWso2ApiPoliciesTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useWso2ApiPolicies as jest.Mock).mockReturnValue({
      details: { apiPolicies: null, operations: [] },
      definition: null,
      isDefinitionLoading: false,
      gatewayOperations: [],
      gatewayApiPolicies: [],
      isPlaceholder: false,
      isRevisionsLoading: false,
    });
    (usePolicyAccessMode as jest.Mock).mockReturnValue({
      mode: 'read-only',
      editingDisabledReason: undefined,
    });
    (usePolicyArtifact as jest.Mock).mockReturnValue({
      artifact: null,
      loading: false,
      error: undefined,
      refresh: jest.fn(),
    });
    (usePolicyMutations as jest.Mock).mockReturnValue({
      submitting: false,
      previewing: false,
      snackbar: { open: false, message: '', severity: 'success' },
      closeSnackbar: jest.fn(),
      upsertPolicies: jest.fn(),
      previewDiff: jest.fn(),
    });
  });

  const renderComponent = () => {
    return render(
      <ThemeProvider theme={lightTheme}>
        <EntityWso2ApiPoliciesTab />
      </ThemeProvider>,
    );
  };

  it('renders nothing if api-id is missing', () => {
    (useEntity as jest.Mock).mockReturnValue({
      entity: {
        metadata: { annotations: {} },
        spec: { type: 'api' },
      },
    });

    const { container } = renderComponent();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders loading state when definition is loading', () => {
    (useEntity as jest.Mock).mockReturnValue({
      entity: {
        metadata: { annotations: { 'wso2.com/api-id': '123' } },
        spec: { type: 'api' },
      },
    });

    (useWso2ApiPolicies as jest.Mock).mockReturnValue({
      isDefinitionLoading: true,
      details: {},
    });

    renderComponent();
    expect(screen.getByText('Loading Policies...')).toBeInTheDocument();
  });

  it('renders placeholder state', () => {
    (useEntity as jest.Mock).mockReturnValue({
      entity: {
        metadata: { annotations: { 'wso2.com/api-id': '123' } },
        spec: { type: 'api' },
      },
    });

    (useWso2ApiPolicies as jest.Mock).mockReturnValue({
      isDefinitionLoading: false,
      isPlaceholder: true,
      details: {},
    });

    renderComponent();
    expect(
      screen.getByText('Syncing with WSO2 Gateway...'),
    ).toBeInTheDocument();
  });

  it('renders empty state if no policies exist', () => {
    (useEntity as jest.Mock).mockReturnValue({
      entity: {
        metadata: { annotations: { 'wso2.com/api-id': '123' } },
        spec: { type: 'api' },
      },
    });

    (useWso2ApiPolicies as jest.Mock).mockReturnValue({
      isDefinitionLoading: false,
      isPlaceholder: false,
      definition: {},
      details: {},
      gatewayOperations: [],
      gatewayApiPolicies: {},
    });

    renderComponent();
    expect(screen.getByText('No Policies')).toBeInTheDocument();
    expect(
      screen.getByText('This API does not have policies available.'),
    ).toBeInTheDocument();
  });

  it('renders PublisherPoliciesList when policies exist', () => {
    (useEntity as jest.Mock).mockReturnValue({
      entity: {
        metadata: { annotations: { 'wso2.com/api-id': '123' } },
        spec: { type: 'api' },
      },
    });

    (useWso2ApiPolicies as jest.Mock).mockReturnValue({
      isDefinitionLoading: false,
      isPlaceholder: false,
      definition: {},
      details: { apiPolicies: { request: [{ policyName: 'test' }] } },
      gatewayOperations: [],
      gatewayApiPolicies: {},
    });

    renderComponent();
    expect(screen.getByTestId('policies-list')).toBeInTheDocument();
  });

  it('renders Discovered API badge for discovered APIs', () => {
    (useEntity as jest.Mock).mockReturnValue({
      entity: {
        metadata: {
          annotations: {
            'wso2.com/api-id': '123',
            'wso2.com/is-discovered': 'true',
          },
        },
        spec: { type: 'api' },
      },
    });

    (useWso2ApiPolicies as jest.Mock).mockReturnValue({
      isDefinitionLoading: false,
      isPlaceholder: false,
      definition: {},
      details: { apiPolicies: { request: [{ policyName: 'test' }] } },
    });

    renderComponent();
    expect(screen.getByText('Discovered API')).toBeInTheDocument();
  });

  it('renders the policy editor for editable (OpenChoreo) APIs', () => {
    (useEntity as jest.Mock).mockReturnValue({
      entity: {
        metadata: {
          annotations: {
            'wso2.com/api-id': '123',
            'wso2.com/api-discovery-type': 'openchoreo-gateway',
          },
        },
        spec: { type: 'api' },
      },
    });

    (usePolicyAccessMode as jest.Mock).mockReturnValue({
      mode: 'editable',
      editingDisabledReason: undefined,
    });

    (useWso2ApiPolicies as jest.Mock).mockReturnValue({
      isDefinitionLoading: false,
      isPlaceholder: false,
      definition: {},
      details: { apiPolicies: { request: [{ policyName: 'test' }] } },
      gatewayOperations: [],
      gatewayApiPolicies: {},
    });

    (usePolicyArtifact as jest.Mock).mockReturnValue({
      artifact: {
        apiPolicies: { request: [{ name: 'cors', version: 'v1' }] },
        operations: [{ method: 'GET', path: '/books', policies: [] }],
      },
      loading: false,
      error: undefined,
      refresh: jest.fn(),
    });

    renderComponent();
    expect(screen.getByTestId('policy-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('policies-list')).not.toBeInTheDocument();
  });

  it('renders the policy editor once the live artifact loads, even with no policies/operations yet (a fresh API)', () => {
    (useEntity as jest.Mock).mockReturnValue({
      entity: {
        metadata: {
          annotations: {
            'wso2.com/api-id': '123',
            'wso2.com/api-discovery-type': 'openchoreo-gateway',
          },
        },
        spec: { type: 'api' },
      },
    });

    (usePolicyAccessMode as jest.Mock).mockReturnValue({
      mode: 'editable',
      editingDisabledReason: undefined,
    });

    (useWso2ApiPolicies as jest.Mock).mockReturnValue({
      isDefinitionLoading: false,
      isPlaceholder: false,
      definition: {},
      details: { apiPolicies: null, operations: [] },
      gatewayOperations: [],
      gatewayApiPolicies: {},
    });

    (usePolicyArtifact as jest.Mock).mockReturnValue({
      artifact: { apiPolicies: [], operations: [] },
      loading: false,
      error: undefined,
      refresh: jest.fn(),
    });

    renderComponent();
    expect(screen.getByTestId('policy-editor')).toBeInTheDocument();
  });
});
