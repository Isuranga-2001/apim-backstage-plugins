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

import { ArtifactDao } from '../dao/ArtifactDao';
import { Actor, ApiRef, ApiSubscriptionSelection } from '../types';
import { ApiSubscriptionPlanStore } from './ApiSubscriptionPlanStore';

const SUBSCRIPTIONS_NAME = 'subscription-plans';

function toIsoString(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function parsePlanIds(contentText: string | null | undefined): string[] {
  if (!contentText) {
    return [];
  }
  try {
    const parsed = JSON.parse(contentText);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export class DatabaseApiSubscriptionPlanStore
  implements ApiSubscriptionPlanStore
{
  constructor(private readonly dao: ArtifactDao) {}

  async get(ref: ApiRef): Promise<ApiSubscriptionSelection> {
    const row = await this.dao.getSingleton(ref);
    if (!row) {
      return { planIds: [] };
    }
    const content = await this.dao.getContent(row.id);
    return {
      planIds: parsePlanIds(content?.content_text),
      lastUpdatedBy: row.updated_by ?? undefined,
      lastUpdatedTime: toIsoString(row.updated_at),
    };
  }

  async set(
    ref: ApiRef,
    planIds: string[],
    actor: Actor,
  ): Promise<ApiSubscriptionSelection> {
    const content = JSON.stringify(planIds);
    const row = await this.dao.upsertSingleton(
      ref,
      {
        source_kind: ref.sourceKind,
        gateway_id: ref.gatewayId,
        api_id: ref.apiId,
        api_version: ref.apiVersion ?? null,
        entity_ref: ref.entityRef || null,
        name: SUBSCRIPTIONS_NAME,
        doc_type: 'JSON',
        other_type_name: null,
        summary: null,
        source_type: 'INLINE',
        source_url: null,
        created_by: actor.userEntityRef ?? null,
        updated_by: actor.userEntityRef ?? null,
      },
      {
        storage_backend: 'database',
        storage_ref: null,
        mime_type: 'application/json',
        file_name: null,
        size_bytes: Buffer.byteLength(content, 'utf8'),
        checksum: null,
        content_text: content,
        content_blob: null,
      },
    );
    return {
      planIds,
      lastUpdatedBy: row.updated_by ?? undefined,
      lastUpdatedTime: toIsoString(row.updated_at),
    };
  }
}
