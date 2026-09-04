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

import { Entity } from '@backstage/catalog-model';
import Wso2PulseIconUrl from '../assets/wso2-pulse.svg';
import {
  ApiBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  ExtensionDefinition,
  fetchApiRef,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import {
  EntityCardBlueprint,
  EntityContentBlueprint,
  EntityHeaderBlueprint,
} from '@backstage/plugin-catalog-react/alpha';
import { rootRouteRef } from '../routes';
import { Wso2ApiPlatformClient, wso2ApiPlatformApiRef } from '../api';
import { isMcpEntity, isServiceEntity } from '../utils';

const isWso2ApiEntity = (entity?: Entity): boolean =>
  entity?.kind?.toLowerCase() === 'api' &&
  Boolean(
    entity.metadata.annotations?.['wso2.com/api-id'] ||
      entity.metadata.annotations?.['wso2-gateway.com/api-id'],
  );

const GATEWAY_DISCOVERY_TYPES = new Set([
  'self-hosted-gateway',
  'openchoreo-gateway',
]);

const isSelfHostedGatewayEntity = (entity?: Entity): boolean =>
  GATEWAY_DISCOVERY_TYPES.has(
    entity?.metadata.annotations?.['wso2.com/api-discovery-type'] ?? '',
  );

const isApiPlatformEntity = (entity?: Entity): boolean =>
  !!entity?.metadata.annotations?.['wso2.com/platform-gateway-endpoints'];

const isWso2ApiEntityExceptService = (entity?: Entity): boolean =>
  isWso2ApiEntity(entity) && !isServiceEntity(entity!);

const isWso2ApiEntityExceptServiceAndMcp = (entity?: Entity): boolean =>
  isWso2ApiEntityExceptService(entity) && !isMcpEntity(entity!);

export const entityWso2OverviewContent: ExtensionDefinition =
  EntityContentBlueprint.make({
    name: 'wso2-overview',
    params: {
      path: '/',
      title: 'Overview',
      group: 'wso2-overview',
      filter: isWso2ApiEntity,
      loader: () =>
        import('../components/EntityTabs/OverviewTab').then(m => (
          <m.EntityWso2OverviewTab />
        )),
    },
  });

export const entityWso2PoliciesContent: ExtensionDefinition =
  EntityContentBlueprint.make({
    name: 'wso2-policies',
    params: {
      path: '/policies',
      title: 'Policies',
      group: 'wso2-policies',
      filter: isWso2ApiEntityExceptServiceAndMcp,
      loader: () =>
        import('../components/EntityTabs/PoliciesTab').then(m => (
          <m.EntityWso2ApiPoliciesTab />
        )),
    },
  });

export const entityWso2DocsContent: ExtensionDefinition =
  EntityContentBlueprint.make({
    name: 'wso2-docs',
    params: {
      path: '/docs',
      title: 'Docs',
      group: 'wso2-docs',
      filter: isWso2ApiEntityExceptService,
      loader: () =>
        import('../components/EntityTabs/DocsTab').then(m => (
          <m.EntityWso2DocumentsCard />
        )),
    },
  });

export const entityWso2McpToolingContent: ExtensionDefinition =
  EntityContentBlueprint.make({
    name: 'wso2-tools',
    params: {
      path: '/tools',
      title: 'Tools',
      group: 'wso2-tools',
      filter: e =>
        isWso2ApiEntity(e) && !isSelfHostedGatewayEntity(e) && isMcpEntity(e!),
      loader: () =>
        import('../components/EntityTabs/DefinitionTab').then(m => (
          <m.EntityWso2McpToolsTab />
        )),
    },
  });

export const entityWso2TryOutContent: ExtensionDefinition =
  EntityContentBlueprint.make({
    name: 'wso2-try-out',
    params: {
      path: '/try-out',
      title: 'Try Out',
      group: 'wso2-try-out',
      filter: e =>
        isWso2ApiEntityExceptServiceAndMcp(e) && !isApiPlatformEntity(e),
      loader: () =>
        import('../components/EntityTabs/TryOutTab').then(m => (
          <m.EntityWso2TryOutTab />
        )),
    },
  });

export const entityWso2ServiceDefinitionContent: ExtensionDefinition =
  EntityContentBlueprint.make({
    name: 'wso2-service-definition',
    params: {
      path: '/definition',
      title: 'Definition',
      group: 'wso2-service-definition',
      filter: isServiceEntity,
      loader: () =>
        import('../components/EntityTabs/DefinitionTab').then(m => (
          <m.EntityWso2ServiceDefinitionCard />
        )),
    },
  });

export const entityWso2DefinitionContent: ExtensionDefinition =
  EntityContentBlueprint.make({
    name: 'wso2-definition',
    params: {
      path: '/definition',
      title: 'Definition',
      group: 'wso2-definition',
      filter: e => {
        return (
          isWso2ApiEntityExceptServiceAndMcp(e) && !isSelfHostedGatewayEntity(e)
        );
      },
      loader: () =>
        import('../components/EntityTabs/DefinitionTab').then(m => (
          <m.EntityWso2ApiDefinitionTab />
        )),
    },
  });

/** @alpha */
export const entityWso2Header: ExtensionDefinition = EntityHeaderBlueprint.make(
  {
    name: 'wso2-header',
    params: {
      filter: isWso2ApiEntity,
      loader: () =>
        import('../components/common/EntityHeader').then(m => (
          <m.Wso2EntityHeader />
        )),
    },
  },
);

/** @alpha */
export const wso2ApiPlatformApi: ExtensionDefinition = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: wso2ApiPlatformApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        new Wso2ApiPlatformClient({ discoveryApi, fetchApi }),
    }),
});

