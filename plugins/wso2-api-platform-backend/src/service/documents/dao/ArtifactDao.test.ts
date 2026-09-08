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
import { TestDatabases } from '@backstage/backend-test-utils';
import type { Knex } from 'knex';
import { ArtifactDao } from './ArtifactDao';
import { applyDatabaseMigrations } from './migrations';
import { ApiRef } from '../types';

const REF: ApiRef = {
  sourceKind: 'self-hosted',
  gatewayId: 'env-1',
  apiId: 'gateway-api-1',
  entityRef: 'api:wso2-gateways/orders-api',
};

const databases = TestDatabases.create({ ids: ['SQLITE_3'] });

describe.each(databases.eachSupportedId())('ArtifactDao (%s)', dbId => {
  let knex: Knex;
  let dao: ArtifactDao;

  beforeEach(async () => {
    knex = await databases.init(dbId);
    await applyDatabaseMigrations(knex);
    dao = new ArtifactDao(knex);
  }, 60_000);

  it('creates and lists a document without dragging blob columns', async () => {
    const created = await dao.create(
      {
        source_kind: REF.sourceKind,
        gateway_id: REF.gatewayId,
        api_id: REF.apiId,
        api_version: null,
        entity_ref: REF.entityRef,
        name: 'Getting Started',
        doc_type: 'HOWTO',
        other_type_name: null,
        summary: 'A guide',
        source_type: 'MARKDOWN',
        source_url: null,
        created_by: 'user:default/alice',
        updated_by: 'user:default/alice',
      },
      {
        storage_backend: 'database',
        storage_ref: null,
        mime_type: 'text/markdown',
        file_name: null,
        size_bytes: 7,
        checksum: 'abc123',
        content_text: '# Hello',
        content_blob: null,
      },
    );

    expect(created.name).toBe('Getting Started');

    const list = await dao.list(REF);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      name: 'Getting Started',
      mime_type: 'text/markdown',
    });
    expect(list[0]).not.toHaveProperty('content_text');
    expect(list[0]).not.toHaveProperty('content_blob');
  });

  it('round-trips a binary FILE document byte-for-byte', async () => {
    const blob = Buffer.from([0, 1, 2, 254, 255, 42]);
    const created = await dao.create(
      {
        source_kind: REF.sourceKind,
        gateway_id: REF.gatewayId,
        api_id: REF.apiId,
        api_version: null,
        entity_ref: REF.entityRef,
        name: 'Spec',
        doc_type: 'SAMPLES',
        other_type_name: null,
        summary: null,
        source_type: 'FILE',
        source_url: null,
        created_by: null,
        updated_by: null,
      },
      {
        storage_backend: 'database',
        storage_ref: null,
        mime_type: 'application/octet-stream',
        file_name: 'spec.bin',
        size_bytes: blob.length,
        checksum: 'deadbeef',
        content_text: null,
        content_blob: blob,
      },
    );

    const content = await dao.getContent(created.id);
    expect(content?.content_blob).toBeInstanceOf(Buffer);
    expect(Buffer.compare(content!.content_blob as Buffer, blob)).toBe(0);
  });

  it('rejects a duplicate document name for the same API with 409', async () => {
    const metadata = {
      source_kind: REF.sourceKind,
      gateway_id: REF.gatewayId,
      api_id: REF.apiId,
      api_version: null,
      entity_ref: REF.entityRef,
      name: 'Duplicate',
      doc_type: 'HOWTO',
      other_type_name: null,
      summary: null,
      source_type: 'URL',
      source_url: 'https://example.com',
      created_by: null,
      updated_by: null,
    };
    await dao.create(metadata, undefined);
    await expect(dao.create(metadata, undefined)).rejects.toThrow(
      ConflictError,
    );
  });

  it('allows the same document name across different APIs', async () => {
    const base = {
      api_version: null,
      doc_type: 'HOWTO',
      other_type_name: null,
      summary: null,
      source_type: 'URL' as const,
      source_url: 'https://example.com',
      created_by: null,
      updated_by: null,
    };
    await dao.create(
      {
        ...base,
        source_kind: 'self-hosted',
        gateway_id: 'env-1',
        api_id: 'api-a',
        entity_ref: null,
        name: 'README',
      },
      undefined,
    );
    await expect(
      dao.create(
        {
          ...base,
          source_kind: 'self-hosted',
          gateway_id: 'env-1',
          api_id: 'api-b',
          entity_ref: null,
          name: 'README',
        },
        undefined,
      ),
    ).resolves.toMatchObject({ name: 'README' });
  });

  it('deletes both the artifact and content rows transactionally', async () => {
    const created = await dao.create(
      {
        source_kind: REF.sourceKind,
        gateway_id: REF.gatewayId,
        api_id: REF.apiId,
        api_version: null,
        entity_ref: REF.entityRef,
        name: 'To delete',
        doc_type: 'HOWTO',
        other_type_name: null,
        summary: null,
        source_type: 'INLINE',
        source_url: null,
        created_by: null,
        updated_by: null,
      },
      {
        storage_backend: 'database',
        storage_ref: null,
        mime_type: 'text/plain',
        file_name: null,
        size_bytes: 5,
        checksum: 'x',
        content_text: 'hello',
        content_blob: null,
      },
    );

    await dao.delete(REF, created.id);

    await expect(dao.get(REF, created.id)).rejects.toThrow(NotFoundError);
    expect(await dao.getContent(created.id)).toBeUndefined();
  });

  it('scopes get()/delete() to the natural key so a document id from another API is not reachable', async () => {
    const created = await dao.create(
      {
        source_kind: REF.sourceKind,
        gateway_id: REF.gatewayId,
        api_id: REF.apiId,
        api_version: null,
        entity_ref: REF.entityRef,
        name: 'Scoped doc',
        doc_type: 'HOWTO',
        other_type_name: null,
        summary: null,
        source_type: 'URL',
        source_url: 'https://example.com',
        created_by: null,
        updated_by: null,
      },
      undefined,
    );

    const otherRef: ApiRef = { ...REF, apiId: 'a-different-api' };
    await expect(dao.get(otherRef, created.id)).rejects.toThrow(NotFoundError);
    await expect(dao.delete(otherRef, created.id)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('renames on updateMetadata and re-checks the uniqueness constraint', async () => {
    const first = await dao.create(
      {
        source_kind: REF.sourceKind,
        gateway_id: REF.gatewayId,
        api_id: REF.apiId,
        api_version: null,
        entity_ref: REF.entityRef,
        name: 'First',
        doc_type: 'HOWTO',
        other_type_name: null,
        summary: null,
        source_type: 'URL',
        source_url: 'https://example.com/1',
        created_by: null,
        updated_by: null,
      },
      undefined,
    );
    const second = await dao.create(
      {
        source_kind: REF.sourceKind,
        gateway_id: REF.gatewayId,
        api_id: REF.apiId,
        api_version: null,
        entity_ref: REF.entityRef,
        name: 'Second',
        doc_type: 'HOWTO',
        other_type_name: null,
        summary: null,
        source_type: 'URL',
        source_url: 'https://example.com/2',
        created_by: null,
        updated_by: null,
      },
      undefined,
    );

    const renamed = await dao.updateMetadata(REF, first.id, {
      name: 'Renamed',
    });
    expect(renamed.name).toBe('Renamed');

    await expect(
      dao.updateMetadata(REF, second.id, { name: 'Renamed' }),
    ).rejects.toThrow(ConflictError);
  });
});

describe.each(databases.eachSupportedId())(
  'ArtifactDao upsertSingleton (%s)',
  dbId => {
    let knex: Knex;
    let dao: ArtifactDao;

    beforeEach(async () => {
      knex = await databases.init(dbId);
      await applyDatabaseMigrations(knex);
      dao = new ArtifactDao(knex, 'definition');
    }, 60_000);

    const metadata = {
      source_kind: REF.sourceKind,
      gateway_id: REF.gatewayId,
      api_id: REF.apiId,
      api_version: null,
      entity_ref: REF.entityRef,
      name: 'definition',
      doc_type: 'YAML',
      other_type_name: null,
      summary: null,
      source_type: 'FILE',
      source_url: null,
      created_by: 'user:default/alice',
      updated_by: 'user:default/alice',
    };

    const content = {
      storage_backend: 'database',
      storage_ref: null,
      mime_type: 'application/yaml',
      file_name: 'openapi.yaml',
      size_bytes: 10,
      checksum: 'v1',
      content_text: 'openapi: 3.0.0',
      content_blob: null,
    };

    it('creates a new singleton row when none exists yet', async () => {
      const created = await dao.upsertSingleton(REF, metadata, content);
      expect(created).toMatchObject({
        artifact_kind: 'definition',
        name: 'definition',
      });

      const fetched = await dao.getSingleton(REF);
      expect(fetched?.id).toBe(created.id);
    });

    it('replaces metadata and content on a second upsert, keeping the same row id and original created_by', async () => {
      const first = await dao.upsertSingleton(REF, metadata, content);

      const second = await dao.upsertSingleton(
        REF,
        {
          ...metadata,
          doc_type: 'JSON',
          created_by: 'user:default/bob',
          updated_by: 'user:default/bob',
        },
        {
          ...content,
          content_text: '{"openapi":"3.0.0"}',
          mime_type: 'application/json',
        },
      );

      expect(second.id).toBe(first.id);
      expect(second.doc_type).toBe('JSON');
      expect(second.created_by).toBe('user:default/alice');
      expect(second.updated_by).toBe('user:default/bob');

      const replacedContent = await dao.getContent(first.id);
      expect(replacedContent?.content_text).toBe('{"openapi":"3.0.0"}');
    });

    it('does not affect document-kind rows for the same API', async () => {
      const documentDao = new ArtifactDao(knex, 'document');
      await documentDao.create(
        {
          source_kind: REF.sourceKind,
          gateway_id: REF.gatewayId,
          api_id: REF.apiId,
          api_version: null,
          entity_ref: REF.entityRef,
          name: 'definition', // same name, different kind — must not collide
          doc_type: 'HOWTO',
          other_type_name: null,
          summary: null,
          source_type: 'URL',
          source_url: 'https://example.com',
          created_by: null,
          updated_by: null,
        },
        undefined,
      );

      await expect(
        dao.upsertSingleton(REF, metadata, content),
      ).resolves.toMatchObject({ artifact_kind: 'definition' });

      const documentList = await documentDao.list(REF);
      expect(documentList).toHaveLength(1);
    });
  },
);
