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

import {
  RestApiArtifact,
  adaptRawRestApiArtifact,
  diffRestApiArtifacts,
  mapDefinitionToRestApiArtifact,
} from './restApiArtifactMapper';

const PREVIOUS: RestApiArtifact = {
  apiVersion: 'gateway.api-platform.wso2.com/v1',
  kind: 'RestApi',
  metadata: { name: 'reading-list-api-v1.0' },
  spec: {
    displayName: 'Reading-List-API',
    version: 'v1.0',
    context: '/reading-list/$version',
    upstream: { main: { url: 'https://apis.example.com/reading-list/v1.0' } },
    policies: [{ name: 'cors', version: 'v1' }],
    operations: [
      { method: 'GET', path: '/books' },
      { method: 'POST', path: '/books' },
      {
        method: 'GET',
        path: '/books/{id}',
        policies: [{ name: 'set-headers', version: 'v1' }],
      },
      { method: 'PUT', path: '/books/{id}' },
      { method: 'DELETE', path: '/books/{id}' },
    ],
  },
};

const DEFINITION_SAME_SHAPE = `openapi: 3.0.0
info:
  title: Reading-List-API
  version: v1.0
paths:
  /books:
    get: {}
    post: {}
  /books/{bookId}:
    get: {}
    put: {}
    delete: {}
`;

describe('adaptRawRestApiArtifact', () => {
  it('strips the readOnly status field from a RestApi CR response', () => {
    const raw = {
      ...PREVIOUS,
      status: { id: 'reading-list-api-v1.0', state: 'deployed' },
    };
    expect(adaptRawRestApiArtifact(raw)).toEqual({
      apiVersion: PREVIOUS.apiVersion,
      kind: PREVIOUS.kind,
      metadata: PREVIOUS.metadata,
      spec: PREVIOUS.spec,
    });
  });

  it('returns undefined for a response that is not a RestApi resource', () => {
    expect(
      adaptRawRestApiArtifact({ status: 'success', api: {} }),
    ).toBeUndefined();
    expect(adaptRawRestApiArtifact(undefined)).toBeUndefined();
    expect(adaptRawRestApiArtifact({ kind: 'RestApi' })).toBeUndefined();
  });
});

describe('mapDefinitionToRestApiArtifact', () => {
  it('never touches metadata.name, apiVersion, kind, or non-derivable spec fields', () => {
    const next = mapDefinitionToRestApiArtifact(
      DEFINITION_SAME_SHAPE,
      PREVIOUS,
    );
    expect(next.metadata).toBe(PREVIOUS.metadata);
    expect(next.apiVersion).toBe(PREVIOUS.apiVersion);
    expect(next.kind).toBe(PREVIOUS.kind);
    expect(next.spec.context).toBe(PREVIOUS.spec.context);
    expect(next.spec.upstream).toBe(PREVIOUS.spec.upstream);
    expect(next.spec.policies).toBe(PREVIOUS.spec.policies);
  });

  it("preserves an existing operation's extra fields (e.g. policies) when only its path-param name changes", () => {
    const next = mapDefinitionToRestApiArtifact(
      DEFINITION_SAME_SHAPE,
      PREVIOUS,
    );
    const getById = next.spec.operations.find(
      op => op.method === 'GET' && op.path === '/books/{bookId}',
    );
    expect(getById).toEqual({
      method: 'GET',
      path: '/books/{bookId}',
      policies: [{ name: 'set-headers', version: 'v1' }],
    });
  });

  it('drops operations no longer present in the definition and adds new bare ones', () => {
    const definition = `openapi: 3.0.0
info:
  title: Reading-List-API
  version: v1.0
paths:
  /books:
    get: {}
  /authors:
    get: {}
`;
    const next = mapDefinitionToRestApiArtifact(definition, PREVIOUS);
    expect(next.spec.operations).toEqual([
      { method: 'GET', path: '/books' },
      { method: 'GET', path: '/authors' },
    ]);
  });

  it('updates displayName and version from info.title/info.version', () => {
    const definition = `openapi: 3.0.0
info:
  title: Renamed API
  version: v2.0
paths: {}
`;
    const next = mapDefinitionToRestApiArtifact(definition, PREVIOUS);
    expect(next.spec.displayName).toBe('Renamed API');
    expect(next.spec.version).toBe('v2.0');
  });
});

describe('diffRestApiArtifacts', () => {
  it('reports no changes for an artifact that only differs in path-param naming', () => {
    const next = mapDefinitionToRestApiArtifact(
      DEFINITION_SAME_SHAPE,
      PREVIOUS,
    );
    const diff = diffRestApiArtifacts(PREVIOUS, next);
    expect(diff).toEqual({
      displayNameChange: undefined,
      versionChange: undefined,
      addedOperations: [],
      removedOperations: [],
      hasChanges: false,
    });
  });

  it('reports added and removed operations', () => {
    const definition = `openapi: 3.0.0
info:
  title: Reading-List-API
  version: v1.0
paths:
  /books:
    get: {}
    post: {}
  /books/{id}:
    get: {}
    patch: {}
`;
    const next = mapDefinitionToRestApiArtifact(definition, PREVIOUS);
    const diff = diffRestApiArtifacts(PREVIOUS, next);
    expect(diff.hasChanges).toBe(true);
    expect(diff.addedOperations).toEqual([
      { method: 'PATCH', path: '/books/{id}' },
    ]);
    expect(diff.removedOperations).toEqual(
      expect.arrayContaining([
        { method: 'PUT', path: '/books/{id}' },
        { method: 'DELETE', path: '/books/{id}' },
      ]),
    );
  });

  it('reports title/version changes exactly, even when only formatting differs', () => {
    // Regression: a normalized comparison hid "Payment-API-Service" -> "Payment API Service".
    const onlyFormattingDiffers = mapDefinitionToRestApiArtifact(
      `openapi: 3.0.0
info:
  title: reading list api
  version: V1.0
paths:
  /books:
    get: {}
    post: {}
  /books/{id}:
    get: {}
    put: {}
    delete: {}
`,
      PREVIOUS,
    );
    const formattingDiff = diffRestApiArtifacts(
      PREVIOUS,
      onlyFormattingDiffers,
    );
    expect(formattingDiff.hasChanges).toBe(true);
    expect(formattingDiff.displayNameChange).toEqual({
      from: 'Reading-List-API',
      to: 'reading list api',
    });
    expect(formattingDiff.versionChange).toEqual({ from: 'v1.0', to: 'V1.0' });

    const renamed = mapDefinitionToRestApiArtifact(
      `openapi: 3.0.0
info:
  title: Totally Different API
  version: v9.9
paths: {}
`,
      PREVIOUS,
    );
    const diff = diffRestApiArtifacts(PREVIOUS, renamed);
    expect(diff.displayNameChange).toEqual({
      from: 'Reading-List-API',
      to: 'Totally Different API',
    });
    expect(diff.versionChange).toEqual({ from: 'v1.0', to: 'v9.9' });
  });

  it('reports no title/version change when the definition is identical', () => {
    const next = mapDefinitionToRestApiArtifact(
      DEFINITION_SAME_SHAPE,
      PREVIOUS,
    );
    const diff = diffRestApiArtifacts(PREVIOUS, next);
    expect(diff.displayNameChange).toBeUndefined();
    expect(diff.versionChange).toBeUndefined();
  });
});
