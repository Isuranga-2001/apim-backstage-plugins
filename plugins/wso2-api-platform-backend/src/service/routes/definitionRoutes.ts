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
import { RouteContext } from './types';
import {
  actorFor,
  assertEnabled,
  refreshCatalogEntityAdvisory,
} from './artifactRouteHelpers';
import {
  assertDefinitionSizeWithinLimit,
  parseUpsertDefinitionInput,
} from '../documents/validation';
import { assertMatchesDiscoveredOpenChoreoApi } from '../documents/openchoreoDefinitionVerifier';

const DEFINITION_PATH = '/entities/:kind/:namespace/:name/definition';

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
    await assertMatchesDiscoveredOpenChoreoApi(
      client,
      apiRef,
      input.content,
      logger,
    );

    const definition = await store.upsert(apiRef, input, actorFor(credentials));
    await refreshCatalogEntityAdvisory(
      catalog,
      apiRef.entityRef,
      credentials,
      logger,
    );
    res.json({ definition, capabilities: store.capabilities });
  });
}
