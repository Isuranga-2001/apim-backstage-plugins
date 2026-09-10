/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
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
import { render, screen } from '@testing-library/react';
import { EntityWso2OverviewTab } from './OverviewTab';

// Scope variable to dynamically control entity properties in test cases
let mockEntity: any;

// Mock @backstage/plugin-catalog-react directly to avoid loading ESM dependencies like react-use
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({
    entity: mockEntity,
  }),
  catalogApiRef: {
    id: 'plugin.catalog.service',
  },
  entityRouteRef: {
    id: 'catalog:entity',
  },
}));

// Mock @backstage/core-plugin-api directly to be fully sandboxed
jest.mock('@backstage/core-plugin-api', () => ({
  createApiRef: (options: any) => options,
  useApi: () => ({
    getServiceUsage: jest.fn(),
    getEntities: jest.fn(),
  }),
  useRouteRef: () => (params: any) =>
    `/catalog/${params.namespace}/${params.kind}/${params.name}`,
}));

// Mock @backstage/plugin-catalog and @backstage/core-components to avoid ESM transpilation failures with transitive dependencies like react-syntax-highlighter
jest.mock('@backstage/plugin-catalog', () => ({
  AboutField: (props: any) => (
    <div
      data-testid={`about-field-${props.label
        .toLowerCase()
        .replace(/\s+/g, '-')}`}
    >
      <span className="label">{props.label}</span>
      <span className="value">{props.value}</span>
    </div>
  ),
}));

jest.mock('@backstage/core-components', () => ({
  InfoCard: (props: any) => (
    <div data-testid="info-card">
      {props.subheader}
      {props.children}
    </div>
  ),
  HeaderIconLinkRow: (props: any) => (
    <div data-testid="header-icon-links">
      {props.links?.map((link: any, idx: number) => (
        <a key={idx} href={link.href}>
          {link.label}
        </a>
      ))}
    </div>
  ),
}));

