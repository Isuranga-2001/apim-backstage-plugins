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
import { LoggerService } from '@backstage/backend-plugin-api';
import JSZip from 'jszip';
import { Wso2ApiPlatformClient } from '../client';
import {
  fetchDiscoveredArtifact,
  resolvePlatformGateway,
} from '../documents/gatewayDefinitionVerifier';
import {
  RestApiArtifact,
  parseDefinitionInfo,
} from '../documents/restApiArtifactMapper';
import { ApiDefinitionStore } from '../documents/stores/ApiDefinitionStore';
import { ApiDocumentStore } from '../documents/stores/ApiDocumentStore';
import { ApiDocument, ApiRef } from '../documents/types';
import { ApiPortalClient } from './ApiPortalClient';
import { ApiPortalConfig } from './config';
import {
  PortalApiForm,
  PortalApiMetadataPayload,
  PortalApiPublishOverrides,
  PublishableDocument,
  PublishResult,
  SkippedDocument,
} from './types';

const GATEWAY_TAG_PREFIX = 'gateway-';
const GATEWAY_ENDPOINTS_ANNOTATION = 'wso2-gateway.com/api-endpoints';

function firstProductionUrl(entity: Entity): string | undefined {
  const raw = entity.metadata.annotations?.[GATEWAY_ENDPOINTS_ANNOTATION];
  if (!raw) {
    return undefined;
  }
  try {
    const endpoints = JSON.parse(raw) as Array<{ urls?: string[] }>;
    return endpoints[0]?.urls?.[0];
  } catch {
    return undefined;
  }
}

function nonGatewayTags(entity: Entity): string[] {
  return (entity.metadata.tags ?? []).filter(
    tag => !tag.startsWith(GATEWAY_TAG_PREFIX),
  );
}

export function buildPortalMetadata(input: {
  artifact: RestApiArtifact;
  entity: Entity;
  definitionContent: string;
  apiRef: Pick<ApiRef, 'apiId'>;
  config: ApiPortalConfig;
  overrides?: PortalApiPublishOverrides;
  subscriptionPlanIds?: string[];
}): PortalApiMetadataPayload {
  const {
    artifact,
    entity,
    definitionContent,
    apiRef,
    config,
    overrides,
    subscriptionPlanIds,
  } = input;

  const { description: definitionDescription } =
    parseDefinitionInfo(definitionContent);
  const description = definitionDescription ?? artifact.spec.description;
  const technicalOwner = entity.spec?.owner
    ? String(entity.spec.owner)
    : undefined;
  const displayName = overrides?.displayName || artifact.spec.displayName;
  const productionURL =
    overrides?.productionEndpoint || firstProductionUrl(entity);
  const sandboxURL = overrides?.sandboxEndpoint;
  const endPoints =
    productionURL || sandboxURL
      ? {
          ...(productionURL ? { productionURL } : {}),
          ...(sandboxURL ? { sandboxURL } : {}),
        }
      : undefined;

  return {
    id: artifact.metadata.name,
    name: displayName,
    version: artifact.spec.version,
    ...(description ? { description } : {}),
    type: 'REST',
    status: config.defaults.status,
    referenceId: apiRef.apiId,
    tags: nonGatewayTags(entity),
    labels: config.defaults.labels,
    ...(technicalOwner ? { owners: { technicalOwner } } : {}),
    ...(endPoints ? { endPoints } : {}),
    subscriptionPlans: (subscriptionPlanIds ?? []).map(id => ({ id })),
    agentVisibility: config.defaults.agentVisibility,
  };
}

