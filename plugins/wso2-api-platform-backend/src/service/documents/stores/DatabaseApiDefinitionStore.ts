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

import { createHash } from 'crypto';
import { ArtifactDao, ArtifactRow } from '../dao/ArtifactDao';
import {
  Actor,
  ApiDefinition,
  ApiDefinitionCapabilities,
  ApiDefinitionFormat,
  ApiRef,
  UpsertDefinitionInput,
} from '../types';
import { ApiDefinitionStore } from './ApiDefinitionStore';

// Fixed name for every definition row — combined with the existing natural
// key uniqueness index, this is what enforces one definition per API.
const DEFINITION_NAME = 'definition';

function detectFormat(content: string): ApiDefinitionFormat {
  try {
    JSON.parse(content);
    return 'JSON';
  } catch {
    return 'YAML';
  }
}

function toIsoString(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function toApiDefinition(
  row: ArtifactRow,
  content: {
    content_text: string | null;
    file_name: string | null;
    size_bytes: number | string | null;
  },
): ApiDefinition {
  return {
    content: content.content_text ?? '',
    format: row.doc_type as ApiDefinitionFormat,
    fileName: content.file_name ?? undefined,
    sizeBytes:
      content.size_bytes !== undefined && content.size_bytes !== null
        ? Number(content.size_bytes)
        : undefined,
    createdBy: row.created_by ?? undefined,
    createdTime: toIsoString(row.created_at),
    lastUpdatedBy: row.updated_by ?? undefined,
    lastUpdatedTime: toIsoString(row.updated_at),
  };
}

export class DatabaseApiDefinitionStore implements ApiDefinitionStore {
  readonly capabilities: ApiDefinitionCapabilities = {
    read: true,
    write: true,
  };

  constructor(private readonly dao: ArtifactDao) {}

  async get(ref: ApiRef): Promise<ApiDefinition | null> {
    const row = await this.dao.getSingleton(ref);
    if (!row) {
      return null;
    }
    const content = await this.dao.getContent(row.id);
    return toApiDefinition(row, {
      content_text: content?.content_text ?? null,
      file_name: content?.file_name ?? null,
      size_bytes: content?.size_bytes ?? null,
    });
  }

  async upsert(
    ref: ApiRef,
    input: UpsertDefinitionInput,
    actor: Actor,
  ): Promise<ApiDefinition> {
    const format = detectFormat(input.content);

    const row = await this.dao.upsertSingleton(
      ref,
      {
        source_kind: ref.sourceKind,
        gateway_id: ref.gatewayId,
        api_id: ref.apiId,
        api_version: ref.apiVersion ?? null,
        entity_ref: ref.entityRef || null,
        name: DEFINITION_NAME,
        doc_type: format,
        other_type_name: null,
        summary: null,
        source_type: 'FILE',
        source_url: null,
        created_by: actor.userEntityRef ?? null,
        updated_by: actor.userEntityRef ?? null,
      },
      {
        storage_backend: 'database',
        storage_ref: null,
        mime_type: format === 'JSON' ? 'application/json' : 'application/yaml',
        file_name: input.fileName,
        size_bytes: Buffer.byteLength(input.content, 'utf8'),
        checksum: createHash('sha256')
          .update(input.content, 'utf8')
          .digest('hex'),
        content_text: input.content,
        content_blob: null,
      },
    );

    const content = await this.dao.getContent(row.id);
    return toApiDefinition(row, {
      content_text: content?.content_text ?? null,
      file_name: content?.file_name ?? null,
      size_bytes: content?.size_bytes ?? null,
    });
  }
}
