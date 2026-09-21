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
import { ConflictError, InputError, NotAllowedError } from '@backstage/errors';
import { mockServices } from '@backstage/backend-test-utils';
import JSZip from 'jszip';
import {
  buildDocsZip,
  buildPortalMetadata,
  preparePublish,
  publishApiToPortal,
} from './publishService';
import { ApiPortalConfig } from './config';
import { ApiRef } from '../documents/types';
import { RestApiArtifact } from '../documents/restApiArtifactMapper';

const CONFIG: ApiPortalConfig = {
  enabled: true,
  baseUrl: 'https://portal.example.com',
  basePath: '/api-portal/api/v0.9',
  auth: { mode: 'platform-login' },
  defaults: {
    status: 'PUBLISHED',
    subscriptionPlans: [],
    agentVisibility: 'VISIBLE',
  },
  requestTimeoutSeconds: 30,
  tls: { rejectUnauthorized: true },
};

const API_REF: ApiRef = {
  sourceKind: 'gateway',
  gatewayId: 'oc-dev',
  apiId: 'payment-api-service-v1.0',
  entityRef: 'api:wso2-gateways/payment-api',
};

const ENTITY: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'API',
  metadata: {
    name: 'payment-api',
    namespace: 'wso2-gateways',
    tags: ['gateway-oc-dev'],
    annotations: {},
  },
  spec: { type: 'openapi', lifecycle: 'production', owner: '' },
};

const DISCOVERED_ARTIFACT = {
  kind: 'RestApi',
  metadata: { name: 'payment-api-service-v1.0' },
  spec: { displayName: 'Payment API', version: '1.0.0', operations: [] },
};

const DEFINITION = {
  content:
    'openapi: 3.0.0\ninfo:\n  title: Payment API\n  version: 1.0.0\npaths: {}\n',
  format: 'YAML' as const,
  fileName: 'definition.yaml',
};

function buildClient(overrides: { getGatewayApiDetail?: jest.Mock } = {}) {
  return {
    getConfig: jest.fn().mockReturnValue({
      platformGateways: [
        {
          name: 'oc-dev',
          managementApiUrl: 'http://localhost:9095/rest-apis',
          managementApiAuth: undefined,
        },
      ],
    }),
    getGatewayApiDetail:
      overrides.getGatewayApiDetail ??
      jest.fn().mockResolvedValue(DISCOVERED_ARTIFACT),
  } as any;
}

function buildDefinitionStore(definition: unknown = DEFINITION) {
  return {
    capabilities: { read: true, write: true },
    get: jest.fn().mockResolvedValue(definition),
    upsert: jest.fn(),
  } as any;
}

function buildDocumentStore(
  docs: Array<{ documentId: string; name: string; sourceType: string }> = [],
  contentBySourceType: Record<string, string> = {},
) {
  return {
    capabilities: {
      read: true,
      create: true,
      updateMetadata: true,
      updateContent: false,
      delete: true,
    },
    list: jest.fn().mockResolvedValue(docs),
    get: jest.fn(),
    getContent: jest.fn().mockImplementation(async (_ref, documentId) => ({
      kind: 'text',
      contentType: 'text/markdown',
      body: contentBySourceType[documentId] ?? `content-${documentId}`,
    })),
    create: jest.fn(),
    updateMetadata: jest.fn(),
    delete: jest.fn(),
  } as any;
}

function buildPortalClient() {
  return {
    getApi: jest.fn(),
    createApi: jest.fn(),
    updateApi: jest.fn(),
    uploadAssets: jest.fn(),
    deleteAllDocuments: jest.fn().mockResolvedValue(undefined),
    getSubscriptionPlans: jest.fn().mockResolvedValue([]),
    getLabels: jest.fn().mockResolvedValue([]),
  } as any;
}

const logger = mockServices.logger.mock();

