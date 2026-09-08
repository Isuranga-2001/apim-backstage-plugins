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

import { InputError } from '@backstage/errors';
import { DocumentStorageConfig } from './config';
import {
  assertFileAllowed,
  assertInlineSizeWithinLimit,
  parseCreateDocumentMetadata,
  parseUpdateDocumentMetadata,
} from './validation';

const config: DocumentStorageConfig = {
  enabled: true,
  maxFileSizeBytes: 1024,
  maxInlineSizeBytes: 100,
  allowedExtensions: ['pdf', 'md'],
  allowedMimeTypes: [],
  binaryBackend: 'database',
};

describe('parseCreateDocumentMetadata', () => {
  it('accepts a well-formed MARKDOWN document', () => {
    const result = parseCreateDocumentMetadata({
      name: 'Getting Started',
      type: 'HOWTO',
      sourceType: 'MARKDOWN',
      inlineContent: '# Hello',
    });
    expect(result).toMatchObject({
      name: 'Getting Started',
      type: 'HOWTO',
      sourceType: 'MARKDOWN',
    });
  });

  it('rejects a missing name', () => {
    expect(() =>
      parseCreateDocumentMetadata({
        type: 'HOWTO',
        sourceType: 'MARKDOWN',
        inlineContent: 'x',
      }),
    ).toThrow(InputError);
  });

  it("requires otherTypeName when type is 'OTHER'", () => {
    expect(() =>
      parseCreateDocumentMetadata({
        name: 'Doc',
        type: 'OTHER',
        sourceType: 'MARKDOWN',
        inlineContent: 'x',
      }),
    ).toThrow(/otherTypeName is required/);
  });

  it("requires an http(s) sourceUrl when sourceType is 'URL'", () => {
    expect(() =>
      parseCreateDocumentMetadata({
        name: 'Doc',
        type: 'HOWTO',
        sourceType: 'URL',
        sourceUrl: 'ftp://not-http-or-https.example.com',
      }),
    ).toThrow(/sourceUrl is required/);

    const result = parseCreateDocumentMetadata({
      name: 'Doc',
      type: 'HOWTO',
      sourceType: 'URL',
      sourceUrl: 'https://example.com/doc',
    });
    expect(result.sourceUrl).toBe('https://example.com/doc');
  });

  it.each(['INLINE', 'MARKDOWN'] as const)(
    'requires non-empty inlineContent for %s',
    sourceType => {
      expect(() =>
        parseCreateDocumentMetadata({
          name: 'Doc',
          type: 'HOWTO',
          sourceType,
          inlineContent: '   ',
        }),
      ).toThrow(/inlineContent is required/);
    },
  );

  it('ignores unknown fields rather than rejecting the request', () => {
    expect(() =>
      parseCreateDocumentMetadata({
        name: 'Doc',
        type: 'HOWTO',
        sourceType: 'FILE',
        unexpected: true,
      }),
    ).not.toThrow();
  });
});

describe('parseUpdateDocumentMetadata', () => {
  it('accepts a partial patch', () => {
    const result = parseUpdateDocumentMetadata({ summary: 'Updated summary' });
    expect(result).toEqual({ summary: 'Updated summary' });
  });

  it('rejects content fields', () => {
    expect(() => parseUpdateDocumentMetadata({ sourceType: 'FILE' })).toThrow(
      InputError,
    );
    expect(() => parseUpdateDocumentMetadata({ inlineContent: 'x' })).toThrow(
      InputError,
    );
  });

  it('rejects a non-http(s) sourceUrl', () => {
    expect(() =>
      parseUpdateDocumentMetadata({ sourceUrl: 'ftp://example.com' }),
    ).toThrow(/sourceUrl must be an http/);
  });
});

describe('assertInlineSizeWithinLimit', () => {
  it('passes for content within the limit', () => {
    expect(() => assertInlineSizeWithinLimit('short', config)).not.toThrow();
  });

  it('throws for content exceeding the limit', () => {
    expect(() => assertInlineSizeWithinLimit('x'.repeat(200), config)).toThrow(
      InputError,
    );
  });
});

describe('assertFileAllowed', () => {
  it('passes for an allowed extension within the size cap', () => {
    expect(() =>
      assertFileAllowed(
        { originalname: 'spec.pdf', mimetype: 'application/pdf', size: 100 },
        config,
      ),
    ).not.toThrow();
  });

  it('rejects a disallowed extension', () => {
    expect(() =>
      assertFileAllowed(
        {
          originalname: 'malware.exe',
          mimetype: 'application/x-msdownload',
          size: 10,
        },
        config,
      ),
    ).toThrow(/extension/);
  });

  it('rejects a file exceeding the size cap', () => {
    expect(() =>
      assertFileAllowed(
        { originalname: 'spec.pdf', mimetype: 'application/pdf', size: 2000 },
        config,
      ),
    ).toThrow(/exceeding the configured limit/);
  });
});
