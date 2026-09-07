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

import { ConflictError, NotFoundError } from '@backstage/errors';
import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { ApiRef } from '../types';

const ARTIFACTS_TABLE = 'wso2_artifacts';
const CONTENT_TABLE = 'wso2_artifact_content';
const DOCUMENT_KIND = 'document';

export type ArtifactRow = {
  id: string;
  artifact_kind: string;
  source_kind: string;
  gateway_id: string;
  api_id: string;
  api_version: string | null;
  entity_ref: string | null;
  name: string;
  doc_type: string;
  other_type_name: string | null;
  summary: string | null;
  source_type: string;
  visibility: string;
  source_url: string | null;
  created_by: string | null;
  created_at: string | Date;
  updated_by: string | null;
  updated_at: string | Date;
};

export type ArtifactContentRow = {
  artifact_id: string;
  storage_backend: string;
  storage_ref: string | null;
  mime_type: string | null;
  file_name: string | null;
  size_bytes: number | string | null;
  checksum: string | null;
  content_text: string | null;
  content_blob: Buffer | null;
  created_at: string | Date;
  updated_at: string | Date;
};

export type NewArtifactMetadata = Omit<
  ArtifactRow,
  'id' | 'artifact_kind' | 'created_at' | 'updated_at'
>;

export type ArtifactMetadataPatch = Partial<
  Pick<
    ArtifactRow,
    | 'name'
    | 'doc_type'
    | 'other_type_name'
    | 'summary'
    | 'visibility'
    | 'source_url'
    | 'updated_by'
  >
>;

export type NewArtifactContent = Omit<
  ArtifactContentRow,
  'artifact_id' | 'created_at' | 'updated_at'
>;

function naturalKeyWhere(ref: ApiRef) {
  return {
    source_kind: ref.sourceKind,
    gateway_id: ref.gatewayId,
    api_id: ref.apiId,
    artifact_kind: DOCUMENT_KIND,
  };
}

function isUniqueConstraintViolation(err: unknown): boolean {
  const code = (err as { code?: string } | undefined)?.code;
  const message = (err as { message?: string } | undefined)?.message ?? '';
  return (
    code === '23505' || // PostgreSQL
    code === 'SQLITE_CONSTRAINT' ||
    code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    code === 'ER_DUP_ENTRY' || // MySQL/MariaDB
    message.includes('UNIQUE constraint failed') ||
    message.includes('Duplicate entry')
  );
}

export type ArtifactRowWithContentMeta = ArtifactRow & {
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | string | null;
};

export class ArtifactDao {
  constructor(private readonly knex: Knex) {}

  /**
   * Joins only the non-BLOB content columns (file name/type/size) so list
   * rendering never has to drag `content_blob`/`content_text` across the
   * wire.
   */
  async list(ref: ApiRef): Promise<ArtifactRowWithContentMeta[]> {
    return this.knex<ArtifactRow>(ARTIFACTS_TABLE)
      .leftJoin(
        CONTENT_TABLE,
        `${ARTIFACTS_TABLE}.id`,
        `${CONTENT_TABLE}.artifact_id`,
      )
      .where(naturalKeyWhere(ref))
      .select(
        `${ARTIFACTS_TABLE}.*`,
        `${CONTENT_TABLE}.file_name`,
        `${CONTENT_TABLE}.mime_type`,
        `${CONTENT_TABLE}.size_bytes`,
      )
      .orderBy(`${ARTIFACTS_TABLE}.name`, 'asc');
  }

  async get(ref: ApiRef, documentId: string): Promise<ArtifactRow> {
    const row = await this.knex<ArtifactRow>(ARTIFACTS_TABLE)
      .where({ id: documentId, ...naturalKeyWhere(ref) })
      .first();
    if (!row) {
      throw new NotFoundError(`Document '${documentId}' not found`);
    }
    return row;
  }

  async getContent(
    documentId: string,
  ): Promise<ArtifactContentRow | undefined> {
    return this.knex<ArtifactContentRow>(CONTENT_TABLE)
      .where({ artifact_id: documentId })
      .first();
  }

  async create(
    metadata: NewArtifactMetadata,
    content: NewArtifactContent | undefined,
  ): Promise<ArtifactRow> {
    const id = uuidv4();
    try {
      await this.knex.transaction(async trx => {
        await trx(ARTIFACTS_TABLE).insert({
          id,
          artifact_kind: DOCUMENT_KIND,
          ...metadata,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        });
        if (content) {
          await trx(CONTENT_TABLE).insert({
            artifact_id: id,
            ...content,
            created_at: trx.fn.now(),
            updated_at: trx.fn.now(),
          });
        }
      });
    } catch (err) {
      if (isUniqueConstraintViolation(err)) {
        throw new ConflictError(
          `A document named '${metadata.name}' already exists for this API`,
        );
      }
      throw err;
    }
    return this.get(
      {
        sourceKind: metadata.source_kind as ApiRef['sourceKind'],
        gatewayId: metadata.gateway_id,
        apiId: metadata.api_id,
        entityRef: metadata.entity_ref ?? '',
      },
      id,
    );
  }

  async updateMetadata(
    ref: ApiRef,
    documentId: string,
    patch: ArtifactMetadataPatch,
  ): Promise<ArtifactRow> {
    try {
      const updated = await this.knex(ARTIFACTS_TABLE)
        .where({ id: documentId, ...naturalKeyWhere(ref) })
        .update({ ...patch, updated_at: this.knex.fn.now() });
      if (!updated) {
        throw new NotFoundError(`Document '${documentId}' not found`);
      }
    } catch (err) {
      if (isUniqueConstraintViolation(err)) {
        throw new ConflictError(
          `A document named '${patch.name}' already exists for this API`,
        );
      }
      throw err;
    }
    return this.get(ref, documentId);
  }

  async delete(ref: ApiRef, documentId: string): Promise<void> {
    await this.knex.transaction(async trx => {
      const row = await trx<ArtifactRow>(ARTIFACTS_TABLE)
        .where({ id: documentId, ...naturalKeyWhere(ref) })
        .first();
      if (!row) {
        throw new NotFoundError(`Document '${documentId}' not found`);
      }
      // ON DELETE CASCADE is not reliable on SQLite unless
      // `PRAGMA foreign_keys = ON` is guaranteed, so both rows are deleted
      // explicitly inside this transaction rather than relying on it.
      await trx(CONTENT_TABLE).where({ artifact_id: documentId }).delete();
      await trx(ARTIFACTS_TABLE).where({ id: documentId }).delete();
    });
  }

  /** Refreshes the cached entity_ref column. */
  async refreshEntityRef(documentId: string, entityRef: string): Promise<void> {
    await this.knex(ARTIFACTS_TABLE)
      .where({ id: documentId })
      .update({ entity_ref: entityRef });
  }
}
