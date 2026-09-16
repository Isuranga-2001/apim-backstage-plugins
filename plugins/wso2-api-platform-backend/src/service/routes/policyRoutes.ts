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

import { NotAllowedError, NotFoundError } from '@backstage/errors';
import express from 'express';
import { RouteContext } from './types';
import { refreshCatalogEntityAdvisory } from './artifactRouteHelpers';
import {
  assertPolicySizeWithinLimit,
  parseUpsertPolicyInput,
} from '../documents/validation';
import { resolveApiRef } from '../documents/apiRefResolver';
import {
  fetchDiscoveredArtifact,
  resolvePlatformGateway,
} from '../documents/gatewayDefinitionVerifier';
import { toPolicyArtifact } from '../documents/restApiArtifactMapper';
import {
  applyGatewayPolicyUpdate,
  previewGatewayPolicyUpdate,
} from '../documents/gatewayPolicyVerifier';

const POLICIES_PATH = '/entities/:kind/:namespace/:name/policies';
const POLICIES_DIFF_PATH = '/entities/:kind/:namespace/:name/policies/diff';

export function registerPolicyRoutes(
  router: express.Router,
  context: RouteContext,
) {
  if (!context.httpAuth || !context.catalog || !context.policyStorage) {
    return;
  }
  const { httpAuth, catalog, policyStorage, logger, client } =
    context as Required<
      Pick<
        RouteContext,
        'httpAuth' | 'catalog' | 'policyStorage' | 'logger' | 'client'
      >
    >;

  async function resolve(req: express.Request) {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const { kind, namespace, name } = req.params;
    const apiRef = await resolveApiRef(
      catalog,
      { kind, namespace, name },
      credentials,
    );
    return { credentials, apiRef };
  }

  function assertWriteOperationsEnabled() {
    if (!client.getConfig().platformGateway.enableWriteOperations) {
      throw new NotAllowedError(
        'Gateway write operations are disabled (wso2ApiPlatformGateway.enableWriteOperations=false); policies are read-only',
      );
    }
  }

  router.get(POLICIES_PATH, async (req, res) => {
    const { apiRef } = await resolve(req);
    if (apiRef.sourceKind !== 'gateway') {
      throw new NotFoundError(
        `Entity '${apiRef.entityRef}' does not have a plugin-managed API Platform policy artifact`,
      );
    }
    const gateway = resolvePlatformGateway(client, apiRef, logger);
    if (!gateway) {
      throw new NotFoundError(
        `No API Platform gateway discovery URL configured for gateway '${apiRef.gatewayId}'`,
      );
    }
    const artifact = await fetchDiscoveredArtifact(
      client,
      gateway,
      apiRef.apiId,
    );
    res.json({ policies: toPolicyArtifact(artifact) });
  });

  router.put(POLICIES_PATH, async (req, res) => {
    const { apiRef, credentials } = await resolve(req);
    assertWriteOperationsEnabled();
    const input = parseUpsertPolicyInput(req.body);
    assertPolicySizeWithinLimit(input, policyStorage);

    const next = await applyGatewayPolicyUpdate(client, apiRef, input, logger);
    if (next) {
      await refreshCatalogEntityAdvisory(
        catalog,
        apiRef.entityRef,
        credentials,
        logger,
      );
      res.json({ policies: toPolicyArtifact(next) });
    } else {
      res.json({ policies: input });
    }
  });

  router.post(POLICIES_DIFF_PATH, async (req, res) => {
    const { apiRef } = await resolve(req);
    assertWriteOperationsEnabled();
    const input = parseUpsertPolicyInput(req.body);
    assertPolicySizeWithinLimit(input, policyStorage);

    const diff = await previewGatewayPolicyUpdate(
      client,
      apiRef,
      input,
      logger,
    );
    res.json({ diff: diff ?? null });
  });
}