describe('preparePublish', () => {
  it('rejects a non-gateway apiRef', async () => {
    await expect(
      preparePublish({
        apiRef: { ...API_REF, sourceKind: 'apim' },
        entity: ENTITY,
        client: buildClient(),
        definitionStore: buildDefinitionStore(),
        documentStore: buildDocumentStore(),
        config: CONFIG,
        logger,
      }),
    ).rejects.toThrow(NotAllowedError);
  });

  it('throws ConflictError when no definition is stored and the entity has none', async () => {
    await expect(
      preparePublish({
        apiRef: API_REF,
        entity: ENTITY,
        client: buildClient(),
        definitionStore: buildDefinitionStore(null),
        documentStore: buildDocumentStore(),
        config: CONFIG,
        logger,
      }),
    ).rejects.toThrow(/Attach an API definition/);
  });

  it('partitions documents: markdown to publish, everything else skipped with a reason', async () => {
    const documentStore = buildDocumentStore([
      { documentId: 'd1', name: 'Guide', sourceType: 'MARKDOWN' },
      { documentId: 'd2', name: 'Spec PDF', sourceType: 'FILE' },
      { documentId: 'd3', name: 'External', sourceType: 'URL' },
    ]);

    const result = await preparePublish({
      apiRef: API_REF,
      entity: ENTITY,
      client: buildClient(),
      definitionStore: buildDefinitionStore(),
      documentStore,
      config: CONFIG,
      logger,
    });

    expect(result.documentsToPublish.map(d => d.name)).toEqual(['Guide']);
    expect(result.skippedDocuments).toEqual([
      {
        name: 'Spec PDF',
        sourceType: 'FILE',
        reason: 'Only markdown documents can be published to the API Portal',
      },
      {
        name: 'External',
        sourceType: 'URL',
        reason: 'Only markdown documents can be published to the API Portal',
      },
    ]);
  });

  it('maps the metadata id from the discovered artifact handle', async () => {
    const result = await preparePublish({
      apiRef: API_REF,
      entity: ENTITY,
      client: buildClient(),
      definitionStore: buildDefinitionStore(),
      documentStore: buildDocumentStore(),
      config: CONFIG,
      logger,
    });
    expect(result.metadata.id).toBe('payment-api-service-v1.0');
    expect(result.metadata.referenceId).toBe(API_REF.apiId);
  });
});

