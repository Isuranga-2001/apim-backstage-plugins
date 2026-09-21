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

import express from 'express';
import { AuthenticationError, InputError } from '@backstage/errors';
import { resolveApiRef } from '../documents/apiRefResolver';
import { resolvePlatformGateway } from '../documents/gatewayDefinitionVerifier';
import {
  preparePublish,
  publishApiToPortal,
} from '../apiPortal/publishService';
import { actorFor } from './artifactRouteHelpers';
import { RouteContext } from './types';
import {
  DEFAULT_SUBSCRIPTION_PLAN_IDS,
  PortalApiPublishOverrides,
  PublishCapabilities,
} from '../apiPortal/types';

const API_PORTAL_PATH = '/entities/:kind/:namespace/:name/api-portal';
const PREVIEW_PATH = `${API_PORTAL_PATH}/preview`;
const PUBLISH_PATH = `${API_PORTAL_PATH}/publish`;
const SUBSCRIPTIONS_PATH = `${API_PORTAL_PATH}/subscriptions`;

const PORTAL_TOKEN_HEADER = 'x-api-portal-access-token';

function requirePortalToken(req: express.Request): string {
  const token = req.headers[PORTAL_TOKEN_HEADER];
  if (typeof token !== 'string' || !token) {
    throw new AuthenticationError(
      `Missing '${PORTAL_TOKEN_HEADER}' header — publishing to the API Portal requires a Platform API access token`,
    );
  }
  return token;
}

function requirePublishOverrides(
  req: express.Request,
): PortalApiPublishOverrides {
  const body = req.body ?? {};
  const displayName =
    typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const productionEndpoint =
    typeof body.productionEndpoint === 'string'
      ? body.productionEndpoint.trim()
      : '';
  const sandboxEndpoint =
    typeof body.sandboxEndpoint === 'string' ? body.sandboxEndpoint.trim() : '';
  const labels = Array.isArray(body.labels)
    ? body.labels
        .filter((label: unknown): label is string => typeof label === 'string')
        .map((label: string) => label.trim())
        .filter(Boolean)
    : [];

  if (!displayName) {
    throw new InputError(
      'displayName is required to publish to the API Portal',
    );
  }
  if (!productionEndpoint) {
    throw new InputError(
      'productionEndpoint is required to publish to the API Portal',
    );
  }
  if (labels.length === 0) {
    throw new InputError(
      'At least one label is required to publish to the API Portal',
    );
  }

  return {
    displayName,
    productionEndpoint,
    labels,
    ...(sandboxEndpoint ? { sandboxEndpoint } : {}),
  };
}

function availableCustomPlanIds(config: {
  defaults: { subscriptionPlans: string[] };
}): string[] {
  return config.defaults.subscriptionPlans.filter(
    id => !DEFAULT_SUBSCRIPTION_PLAN_IDS.includes(id),
  );
}

function requireValidPlanIds(
  req: express.Request,
  config: { defaults: { subscriptionPlans: string[] } },
): string[] {
  const body = req.body ?? {};
  const planIds = body.planIds;
  if (!Array.isArray(planIds) || !planIds.every(id => typeof id === 'string')) {
    throw new InputError('planIds must be an array of strings');
  }
  const allowed = new Set([
    ...DEFAULT_SUBSCRIPTION_PLAN_IDS,
    ...availableCustomPlanIds(config),
  ]);
  const unknown = planIds.filter(id => !allowed.has(id));
  if (unknown.length > 0) {
    throw new InputError(
      `Unknown subscription plan id(s): ${unknown.join(', ')}`,
    );
  }
  return planIds;
}

