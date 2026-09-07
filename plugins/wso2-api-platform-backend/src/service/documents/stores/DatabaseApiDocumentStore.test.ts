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

import { InputError, NotFoundError } from '@backstage/errors';
import { TestDatabases } from '@backstage/backend-test-utils';
import { ArtifactDao } from '../dao/ArtifactDao';
import { applyDatabaseMigrations } from '../dao/migrations';
import { DatabaseBinaryStorage } from '../storage/DatabaseBinaryStorage';
import { ApiRef } from '../types';
import { DatabaseApiDocumentStore } from './DatabaseApiDocumentStore';

const REF: ApiRef = {
  sourceKind: 'openchoreo',
  gatewayId: 'env-1',
  apiId: 'api-1',
  entityRef: 'api:wso2-gateways/orders-api',
};

const ACTOR = { userEntityRef: 'user:default/alice' };

describe('DatabaseApiDocumentStore', () => {
  const databases = TestDatabases.create({ ids: ['SQLITE_3'] });
  let store: DatabaseApiDocumentStore;

  beforeEach(async () => {
    const knex = await databases.init('SQLITE_3');
    await applyDatabaseMigrations(knex);
    store = new DatabaseApiDocumentStore(
      new ArtifactDao(knex),
      new DatabaseBinaryStorage(),
    );
  });

  it('reports full read/write capabilities', () => {
    expect(store.capabilities).toEqual({
      read: true,
      create: true,
      updateMetadata: true,
      updateContent: false,
      delete: true,
    });
  });

  it('creates a MARKDOWN document and reads it back', async () => {
    const created = await store.create(
      REF,
      {
        name: 'Getting Started',
        type: 'HOWTO',
        sourceType: 'MARKDOWN',
        inlineContent: '# Hello',
      },
      ACTOR,
    );

    expect(created).toMatchObject({
      name: 'Getting Started',
      type: 'HOWTO',
      sourceType: 'MARKDOWN',
      visibility: 'API_LEVEL',
      createdBy: 'user:default/alice',
    });

    const fetched = await store.get(REF, created.documentId);
    expect(fetched).toMatchObject({ name: 'Getting Started' });

    const content = await store.getContent(REF, created.documentId);
    expect(content).toMatchObject({ kind: 'text', body: '# Hello' });
  });

  it('creates a URL document with no content row and redirects on getContent', async () => {
    const created = await store.create(
      REF,
      {
        name: 'External docs',
        type: 'HOWTO',
        sourceType: 'URL',
        sourceUrl: 'https://example.com/docs',
      },
      ACTOR,
    );

    const content = await store.getContent(REF, created.documentId);
    expect(content).toEqual({
      kind: 'redirect',
      url: 'https://example.com/docs',
    });
  });

  it('creates a FILE document and returns its bytes on getContent', async () => {
    const buffer = Buffer.from('hello world');
    const created = await store.create(
      REF,
      {
        name: 'Spec',
        type: 'SAMPLES',
        sourceType: 'FILE',
        file: { buffer, originalName: 'spec.txt', mimeType: 'text/plain' },
      },
      ACTOR,
    );

    const content = await store.getContent(REF, created.documentId);
    expect(content).toMatchObject({
      kind: 'buffer',
      fileName: 'spec.txt',
      contentType: 'text/plain',
    });
    expect(Buffer.compare((content as any).body, buffer)).toBe(0);
  });

  it("throws InputError when sourceType is 'FILE' but no file was provided", async () => {
    await expect(
      store.create(
        REF,
        { name: 'No file', type: 'HOWTO', sourceType: 'FILE' },
        ACTOR,
      ),
    ).rejects.toThrow(InputError);
  });

  it('lists documents ordered by name', async () => {
    await store.create(
      REF,
      {
        name: 'B',
        type: 'HOWTO',
        sourceType: 'URL',
        sourceUrl: 'https://example.com/b',
      },
      ACTOR,
    );
    await store.create(
      REF,
      {
        name: 'A',
        type: 'HOWTO',
        sourceType: 'URL',
        sourceUrl: 'https://example.com/a',
      },
      ACTOR,
    );

    const list = await store.list(REF);
    expect(list.map(d => d.name)).toEqual(['A', 'B']);
  });

  it('allows editing sourceUrl only for URL documents', async () => {
    const urlDoc = await store.create(
      REF,
      {
        name: 'Link',
        type: 'HOWTO',
        sourceType: 'URL',
        sourceUrl: 'https://example.com/old',
      },
      ACTOR,
    );
    const updated = await store.updateMetadata(
      REF,
      urlDoc.documentId,
      { sourceUrl: 'https://example.com/new' },
      ACTOR,
    );
    expect(updated.sourceUrl).toBe('https://example.com/new');

    const markdownDoc = await store.create(
      REF,
      {
        name: 'Guide',
        type: 'HOWTO',
        sourceType: 'MARKDOWN',
        inlineContent: '# Guide',
      },
      ACTOR,
    );
    await expect(
      store.updateMetadata(
        REF,
        markdownDoc.documentId,
        { sourceUrl: 'https://example.com/should-fail' },
        ACTOR,
      ),
    ).rejects.toThrow(/sourceUrl can only be edited/);
  });

  it("requires otherTypeName when renaming type to 'OTHER'", async () => {
    const doc = await store.create(
      REF,
      {
        name: 'Doc',
        type: 'HOWTO',
        sourceType: 'URL',
        sourceUrl: 'https://example.com',
      },
      ACTOR,
    );
    await expect(
      store.updateMetadata(REF, doc.documentId, { type: 'OTHER' }, ACTOR),
    ).rejects.toThrow(/otherTypeName is required/);

    const updated = await store.updateMetadata(
      REF,
      doc.documentId,
      { type: 'OTHER', otherTypeName: 'Custom' },
      ACTOR,
    );
    expect(updated).toMatchObject({ type: 'OTHER', otherTypeName: 'Custom' });
  });

  it('hard-deletes a document', async () => {
    const doc = await store.create(
      REF,
      {
        name: 'Temp',
        type: 'HOWTO',
        sourceType: 'URL',
        sourceUrl: 'https://example.com',
      },
      ACTOR,
    );
    await store.delete(REF, doc.documentId, ACTOR);
    await expect(store.get(REF, doc.documentId)).rejects.toThrow(NotFoundError);
  });
});