/** @alpha */
export const wso2ApiPlatformPage: ExtensionDefinition = PageBlueprint.make({
  params: {
    path: '/wso2-api-platform',
    title: 'WSO2 API Platform',
    icon: (
      <img
        src={Wso2PulseIconUrl}
        alt="WSO2 Pulse"
        style={{ width: 24, height: 24 }}
      />
    ),
    routeRef: rootRouteRef,
    noHeader: true,
    loader: () =>
      import('../components/ApiManagerPage').then(m => (
        <m.Wso2ApiPlatformPage />
      )),
  },
});

/** @alpha */
export const entityWso2ApiDefinitionCard: ExtensionDefinition =
  EntityCardBlueprint.make({
    name: 'definition',
    params: {
      filter: { kind: 'API' },
      loader: () =>
        import('../components/EntityTabs/TryOutTab').then(m => (
          <m.EntityWso2TryOutTab />
        )),
    },
  });

/** @alpha */
export const entityWso2DocumentsCard: ExtensionDefinition =
  EntityCardBlueprint.make({
    name: 'documents',
    params: {
      filter: { kind: 'API' },
      loader: () =>
        import('../components/EntityTabs/DocsTab').then(m => (
          <m.EntityWso2DocumentsCard />
        )),
    },
  });

/** @alpha */
export const entityWso2OverviewCard: ExtensionDefinition =
  EntityCardBlueprint.make({
    name: 'wso2-about',
    params: {
      filter: { kind: 'API' },
      loader: () =>
        import('../components/EntityTabs/OverviewTab').then(m => (
          <m.EntityWso2OverviewTab />
        )),
    },
  });

/** @alpha */
export const entityWso2McpToolsCard: ExtensionDefinition =
  EntityCardBlueprint.make({
    name: 'mcp-tools',
    params: {
      filter: { kind: 'API' },
      loader: () =>
        import('../components/EntityTabs/DefinitionTab').then(m => (
          <m.EntityWso2McpToolsTab />
        )),
    },
  });

/** @alpha */
export const entityWso2TryOutTab: ExtensionDefinition =
  EntityCardBlueprint.make({
    name: 'try-out',
    params: {
      filter: { kind: 'API' },
      loader: () =>
        import('../components/EntityTabs/TryOutTab').then(m => (
          <m.EntityWso2TryOutTab />
        )),
    },
  });

const extensions = [
  wso2ApiPlatformApi as any,
  wso2ApiPlatformPage as any,
  entityWso2Header as any,

  entityWso2OverviewContent as any,
  entityWso2McpToolingContent as any,
  entityWso2PoliciesContent as any,
  entityWso2TryOutContent as any,
  entityWso2TryOutTab as any,
  entityWso2DocsContent as any,
  entityWso2ServiceDefinitionContent as any,
  entityWso2DefinitionContent as any,

  entityWso2ApiDefinitionCard as any,
  entityWso2DocumentsCard as any,
  entityWso2OverviewCard as any,
  entityWso2McpToolsCard as any,
];

/** @alpha */
export default createFrontendPlugin({
  pluginId: 'wso2-api-platform',
  extensions,
});