export function registerApiPortalRoutes(
  router: express.Router,
  context: RouteContext,
) {
  if (
    !context.httpAuth ||
    !context.catalog ||
    !context.apiPortalConfig ||
    !context.apiPortalClient ||
    !context.apiPortalDefinitionStore ||
    !context.apiPortalDocumentStore ||
    !context.apiPortalSubscriptionStore
  ) {
    return;
  }
  const {
    httpAuth,
    catalog,
    client,
    logger,
    apiPortalConfig: config,
    apiPortalClient: portalClient,
    apiPortalDefinitionStore: definitionStore,
    apiPortalDocumentStore: documentStore,
    apiPortalSubscriptionStore: subscriptionStore,
  } = context as Required<RouteContext>;

  async function resolve(req: express.Request) {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const { kind, namespace, name } = req.params;
    const apiRef = await resolveApiRef(
      catalog,
      { kind, namespace, name },
      credentials,
    );
    const entity = await catalog.getEntityByRef(apiRef.entityRef, {
      credentials,
    });
    return { apiRef, entity: entity!, credentials };
  }

  async function computeCapabilities(
    apiRef: Awaited<ReturnType<typeof resolveApiRef>>,
  ): Promise<PublishCapabilities> {
    if (!config.enabled) {
      return {
        publish: false,
        reason: 'The API Portal integration is not enabled',
      };
    }
    if (apiRef.sourceKind !== 'gateway') {
      return {
        publish: false,
        reason:
          'Publishing to the API Portal is available for API Platform gateway-discovered APIs only',
      };
    }
    if (!resolvePlatformGateway(client, apiRef, logger)) {
      return {
        publish: false,
        reason: `No API Platform gateway discovery URL is configured for gateway '${apiRef.gatewayId}'`,
      };
    }
    const definition = await definitionStore.get(apiRef);
    if (!definition?.content) {
      return {
        publish: false,
        reason: 'Attach an API definition before publishing to the API Portal',
      };
    }
    return { publish: true };
  }

  router.get(API_PORTAL_PATH, async (req, res) => {
    const { apiRef } = await resolve(req);
    res.json({
      enabled: config.enabled,
      capabilities: await computeCapabilities(apiRef),
    });
  });

  router.get(SUBSCRIPTIONS_PATH, async (req, res) => {
    const { apiRef } = await resolve(req);
    const { planIds } = await subscriptionStore.get(apiRef);
    res.json({
      availableCustomPlanIds: availableCustomPlanIds(config),
      selectedPlanIds: planIds,
    });
  });

  router.put(SUBSCRIPTIONS_PATH, async (req, res) => {
    const planIds = requireValidPlanIds(req, config);
    const { apiRef, credentials } = await resolve(req);

    const selection = await subscriptionStore.set(
      apiRef,
      planIds,
      actorFor(credentials),
    );
    res.json({
      availableCustomPlanIds: availableCustomPlanIds(config),
      selectedPlanIds: selection.planIds,
    });
  });

  router.post(PREVIEW_PATH, async (req, res) => {
    const { apiRef, entity } = await resolve(req);
    const { planIds: subscriptionPlanIds } = await subscriptionStore.get(
      apiRef,
    );
    const prepared = await preparePublish({
      apiRef,
      entity,
      client,
      definitionStore,
      documentStore,
      config,
      logger,
      subscriptionPlanIds,
    });
    res.json({
      metadata: prepared.metadata,
      documents: {
        toPublish: prepared.documentsToPublish.map(d => d.name),
        skipped: prepared.skippedDocuments,
      },
    });
  });

  router.post(PUBLISH_PATH, async (req, res) => {
    const accessToken = requirePortalToken(req);
    const overrides = requirePublishOverrides(req);
    const { apiRef, entity } = await resolve(req);
    await portalClient.checkAccessible();

    const { planIds: subscriptionPlanIds } = await subscriptionStore.get(
      apiRef,
    );

    const result = await publishApiToPortal({
      apiRef,
      entity,
      client,
      portalClient,
      definitionStore,
      documentStore,
      accessToken,
      config,
      logger,
      overrides,
      subscriptionPlanIds,
    });
    res.json(result);
  });
}