describe('publishApiToPortal', () => {
  it('creates a new API when none exists on the portal yet', async () => {
    const portalClient = buildPortalClient();
    portalClient.getApi.mockResolvedValue(undefined);
    portalClient.createApi.mockResolvedValue({
      id: 'payment-api-service-v1.0',
    });

    const result = await publishApiToPortal({
      apiRef: API_REF,
      entity: ENTITY,
      client: buildClient(),
      portalClient,
      definitionStore: buildDefinitionStore(),
      documentStore: buildDocumentStore(),
      accessToken: 'token-1',
      config: CONFIG,
      logger,
    });

    expect(result.operation).toBe('created');
    expect(portalClient.createApi).toHaveBeenCalled();
    expect(portalClient.updateApi).not.toHaveBeenCalled();
    expect(portalClient.deleteAllDocuments).toHaveBeenCalledWith(
      'payment-api-service-v1.0',
      'token-1',
    );
  });

  it('rejects with a clear message naming the plan(s) that do not exist in the org, instead of calling the portal', async () => {
    const portalClient = buildPortalClient();
    portalClient.getSubscriptionPlans.mockResolvedValue([{ id: 'Bronze' }]);

    await expect(
      publishApiToPortal({
        apiRef: API_REF,
        entity: ENTITY,
        client: buildClient(),
        portalClient,
        definitionStore: buildDefinitionStore(),
        documentStore: buildDocumentStore(),
        accessToken: 'token-1',
        config: CONFIG,
        logger,
        subscriptionPlanIds: ['Bronze', 'Missing-Plan'],
      }),
    ).rejects.toThrow(InputError);
    await expect(
      publishApiToPortal({
        apiRef: API_REF,
        entity: ENTITY,
        client: buildClient(),
        portalClient,
        definitionStore: buildDefinitionStore(),
        documentStore: buildDocumentStore(),
        accessToken: 'token-1',
        config: CONFIG,
        logger,
        subscriptionPlanIds: ['Bronze', 'Missing-Plan'],
      }),
    ).rejects.toThrow(/Missing-Plan/);
    expect(portalClient.getApi).not.toHaveBeenCalled();
  });

  it('publishes successfully when every selected subscription plan exists in the org', async () => {
    const portalClient = buildPortalClient();
    portalClient.getSubscriptionPlans.mockResolvedValue([
      { id: 'Bronze' },
      { id: 'Gold' },
    ]);
    portalClient.getApi.mockResolvedValue(undefined);
    portalClient.createApi.mockResolvedValue({
      id: 'payment-api-service-v1.0',
    });

    const result = await publishApiToPortal({
      apiRef: API_REF,
      entity: ENTITY,
      client: buildClient(),
      portalClient,
      definitionStore: buildDefinitionStore(),
      documentStore: buildDocumentStore(),
      accessToken: 'token-1',
      config: CONFIG,
      logger,
      subscriptionPlanIds: ['Bronze', 'Gold'],
    });

    expect(result.operation).toBe('created');
  });

  it('rejects with a clear message naming the label(s) that do not exist in the org, instead of calling the portal', async () => {
    const portalClient = buildPortalClient();
    portalClient.getLabels.mockResolvedValue([{ id: 'default' }]);

    await expect(
      publishApiToPortal({
        apiRef: API_REF,
        entity: ENTITY,
        client: buildClient(),
        portalClient,
        definitionStore: buildDefinitionStore(),
        documentStore: buildDocumentStore(),
        accessToken: 'token-1',
        config: CONFIG,
        logger,
        overrides: {
          displayName: 'Payment API',
          productionEndpoint: 'https://gw.example.com/payments',
          labels: ['default', 'Missing-Label'],
        },
      }),
    ).rejects.toThrow(/Missing-Label/);
    expect(portalClient.getApi).not.toHaveBeenCalled();
  });

  it('publishes successfully when every selected label exists in the org', async () => {
    const portalClient = buildPortalClient();
    portalClient.getLabels.mockResolvedValue([
      { id: 'default' },
      { id: 'premium' },
    ]);
    portalClient.getApi.mockResolvedValue(undefined);
    portalClient.createApi.mockResolvedValue({
      id: 'payment-api-service-v1.0',
    });

    const result = await publishApiToPortal({
      apiRef: API_REF,
      entity: ENTITY,
      client: buildClient(),
      portalClient,
      definitionStore: buildDefinitionStore(),
      documentStore: buildDocumentStore(),
      accessToken: 'token-1',
      config: CONFIG,
      logger,
      overrides: {
        displayName: 'Payment API',
        productionEndpoint: 'https://gw.example.com/payments',
        labels: ['default', 'premium'],
      },
    });

    expect(result.operation).toBe('created');
  });

  it('updates an existing API by the same handle', async () => {
    const portalClient = buildPortalClient();
    portalClient.getApi.mockResolvedValue({
      id: 'payment-api-service-v1.0',
      refId: API_REF.apiId,
    });
    portalClient.updateApi.mockResolvedValue({
      id: 'payment-api-service-v1.0',
    });

    const result = await publishApiToPortal({
      apiRef: API_REF,
      entity: ENTITY,
      client: buildClient(),
      portalClient,
      definitionStore: buildDefinitionStore(),
      documentStore: buildDocumentStore(),
      accessToken: 'token-1',
      config: CONFIG,
      logger,
    });

    expect(result.operation).toBe('updated');
    expect(portalClient.updateApi).toHaveBeenCalled();
    expect(portalClient.createApi).not.toHaveBeenCalled();
  });

  it('refuses to overwrite an API whose referenceId belongs to a different OpenChoreo API', async () => {
    const portalClient = buildPortalClient();
    portalClient.getApi.mockResolvedValue({
      id: 'payment-api-service-v1.0',
      refId: 'some-other-openchoreo-api',
    });

    await expect(
      publishApiToPortal({
        apiRef: API_REF,
        entity: ENTITY,
        client: buildClient(),
        portalClient,
        definitionStore: buildDefinitionStore(),
        documentStore: buildDocumentStore(),
        accessToken: 'token-1',
        config: CONFIG,
        logger,
      }),
    ).rejects.toThrow(ConflictError);
    expect(portalClient.updateApi).not.toHaveBeenCalled();
  });

  it('publishes markdown documents via the assets POST and reports the published count', async () => {
    const portalClient = buildPortalClient();
    portalClient.getApi.mockResolvedValue(undefined);
    portalClient.createApi.mockResolvedValue({
      id: 'payment-api-service-v1.0',
    });
    const documentStore = buildDocumentStore([
      { documentId: 'd1', name: 'Guide', sourceType: 'MARKDOWN' },
    ]);

    const result = await publishApiToPortal({
      apiRef: API_REF,
      entity: ENTITY,
      client: buildClient(),
      portalClient,
      definitionStore: buildDefinitionStore(),
      documentStore,
      accessToken: 'token-1',
      config: CONFIG,
      logger,
    });

    expect(portalClient.uploadAssets).toHaveBeenCalledWith(
      'payment-api-service-v1.0',
      expect.any(Buffer),
      'token-1',
    );
    expect(result.documents.published).toBe(1);
    expect(result.warnings).toEqual([]);
  });

  it('skips the assets call entirely when there are no markdown documents', async () => {
    const portalClient = buildPortalClient();
    portalClient.getApi.mockResolvedValue(undefined);
    portalClient.createApi.mockResolvedValue({
      id: 'payment-api-service-v1.0',
    });

    const result = await publishApiToPortal({
      apiRef: API_REF,
      entity: ENTITY,
      client: buildClient(),
      portalClient,
      definitionStore: buildDefinitionStore(),
      documentStore: buildDocumentStore([]),
      accessToken: 'token-1',
      config: CONFIG,
      logger,
    });

    expect(portalClient.uploadAssets).not.toHaveBeenCalled();
    expect(result.documents.published).toBe(0);
  });

  it('returns a warning (not a throw) when the assets upload fails after a successful metadata call', async () => {
    const portalClient = buildPortalClient();
    portalClient.getApi.mockResolvedValue(undefined);
    portalClient.createApi.mockResolvedValue({
      id: 'payment-api-service-v1.0',
    });
    portalClient.uploadAssets.mockRejectedValue(new Error('portal is down'));
    const documentStore = buildDocumentStore([
      { documentId: 'd1', name: 'Guide', sourceType: 'MARKDOWN' },
    ]);

    const result = await publishApiToPortal({
      apiRef: API_REF,
      entity: ENTITY,
      client: buildClient(),
      portalClient,
      definitionStore: buildDefinitionStore(),
      documentStore,
      accessToken: 'token-1',
      config: CONFIG,
      logger,
    });

    expect(result.warnings).toEqual([
      expect.stringContaining('portal is down'),
    ]);
    expect(result.documents.published).toBe(0);
  });

  it('skips a document with no stored content but still attaches the others', async () => {
    const portalClient = buildPortalClient();
    portalClient.getApi.mockResolvedValue(undefined);
    portalClient.createApi.mockResolvedValue({
      id: 'payment-api-service-v1.0',
    });
    const documentStore = buildDocumentStore([
      {
        documentId: 'broken-doc',
        name: 'Broken Guide',
        sourceType: 'MARKDOWN',
      },
      { documentId: 'good-doc', name: 'Good Guide', sourceType: 'MARKDOWN' },
    ]);
    documentStore.getContent.mockImplementation(
      async (_ref: unknown, documentId: string) => {
        if (documentId === 'broken-doc') {
          throw new Error(`Document '${documentId}' has no stored content`);
        }
        return {
          kind: 'text',
          contentType: 'text/markdown',
          body: `content-${documentId}`,
        };
      },
    );

    const result = await publishApiToPortal({
      apiRef: API_REF,
      entity: ENTITY,
      client: buildClient(),
      portalClient,
      definitionStore: buildDefinitionStore(),
      documentStore,
      accessToken: 'token-1',
      config: CONFIG,
      logger,
    });

    expect(portalClient.uploadAssets).toHaveBeenCalledWith(
      'payment-api-service-v1.0',
      expect.any(Buffer),
      'token-1',
    );
    expect(result.documents.published).toBe(1);
    expect(result.warnings).toEqual([
      expect.stringContaining("Document 'Broken Guide' could not be attached"),
    ]);
  });

  it('clears previously-published documents before re-attaching the current set', async () => {
    const portalClient = buildPortalClient();
    portalClient.getApi.mockResolvedValue({
      id: 'payment-api-service-v1.0',
      refId: API_REF.apiId,
    });
    portalClient.updateApi.mockResolvedValue({
      id: 'payment-api-service-v1.0',
    });
    const documentStore = buildDocumentStore([
      { documentId: 'd1', name: 'Guide', sourceType: 'MARKDOWN' },
    ]);

    await publishApiToPortal({
      apiRef: API_REF,
      entity: ENTITY,
      client: buildClient(),
      portalClient,
      definitionStore: buildDefinitionStore(),
      documentStore,
      accessToken: 'token-1',
      config: CONFIG,
      logger,
    });

    const deleteOrder =
      portalClient.deleteAllDocuments.mock.invocationCallOrder[0];
    const uploadOrder = portalClient.uploadAssets.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(uploadOrder);
  });

  it('still attaches documents after a warning when clearing existing ones fails', async () => {
    const portalClient = buildPortalClient();
    portalClient.getApi.mockResolvedValue(undefined);
    portalClient.createApi.mockResolvedValue({
      id: 'payment-api-service-v1.0',
    });
    portalClient.deleteAllDocuments.mockRejectedValue(
      new Error('delete endpoint unreachable'),
    );
    const documentStore = buildDocumentStore([
      { documentId: 'd1', name: 'Guide', sourceType: 'MARKDOWN' },
    ]);

    const result = await publishApiToPortal({
      apiRef: API_REF,
      entity: ENTITY,
      client: buildClient(),
      portalClient,
      definitionStore: buildDefinitionStore(),
      documentStore,
      accessToken: 'token-1',
      config: CONFIG,
      logger,
    });

    expect(portalClient.uploadAssets).toHaveBeenCalled();
    expect(result.documents.published).toBe(1);
    expect(result.warnings).toEqual([
      expect.stringContaining('delete endpoint unreachable'),
    ]);
  });

  it('propagates a metadata creation failure', async () => {
    const portalClient = buildPortalClient();
    portalClient.getApi.mockResolvedValue(undefined);
    portalClient.createApi.mockRejectedValue(
      new Error('portal rejected metadata'),
    );

    await expect(
      publishApiToPortal({
        apiRef: API_REF,
        entity: ENTITY,
        client: buildClient(),
        portalClient,
        definitionStore: buildDefinitionStore(),
        documentStore: buildDocumentStore(),
        accessToken: 'token-1',
        config: CONFIG,
        logger,
      }),
    ).rejects.toThrow('portal rejected metadata');
  });
});