describe('EntityWso2AboutCard', () => {
  beforeEach(() => {
    mockEntity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: {
        name: 'test-api',
        title: 'Test API Title',
        description: 'This is a test WSO2 API description.',
        annotations: {
          'wso2.com/api-lifecycle-status': 'PUBLISHED',
          'wso2.com/api-context': '/test-context',
          'wso2.com/api-version': '1.0.0',
          'wso2.com/api-endpoints': JSON.stringify([
            {
              environmentName: 'Production',
              urls: ['https://gw.wso2.com/test-context/1.0.0'],
            },
          ]),
          'wso2.com/business-owner': 'John Doe',
          'wso2.com/business-owner-email': 'john@wso2.com',
          'wso2.com/technical-owner': 'Jane Smith',
          'wso2.com/technical-owner-email': 'jane@wso2.com',
        },
      },
      spec: {
        type: 'openapi',
      },
    };
  });

  it('should render all standard about card fields successfully', () => {
    render(<EntityWso2OverviewTab />);

    expect(screen.getByText('Display Name')).toBeDefined();
    expect(screen.getByText('Test API Title')).toBeDefined();

    // Lifecycle
    expect(screen.getByText('Lifecycle')).toBeDefined();
    expect(screen.getByText('PUBLISHED')).toBeDefined();

    // Context & Version
    expect(screen.getByText('Context')).toBeDefined();
    expect(screen.getByText('/test-context')).toBeDefined();
    expect(screen.getByText('Version')).toBeDefined();
    expect(screen.getByText('1.0.0')).toBeDefined();

    // Description
    expect(screen.getByText('Description')).toBeDefined();
    expect(
      screen.getByText('This is a test WSO2 API description.'),
    ).toBeDefined();

    // Gateway URL
    expect(screen.getByText('Gateway')).toBeDefined();
    expect(
      screen.getByText('Production (https://gw.wso2.com/test-context/1.0.0)'),
    ).toBeDefined();

    // TechDocs header vertical links
    expect(screen.getByText('View TechDocs')).toBeDefined();
    const link = screen.getByRole('link', {
      name: 'View TechDocs',
    }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(
      '/catalog/default/api/test-api/wso2',
    );
  });

  it('should render Gateway as "Unknown" if api-endpoints JSON is completely malformed', () => {
    mockEntity.metadata.annotations['wso2.com/api-endpoints'] =
      '{invalid-json}';
    render(<EntityWso2OverviewTab />);

    expect(screen.getByText('Gateway')).toBeDefined();
    expect(screen.getByText('Unknown')).toBeDefined();
  });

  it('should not render Gateway if api-endpoints array is empty and api-gateway is absent', () => {
    mockEntity.metadata.annotations['wso2.com/api-endpoints'] = JSON.stringify(
      [],
    );
    render(<EntityWso2OverviewTab />);

    expect(screen.queryByText('Gateway')).toBeNull();
  });

  it('should render Gateway from api-gateway when api-endpoints array is empty', () => {
    mockEntity.metadata.annotations['wso2.com/api-endpoints'] = JSON.stringify(
      [],
    );
    mockEntity.metadata.annotations['wso2.com/api-gateway'] = 'wso2';
    render(<EntityWso2OverviewTab />);

    expect(screen.getByText('Gateway')).toBeDefined();
    expect(screen.getByText('WSO2')).toBeDefined();
  });

  it('should support Gateway endpoints defined with string urls instead of array', () => {
    mockEntity.metadata.annotations['wso2.com/api-endpoints'] = JSON.stringify([
      {
        environmentName: 'Sandbox',
        urls: 'https://sandbox.gw.wso2.com/test',
      },
    ]);
    render(<EntityWso2OverviewTab />);

    expect(screen.getByText('Gateway')).toBeDefined();
    expect(
      screen.getByText('Sandbox (https://sandbox.gw.wso2.com/test)'),
    ).toBeDefined();
  });

  it('should support annotations prefixed with wso2-gateway.com/ as fallback', () => {
    mockEntity.metadata.annotations = {
      'wso2-gateway.com/api-lifecycle-status': 'DEPRECATED',
      'wso2-gateway.com/api-context': '/fallback-context',
      'wso2-gateway.com/api-version': '2.0.0',
    };
    render(<EntityWso2OverviewTab />);

    expect(screen.getByText('DEPRECATED')).toBeDefined();
    expect(screen.getByText('/fallback-context')).toBeDefined();
    expect(screen.getByText('2.0.0')).toBeDefined();
  });

  it('should fallback display name to entity name if title is completely absent', () => {
    delete mockEntity.metadata.title;
    render(<EntityWso2OverviewTab />);

    expect(screen.getAllByText('test-api').length).toBe(1);
  });

  it('should render safely if optional annotations and description are absent', () => {
    mockEntity.metadata.annotations = {};
    delete mockEntity.metadata.description;
    render(<EntityWso2OverviewTab />);

    expect(screen.getByText('Display Name')).toBeDefined();
    expect(screen.getByText('Test API Title')).toBeDefined();

    // Check that optional fields are not rendered
    expect(screen.queryByText('Lifecycle')).toBeNull();
    expect(screen.queryByText('Context')).toBeNull();
    expect(screen.queryByText('Version')).toBeNull();
    expect(screen.queryByText('Gateway')).toBeNull();

    expect(screen.queryByText('Description')).toBeNull();
  });

  it('should display values from explicit WSO2 annotations', () => {
    mockEntity.metadata.annotations = {
      'wso2.com/api-version': '1.2.3',
      'wso2.com/api-context': '/annotation-context',
      'wso2.com/api-lifecycle-status': 'PUBLISHED',
      'wso2.com/api-provider': 'annotation-provider',
    };
    mockEntity.metadata.description = 'Description from catalog metadata';
    render(<EntityWso2OverviewTab />);

    expect(screen.getByText('Version')).toBeDefined();
    expect(screen.getByText('1.2.3')).toBeDefined();
    expect(screen.getByText('Context')).toBeDefined();
    expect(screen.getByText('/annotation-context')).toBeDefined();
    expect(screen.getByText('Lifecycle')).toBeDefined();
    expect(screen.getByText('PUBLISHED')).toBeDefined();
    expect(screen.getByText('Provider')).toBeDefined();
    expect(screen.getByText('annotation-provider')).toBeDefined();

    expect(screen.getByText('Description')).toBeDefined();
    expect(screen.getByText('Description from catalog metadata')).toBeDefined();
  });

  it('should support array, string, and invalid JSON values for api-security-scheme', () => {
    // 1. Array case
    mockEntity.metadata.annotations = {
      'wso2.com/api-security-scheme': JSON.stringify(['OAuth2', 'APIKey']),
    };
    const { rerender } = render(<EntityWso2OverviewTab />);
    expect(screen.getByText('Security Scheme')).toBeDefined();
    expect(screen.getByText('OAuth2, APIKey')).toBeDefined();

    // 2. String case
    mockEntity.metadata.annotations = {
      'wso2.com/api-security-scheme': JSON.stringify('MutualSSL'),
    };
    rerender(<EntityWso2OverviewTab />);
    expect(screen.getByText('MutualSSL')).toBeDefined();

    // 3. Invalid JSON case
    mockEntity.metadata.annotations = {
      'wso2.com/api-security-scheme': '{invalid-json',
    };
    rerender(<EntityWso2OverviewTab />);
    expect(screen.queryByText('Security Scheme')).toBeNull();
  });
});
