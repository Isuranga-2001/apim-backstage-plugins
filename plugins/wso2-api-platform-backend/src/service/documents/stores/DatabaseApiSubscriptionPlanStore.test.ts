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
import { DatabaseApiSubscriptionPlanStore } from './DatabaseApiSubscriptionPlanStore';

const REF: ApiRef = {
  sourceKind: 'gateway',
  gatewayId: 'env-1',
  apiId: 'api-1',
  entityRef: 'api:wso2-gateways/orders-api',
};

const ACTOR = { userEntityRef: 'user:default/alice' };

describe('DatabaseApiSubscriptionPlanStore', () => {
  const databases = TestDatabases.create({ ids: ['SQLITE_3'] });
  let store: DatabaseApiSubscriptionPlanStore;

  beforeEach(async () => {
    const knex = await databases.init('SQLITE_3');
    await applyDatabaseMigrations(knex);
    store = new DatabaseApiSubscriptionPlanStore(
      new ArtifactDao(knex, 'subscription-plans'),
    );
  });

  it('returns an empty selection when nothing has been saved yet', async () => {
    await expect(store.get(REF)).resolves.toEqual({ planIds: [] });
  });

  it('persists a selection and returns it on the next get', async () => {
    await store.set(REF, ['Bronze', 'Gold'], ACTOR);

    const fetched = await store.get(REF);
    expect(fetched.planIds).toEqual(['Bronze', 'Gold']);
    expect(fetched.lastUpdatedBy).toBe('user:default/alice');
  });

  it('replaces the previous selection on a subsequent set', async () => {
    await store.set(REF, ['Bronze'], ACTOR);
    const updated = await store.set(REF, ['Gold', 'Custom-Plan'], {
      userEntityRef: 'user:default/bob',
    });

    expect(updated.planIds).toEqual(['Gold', 'Custom-Plan']);

    const fetched = await store.get(REF);
    expect(fetched.planIds).toEqual(['Gold', 'Custom-Plan']);
    expect(fetched.lastUpdatedBy).toBe('user:default/bob');
  });

  it('scopes selections per API', async () => {
    await store.set(REF, ['Bronze'], ACTOR);

    const otherRef: ApiRef = { ...REF, apiId: 'a-different-api' };
    await expect(store.get(otherRef)).resolves.toEqual({ planIds: [] });
  });
});