describe('buildPortalMetadata', () => {
  const ARTIFACT: RestApiArtifact = {
    kind: 'RestApi',
    metadata: { name: 'payment-api-service-v1.0' },
    spec: {
      displayName: 'Payment API',
      version: '1.0.0',
      description: 'Artifact-level description',
      operations: [],
    },
  };

  const MAPPER_ENTITY: Entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'API',
    metadata: {
      name: 'payment-api',
      namespace: 'wso2-gateways',
      tags: ['gateway-oc-dev', 'payments'],
      annotations: {
        'wso2-gateway.com/api-endpoints': JSON.stringify([
          {
            environmentName: 'oc-dev',
            urls: ['https://gw.example.com/payments'],
          },
        ]),
      },
    },
    spec: {
      type: 'openapi',
      lifecycle: 'production',
      owner: 'user:default/alice',
    },
  };

  const MAPPER_CONFIG: ApiPortalConfig = {
    ...CONFIG,
    defaults: { ...CONFIG.defaults, subscriptionPlans: ['Gold'] },
  };

  const DEFINITION_WITH_DESCRIPTION = `openapi: 3.0.0
info:
  title: Payment API
  version: 1.0.0
  description: Definition-level description
paths: {}
`;

  it('maps every field per the plan table', () => {
    const result = buildPortalMetadata({
      artifact: ARTIFACT,
      entity: MAPPER_ENTITY,
      definitionContent: DEFINITION_WITH_DESCRIPTION,
      apiRef: { apiId: 'payment-api-service-v1.0' },
      config: MAPPER_CONFIG,
      subscriptionPlanIds: ['Gold'],
    });

    expect(result).toEqual({
      id: 'payment-api-service-v1.0',
      name: 'Payment API',
      version: '1.0.0',
      description: 'Definition-level description',
      type: 'REST',
      status: 'PUBLISHED',
      referenceId: 'payment-api-service-v1.0',
      tags: ['payments'],
      labels: [],
      owners: { technicalOwner: 'user:default/alice' },
      endPoints: { productionURL: 'https://gw.example.com/payments' },
      subscriptionPlans: [{ id: 'Gold' }],
      agentVisibility: 'VISIBLE',
    });
  });

  it('falls back to the artifact description when the definition has none', () => {
    const result = buildPortalMetadata({
      artifact: ARTIFACT,
      entity: MAPPER_ENTITY,
      definitionContent:
        'openapi: 3.0.0\ninfo:\n  title: Payment API\n  version: 1.0.0\npaths: {}\n',
      apiRef: { apiId: 'payment-api-service-v1.0' },
      config: MAPPER_CONFIG,
    });
    expect(result.description).toBe('Artifact-level description');
  });

  it('omits owners when the entity has no owner', () => {
    const entityWithoutOwner: Entity = {
      ...MAPPER_ENTITY,
      spec: { type: 'openapi', lifecycle: 'production', owner: '' },
    };
    const result = buildPortalMetadata({
      artifact: ARTIFACT,
      entity: entityWithoutOwner,
      definitionContent: DEFINITION_WITH_DESCRIPTION,
      apiRef: { apiId: 'payment-api-service-v1.0' },
      config: MAPPER_CONFIG,
    });
    expect(result.owners).toBeUndefined();
  });

  it('omits endPoints when no gateway endpoints annotation is present', () => {
    const entityWithoutEndpoints: Entity = {
      ...MAPPER_ENTITY,
      metadata: { ...MAPPER_ENTITY.metadata, annotations: {} },
    };
    const result = buildPortalMetadata({
      artifact: ARTIFACT,
      entity: entityWithoutEndpoints,
      definitionContent: DEFINITION_WITH_DESCRIPTION,
      apiRef: { apiId: 'payment-api-service-v1.0' },
      config: MAPPER_CONFIG,
    });
    expect(result.endPoints).toBeUndefined();
  });

  it('maps subscriptionPlanIds to {id} refs', () => {
    const result = buildPortalMetadata({
      artifact: ARTIFACT,
      entity: MAPPER_ENTITY,
      definitionContent: DEFINITION_WITH_DESCRIPTION,
      apiRef: { apiId: 'payment-api-service-v1.0' },
      config: MAPPER_CONFIG,
      subscriptionPlanIds: ['Gold', 'Silver'],
    });
    expect(result.subscriptionPlans).toEqual([
      { id: 'Gold' },
      { id: 'Silver' },
    ]);
  });

  it('defaults to no subscription plans when none are selected for this API', () => {
    const result = buildPortalMetadata({
      artifact: ARTIFACT,
      entity: MAPPER_ENTITY,
      definitionContent: DEFINITION_WITH_DESCRIPTION,
      apiRef: { apiId: 'payment-api-service-v1.0' },
      config: MAPPER_CONFIG,
    });
    expect(result.subscriptionPlans).toEqual([]);
  });

  it('maps overrides.labels to the labels field', () => {
    const result = buildPortalMetadata({
      artifact: ARTIFACT,
      entity: MAPPER_ENTITY,
      definitionContent: DEFINITION_WITH_DESCRIPTION,
      apiRef: { apiId: 'payment-api-service-v1.0' },
      config: MAPPER_CONFIG,
      overrides: {
        displayName: 'Payment API',
        productionEndpoint: 'https://gw.example.com/payments',
        labels: ['default', 'premium'],
      },
    });
    expect(result.labels).toEqual(['default', 'premium']);
  });
});