export type ContentBundle = { zip: Buffer; fileNames: string[] } | undefined;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueSlug(name: string, used: Map<string, number>): string {
  const base = slugify(name) || 'document';
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

export async function buildDocsZip(
  docs: PublishableDocument[],
): Promise<ContentBundle> {
  if (docs.length === 0) {
    return undefined;
  }

  const zip = new JSZip();
  const used = new Map<string, number>();
  const fileNames: string[] = [];

  for (const doc of docs) {
    const fileName = `docs/${uniqueSlug(doc.name, used)}.md`;
    zip.file(fileName, doc.content);
    fileNames.push(fileName);
  }

  zip.file('.api-portal-upload', '');

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  return { zip: zipBuffer, fileNames };
}

function detectDefinitionFileName(content: string): string {
  try {
    JSON.parse(content);
    return 'definition.json';
  } catch {
    return 'definition.yaml';
  }
}

async function resolveDefinition(opts: {
  apiRef: ApiRef;
  entity: Entity;
  definitionStore: ApiDefinitionStore;
}): Promise<{ content: string; fileName: string }> {
  const stored = await opts.definitionStore.get(opts.apiRef);
  if (stored?.content) {
    return {
      content: stored.content,
      fileName: stored.fileName ?? detectDefinitionFileName(stored.content),
    };
  }

  const entityDefinition =
    typeof opts.entity.spec?.definition === 'string'
      ? opts.entity.spec.definition
      : undefined;
  if (entityDefinition?.trim()) {
    return {
      content: entityDefinition,
      fileName: detectDefinitionFileName(entityDefinition),
    };
  }

  throw new ConflictError(
    'Attach an API definition before publishing to the API Portal',
  );
}

export type PreparedPublish = {
  metadata: PortalApiMetadataPayload;
  definitionContent: string;
  definitionFileName: string;
  documentsToPublish: ApiDocument[];
  skippedDocuments: SkippedDocument[];
};

export async function preparePublish(opts: {
  apiRef: ApiRef;
  entity: Entity;
  client: Wso2ApiPlatformClient;
  definitionStore: ApiDefinitionStore;
  documentStore: ApiDocumentStore;
  config: ApiPortalConfig;
  logger: LoggerService;
  overrides?: PortalApiPublishOverrides;
  subscriptionPlanIds?: string[];
}): Promise<PreparedPublish> {
  const {
    apiRef,
    entity,
    client,
    definitionStore,
    documentStore,
    config,
    logger,
    overrides,
    subscriptionPlanIds,
  } = opts;

  if (apiRef.sourceKind !== 'gateway') {
    throw new NotAllowedError(
      'Publishing to the API Portal is available for API Platform gateway-discovered APIs only',
    );
  }

  const gateway = resolvePlatformGateway(client, apiRef, logger);
  if (!gateway) {
    throw new ConflictError(
      `No API Platform gateway discovery URL configured for gateway '${apiRef.gatewayId}' — cannot verify the API before publishing it to the API Portal`,
    );
  }
  const artifact = await fetchDiscoveredArtifact(client, gateway, apiRef.apiId);

  const { content: definitionContent, fileName: definitionFileName } =
    await resolveDefinition({ apiRef, entity, definitionStore });

  const metadata = buildPortalMetadata({
    artifact,
    entity,
    definitionContent,
    apiRef,
    config,
    overrides,
    subscriptionPlanIds,
  });

  const allDocuments = await documentStore.list(apiRef);
  const documentsToPublish: ApiDocument[] = [];
  const skippedDocuments: SkippedDocument[] = [];
  for (const doc of allDocuments) {
    if (doc.sourceType === 'MARKDOWN') {
      documentsToPublish.push(doc);
    } else {
      skippedDocuments.push({
        name: doc.name,
        sourceType: doc.sourceType,
        reason: 'Only markdown documents can be published to the API Portal',
      });
    }
  }

  return {
    metadata,
    definitionContent,
    definitionFileName,
    documentsToPublish,
    skippedDocuments,
  };
}

export async function publishApiToPortal(opts: {
  apiRef: ApiRef;
  entity: Entity;
  client: Wso2ApiPlatformClient;
  portalClient: ApiPortalClient;
  definitionStore: ApiDefinitionStore;
  documentStore: ApiDocumentStore;
  accessToken: string;
  config: ApiPortalConfig;
  logger: LoggerService;
  overrides?: PortalApiPublishOverrides;
  subscriptionPlanIds?: string[];
}): Promise<PublishResult> {
  const {
    apiRef,
    client,
    portalClient,
    definitionStore,
    documentStore,
    accessToken,
    config,
    logger,
    overrides,
    subscriptionPlanIds,
  } = opts;

  const prepared = await preparePublish({
    apiRef,
    entity: opts.entity,
    client,
    definitionStore,
    documentStore,
    config,
    logger,
    overrides,
    subscriptionPlanIds,
  });

  if (subscriptionPlanIds && subscriptionPlanIds.length > 0) {
    const orgPlans = await portalClient.getSubscriptionPlans(accessToken);
    const availableIds = new Set(orgPlans.map(p => p.id));
    const invalidIds = subscriptionPlanIds.filter(id => !availableIds.has(id));
    if (invalidIds.length > 0) {
      throw new InputError(
        `Invalid subscription plan(s) selected for this API: ${invalidIds.join(
          ', ',
        )} — not available in this org's API Portal. Update the selection in the Overview tab's Subscription Plans panel and try again.`,
      );
    }
  }

  const existing = await portalClient.getApi(prepared.metadata.id, accessToken);

  if (existing?.refId && existing.refId !== apiRef.apiId) {
    throw new ConflictError(
      `API Portal handle '${prepared.metadata.id}' is already registered to a ` +
        `different API Platform gateway API (referenceId '${existing.refId}') — refusing to overwrite it.`,
    );
  }

  const form: PortalApiForm = {
    metadata: prepared.metadata,
    definitionContent: prepared.definitionContent,
    definitionFileName: prepared.definitionFileName,
  };

  let portalApiId: string;
  let operation: 'created' | 'updated';
  if (existing) {
    portalApiId = (
      await portalClient.updateApi(prepared.metadata.id, form, accessToken)
    ).id;
    operation = 'updated';
  } else {
    portalApiId = (await portalClient.createApi(form, accessToken)).id;
    operation = 'created';
  }

  const warnings: string[] = [];
  let publishedCount = 0;

  try {
    await portalClient.deleteAllDocuments(portalApiId, accessToken);
  } catch (e: any) {
    warnings.push(
      `Could not clear previously-published documents before re-attaching them: ${e.message}`,
    );
    logger.warn(
      `[ApiPortal-Publish] Failed to clear existing documents: ${e.message}`,
    );
  }

  if (prepared.documentsToPublish.length > 0) {
    const publishableDocs: PublishableDocument[] = [];
    for (const doc of prepared.documentsToPublish) {
      try {
        const content = await documentStore.getContent(apiRef, doc.documentId);
        publishableDocs.push({
          name: doc.name,
          content: content.kind === 'text' ? content.body : '',
        });
      } catch (e: any) {
        warnings.push(
          `Document '${doc.name}' could not be attached: ${e.message}`,
        );
        logger.warn(
          `[ApiPortal-Publish] Skipping document '${doc.documentId}' (${doc.name}): ${e.message}`,
        );
      }
    }

    if (publishableDocs.length > 0) {
      try {
        const bundle = await buildDocsZip(publishableDocs);
        if (bundle) {
          await portalClient.uploadAssets(portalApiId, bundle.zip, accessToken);
          publishedCount = publishableDocs.length;
        }
      } catch (e: any) {
        warnings.push(
          `API metadata was published, but the documents failed to upload: ${e.message}`,
        );
        logger.warn(
          `[ApiPortal-Publish] Documents upload failed: ${e.message}`,
        );
      }
    }
  }

  return {
    portalApiId,
    portalUrl: `${config.baseUrl}/api-portal/apis/${encodeURIComponent(
      portalApiId,
    )}`,
    operation,
    publishedAt: new Date().toISOString(),
    documents: {
      published: publishedCount,
      skipped: prepared.skippedDocuments,
    },
    warnings,
  };
}
