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

import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { CatalogProcessor } from '@backstage/plugin-catalog-node';

const DISCOVERY_TYPE_ANNOTATION = 'wso2.com/api-discovery-type';

/** Tracks descriptions for gateway-discovered catalog entities. */
export const apiDescriptionOverrideTracker = {
  descriptions: new Map<string, string>(),
  set(entityRef: string, description: string | undefined): void {
    if (description) {
      this.descriptions.set(entityRef, description);
    } else {
      this.descriptions.delete(entityRef);
    }
  },
  get(entityRef: string): string | undefined {
    return this.descriptions.get(entityRef);
  },
  reset(): void {
    this.descriptions.clear();
  },
};

/** Applies tracked descriptions to gateway-discovered API entities. */
export class DefinitionDescriptionProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'DefinitionDescriptionProcessor';
  }

  async postProcessEntity(entity: Entity): Promise<Entity> {
    const discoveryType =
      entity.metadata.annotations?.[DISCOVERY_TYPE_ANNOTATION];
    const isGatewayDiscovered =
      entity.kind === 'API' && discoveryType === 'api-platform-gateway';

    const description =
      isGatewayDiscovered &&
      apiDescriptionOverrideTracker.get(stringifyEntityRef(entity));
    if (!description) {
      return entity;
    }

    return { ...entity, metadata: { ...entity.metadata, description } };
  }
}
