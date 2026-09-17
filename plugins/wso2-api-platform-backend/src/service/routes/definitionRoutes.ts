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

import { NotAllowedError } from '@backstage/errors';
import express from 'express';
import { load } from 'js-yaml';
import {
  apiDescriptionOverrideTracker,
  apiCatalogSyncTrigger,
} from '@wso2/backstage-plugin-catalog-backend-module-wso2-api-platform';
import { RouteContext } from './types';
import {
  actorFor,
  assertEnabled,
  refreshCatalogEntityAdvisory,
} from './artifactRouteHelpers';
import {
  assertDefinitionSizeWithinLimit,
  parsePreviewDefinitionInput,
  parseUpsertDefinitionInput,
} from '../documents/validation';
import {
  applyGatewayDefinitionUpdate,
  assertMatchesDiscoveredGatewayApi,
  previewDiscoveredApiDiff,
  previewGatewayDefinitionUpdate,
} from '../documents/gatewayDefinitionVerifier';
import {
  diffDefinitionAgainstStored,
  restoreImmutableDefinitionFields,
} from '../documents/restApiArtifactMapper';

const DEFINITION_PATH = '/entities/:kind/:namespace/:name/definition';
const DEFINITION_DIFF_PATH = '/entities/:kind/:namespace/:name/definition/diff';

function extractDefinitionDescription(content: string): string | undefined {
  try {
    const definition = load(content) as {
      info?: { description?: unknown };
    } | null;
    return typeof definition?.info?.description === 'string'
      ? definition.info.description
      : undefined;
  } catch {
    return undefined;
  }
}

export function registerDefinitionRoutes(
  router: express.Router,
  context: RouteContext,
) {
  if (
    !context.definitionStoreResolver ||
    !context.httpAuth ||
    !context.catalog ||
    !context.definitionStorage
  ) {
    return;
  }
  const {
    definitionStoreResolver,
    httpAuth,
    catalog,
    definitionStorage,
    logger,
    client,
  } = context as Required<RouteContext>;

  async function resolve(req: express.Request) {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const { kind, namespace, name } = req.params;
    const { apiRef, store } = await definitionStoreResolver.resolve(
      { kind, namespace, name },
      credentials,
    );
    return { credentials, apiRef, store };
  }

  function assertStorageEnabled() {
    assertEnabled(
      definitionStorage.enabled,
      'Definition storage is disabled (wso2ApiPlatform.storage.enabled=false)',
    );
  }

  router.get(DEFINITION_PATH, async (req, res) => {
    const { apiRef, store } = await resolve(req);
    const definition = await store.get(apiRef);
    // Re-hydrates the tracker (e.g. after a backend restart) so the next
    // entity processing pass keeps applying the persisted description.
    apiDescriptionOverrideTracker.set(
      apiRef.entityRef,
      definition?.description,
    );
    res.json({ definition, capabilities: store.capabilities });
  });

  router.put(DEFINITION_PATH, async (req, res) => {
    assertStorageEnabled();
    const { apiRef, store, credentials } = await resolve(req);
    if (!store.capabilities.write) {
      throw new NotAllowedError(
        "This API's definition store does not support add/update",
      );
    }

    const input = parseUpsertDefinitionInput(req.body);
    assertDefinitionSizeWithinLimit(input.content, definitionStorage);

    const existing = await store.get(apiRef);
    const content = restoreImmutableDefinitionFields(
      existing?.content,
      input.content,
    );
    const description = extractDefinitionDescription(content);

    if (existing) {
      await applyGatewayDefinitionUpdate(client, apiRef, content, logger);
    } else {
      await assertMatchesDiscoveredGatewayApi(client, apiRef, content, logger);
    }

    const definition = await store.upsert(
      apiRef,
      { ...input, content, description },
      actorFor(credentials),
    );
    apiDescriptionOverrideTracker.set(apiRef.entityRef, description);
    await refreshCatalogEntityAdvisory(
      catalog,
      apiRef.entityRef,
      credentials,
      logger,
    );
    try {
      await apiCatalogSyncTrigger.runNow();
    } catch (e) {
      logger.debug(
        `Catalog sync after definition update is advisory; ignored: ${e}`,
      );
    }
    res.json({ definition, capabilities: store.capabilities });
  });

  router.post(DEFINITION_DIFF_PATH, async (req, res) => {
    assertStorageEnabled();
    const { apiRef, store } = await resolve(req);
    if (!store.capabilities.write) {
      throw new NotAllowedError(
        "This API's definition store does not support add/update",
      );
    }

    const input = parsePreviewDefinitionInput(req.body);
    const existing = await store.get(apiRef);

    if (!existing) {
      const diff = await previewDiscoveredApiDiff(
        client,
        apiRef,
        input.content,
        logger,
      );
      res.json({ diff: diff ?? null });
      return;
    }

    if (!client.getConfig().platformGateway.enableWriteOperations) {
      const diff = diffDefinitionAgainstStored(
        existing?.content,
        input.content,
      );
      res.json({ diff: diff ?? null });
      return;
    }

    const content = restoreImmutableDefinitionFields(
      existing?.content,
      input.content,
    );
    const diff = await previewGatewayDefinitionUpdate(
      client,
      apiRef,
      content,
      logger,
      existing?.description,
    );
    res.json({ diff: diff ?? null });
  });
}
