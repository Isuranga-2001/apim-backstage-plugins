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

import { TestDatabases } from '@backstage/backend-test-utils';
import { ArtifactDao } from '../dao/ArtifactDao';
import { applyDatabaseMigrations } from '../dao/migrations';
import { ApiRef } from '../types';
import { DatabaseApiDefinitionStore } from './DatabaseApiDefinitionStore';

const REF: ApiRef = {
  sourceKind: 'openchoreo',
  gatewayId: 'env-1',
  apiId: 'api-1',
  entityRef: 'api:wso2-gateways/orders-api',
};

const ACTOR = { userEntityRef: 'user:default/alice' };

describe('DatabaseApiDefinitionStore', () => {
  const databases = TestDatabases.create({ ids: ['SQLITE_3'] });
  let store: DatabaseApiDefinitionStore;

  beforeEach(async () => {
    const knex = await databases.init('SQLITE_3');
    await applyDatabaseMigrations(knex);
    store = new DatabaseApiDefinitionStore(new ArtifactDao(knex, 'definition'));
  });

  it('reports read/write capabilities and no delete', () => {
    expect(store.capabilities).toEqual({ read: true, write: true });
  });

  it('returns null when no definition exists yet', async () => {
    await expect(store.get(REF)).resolves.toBeNull();
  });

  it('creates a definition from a YAML upload and detects the format', async () => {
    const created = await store.upsert(
      REF,
      {
        fileName: 'openapi.yaml',
        content: 'openapi: 3.0.0\ninfo:\n  title: X',
      },
      ACTOR,
    );

    expect(created).toMatchObject({
      format: 'YAML',
      fileName: 'openapi.yaml',
      createdBy: 'user:default/alice',
    });

    const fetched = await store.get(REF);
    expect(fetched?.content).toContain('openapi: 3.0.0');
  });

  it('detects JSON content and replaces YAML content on a subsequent upsert', async () => {
    await store.upsert(
      REF,
      { fileName: 'openapi.yaml', content: 'openapi: 3.0.0' },
      ACTOR,
    );

    const updated = await store.upsert(
      REF,
      { fileName: 'openapi.json', content: '{"openapi":"3.0.0"}' },
      { userEntityRef: 'user:default/bob' },
    );

    expect(updated.format).toBe('JSON');
    expect(updated.fileName).toBe('openapi.json');
    expect(updated.content).toBe('{"openapi":"3.0.0"}');
    expect(updated.createdBy).toBe('user:default/alice');
    expect(updated.lastUpdatedBy).toBe('user:default/bob');

    const fetched = await store.get(REF);
    expect(fetched?.content).toBe('{"openapi":"3.0.0"}');
    expect(fetched?.content).not.toContain('openapi: 3.0.0\n');
  });

  it('scopes definitions per API', async () => {
    await store.upsert(
      REF,
      { fileName: 'openapi.yaml', content: 'openapi: 3.0.0' },
      ACTOR,
    );

    const otherRef: ApiRef = { ...REF, apiId: 'a-different-api' };
    await expect(store.get(otherRef)).resolves.toBeNull();
  });
});