describe('buildDocsZip', () => {
  it('returns undefined for an empty document list', async () => {
    await expect(buildDocsZip([])).resolves.toBeUndefined();
  });

  it('emits one docs/<slug>.md entry per document', async () => {
    const bundle = await buildDocsZip([
      { name: 'Getting Started', content: '# Hello' },
      { name: 'API Reference', content: '# Reference' },
    ]);

    expect(bundle).toBeDefined();
    expect(bundle!.fileNames.sort()).toEqual([
      'docs/api-reference.md',
      'docs/getting-started.md',
    ]);

    const zip = await JSZip.loadAsync(bundle!.zip);
    expect(await zip.file('docs/getting-started.md')!.async('string')).toBe(
      '# Hello',
    );
    expect(await zip.file('docs/api-reference.md')!.async('string')).toBe(
      '# Reference',
    );
  });

  it('adds a second top-level entry so the zip is not a single wrappable directory', async () => {
    const bundle = await buildDocsZip([{ name: 'Guide', content: 'x' }]);
    const zip = await JSZip.loadAsync(bundle!.zip);
    const topLevelNames = new Set(
      Object.keys(zip.files).map(name => name.split('/')[0]),
    );
    expect(topLevelNames.size).toBeGreaterThan(1);
  });

  it('slugifies non-alphanumeric characters and collapses repeats', async () => {
    const bundle = await buildDocsZip([
      { name: '  Weird!! Name__With   Spaces  ', content: 'x' },
    ]);
    expect(bundle!.fileNames).toEqual(['docs/weird-name-with-spaces.md']);
  });

  it('disambiguates name collisions with -2, -3, ...', async () => {
    const bundle = await buildDocsZip([
      { name: 'Guide', content: 'one' },
      { name: 'Guide', content: 'two' },
      { name: 'Guide!', content: 'three' },
    ]);
    expect(bundle!.fileNames.sort()).toEqual([
      'docs/guide-2.md',
      'docs/guide-3.md',
      'docs/guide.md',
    ]);
  });
});
