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
import { ApiDocumentStore } from './ApiDocumentStore';

const DISCOVERY_TYPE_ANNOTATION = 'wso2.com/api-discovery-type';
const GATEWAY_API_ID_ANNOTATION = 'wso2-gateway.com/api-id';
const GATEWAY_ENDPOINTS_ANNOTATION = 'wso2-gateway.com/api-endpoints';
const APIM_API_ID_ANNOTATION = 'wso2.com/api-id';

export type ResolvedApiDocumentStore = {
  apiRef: ApiRef;
  store: ApiDocumentStore;
};

/**
 * A gateway entity's endpoints annotation can carry more than one
 * environment when the discovery service merges same-named APIs across
 * gateways. Documents are kept per-gateway, so the first listed environment
 * is used as the natural key's gateway_id — this only matters for that
 * merged-entity edge case, which is a pre-existing ambiguity in the catalog
 * data rather than something introduced here.
 */
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

/**
 * Maps a catalog entity to the store that owns its documents. Uses
 * `wso2.com/api-discovery-type` (not `wso2.com/api-gateway`, which is only a
 * display label) to distinguish self-hosted/OpenChoreo gateway APIs from
 * on-prem APIM APIs.
 */
export class ApiDocumentStoreResolver {
  constructor(
    private readonly catalog: CatalogService,
    private readonly databaseStore: ApiDocumentStore,
    private readonly apimStore: ApiDocumentStore,
  ) {}

  async resolve(
    entityTriple: { kind: string; namespace: string; name: string },
    credentials: BackstageCredentials,
  ): Promise<ResolvedApiDocumentStore> {
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

    const apimApiId = annotations[APIM_API_ID_ANNOTATION];
    if (apimApiId) {
      return {
        apiRef: {
          sourceKind: 'apim',
          gatewayId: '',
          apiId: apimApiId,
          entityRef,
        },
        store: this.apimStore,
      };
    }

    throw new NotFoundError(
      `Entity '${entityRef}' is not a WSO2 API with document support`,
    );
  }
}
