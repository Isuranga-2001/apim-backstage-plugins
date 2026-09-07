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

import { BackstageCredentials } from '@backstage/backend-plugin-api';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { NotFoundError } from '@backstage/errors';
import type { CatalogService } from '@backstage/plugin-catalog-node';
import { ApiRef, ApiSourceKind } from '../types';
import { ApiDefinitionStore } from './ApiDefinitionStore';

const DISCOVERY_TYPE_ANNOTATION = 'wso2.com/api-discovery-type';
const GATEWAY_API_ID_ANNOTATION = 'wso2-gateway.com/api-id';
const GATEWAY_ENDPOINTS_ANNOTATION = 'wso2-gateway.com/api-endpoints';

export type ResolvedApiDefinitionStore = {
  apiRef: ApiRef;
  store: ApiDefinitionStore;
};

function extractGatewayId(endpointsAnnotation: string | undefined): string {
  if (!endpointsAnnotation) {
    return '';
  }
  try {
    const endpoints = JSON.parse(endpointsAnnotation) as Array<{
      environmentName?: string;
    }>;
    return endpoints[0]?.environmentName ?? '';
  } catch {
    return '';
  }
}

export class ApiDefinitionStoreResolver {
  constructor(
    private readonly catalog: CatalogService,
    private readonly databaseStore: ApiDefinitionStore,
  ) {}

  async resolve(
    entityTriple: { kind: string; namespace: string; name: string },
    credentials: BackstageCredentials,
  ): Promise<ResolvedApiDefinitionStore> {
    const entityRef = stringifyEntityRef({
      kind: entityTriple.kind,
      namespace: entityTriple.namespace,
      name: entityTriple.name,
    });
    const entity = await this.catalog.getEntityByRef(entityRef, {
      credentials,
    });
    if (!entity) {
      throw new NotFoundError(`Entity '${entityRef}' not found`);
    }

    const annotations = entity.metadata.annotations ?? {};
    const discoveryType = annotations[DISCOVERY_TYPE_ANNOTATION];

    if (
      discoveryType === 'self-hosted-gateway' ||
      discoveryType === 'openchoreo-gateway'
    ) {
      const apiId = annotations[GATEWAY_API_ID_ANNOTATION];
      if (!apiId) {
        throw new NotFoundError(
          `Entity '${entityRef}' is missing '${GATEWAY_API_ID_ANNOTATION}'`,
        );
      }
      const sourceKind: ApiSourceKind =
        discoveryType === 'openchoreo-gateway' ? 'openchoreo' : 'self-hosted';
      return {
        apiRef: {
          sourceKind,
          gatewayId: extractGatewayId(
            annotations[GATEWAY_ENDPOINTS_ANNOTATION],
          ),
          apiId,
          entityRef,
        },
        store: this.databaseStore,
      };
    }

    throw new NotFoundError(
      `Entity '${entityRef}' does not have a plugin-managed API definition`,
    );
  }
}
