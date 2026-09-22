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

import { ConfigReader } from '@backstage/config';
import { readApiPortalConfig } from './config';

describe('readApiPortalConfig', () => {
  it('defaults to disabled, mode platform-login', () => {
    const result = readApiPortalConfig(new ConfigReader({}));
    expect(result.enabled).toBe(false);
    expect(result.auth).toEqual({ mode: 'platform-login' });
  });

  it('reads an enabled platform-login configuration', () => {
    const result = readApiPortalConfig(
      new ConfigReader({
        wso2ApiPlatformApiPortal: {
          enabled: true,
          baseUrl: 'https://portal.example.com',
          auth: { mode: 'platform-login' },
        },
      }),
    );

    expect(result.enabled).toBe(true);
    expect(result.auth).toEqual({ mode: 'platform-login' });
  });

  it('rejects an auth.mode other than platform-login or idp', () => {
    expect(() =>
      readApiPortalConfig(
        new ConfigReader({
          wso2ApiPlatformApiPortal: { auth: { mode: 'client-credentials' } },
        }),
      ),
    ).toThrow(/use 'platform-login' or 'idp'/);
  });

  it('allows mode idp when enabled, defaulting the strategy to manual', () => {
    const result = readApiPortalConfig(
      new ConfigReader({
        wso2ApiPlatformApiPortal: { enabled: true, auth: { mode: 'idp' } },
      }),
    );
    expect(result.auth).toEqual({ mode: 'idp', idp: { strategy: 'manual' } });
  });

  it('allows mode idp when disabled', () => {
    expect(() =>
      readApiPortalConfig(
        new ConfigReader({
          wso2ApiPlatformApiPortal: { enabled: false, auth: { mode: 'idp' } },
        }),
      ),
    ).not.toThrow();
  });

  it('rejects an unsupported idp.strategy', () => {
    expect(() =>
      readApiPortalConfig(
        new ConfigReader({
          wso2ApiPlatformApiPortal: {
            enabled: true,
            auth: { mode: 'idp', idp: { strategy: 'bogus' } },
          },
        }),
      ),
    ).toThrow(/idp.strategy 'bogus' is not supported/);
  });

  it('reads a service-account strategy configuration, applying the default scope', () => {
    const result = readApiPortalConfig(
      new ConfigReader({
        wso2ApiPlatformApiPortal: {
          enabled: true,
          auth: {
            mode: 'idp',
            idp: {
              strategy: 'service-account',
              serviceAccount: {
                tokenUrl: 'https://idp.example.com/oauth2/token',
                clientId: 'client-id',
                clientSecret: 'client-secret',
              },
            },
          },
        },
      }),
    );
    expect(result.auth).toEqual({
      mode: 'idp',
      idp: {
        strategy: 'service-account',
        serviceAccount: {
          tokenUrl: 'https://idp.example.com/oauth2/token',
          clientId: 'client-id',
          clientSecret: 'client-secret',
          audience: undefined,
          scope:
            'dp:api:manage dp:api_content:manage dp:label:read dp:subscription_plan:read',
        },
        reuseSignIn: undefined,
      },
    });
  });

  it('requires serviceAccount fields when enabled and strategy is service-account', () => {
    expect(() =>
      readApiPortalConfig(
        new ConfigReader({
          wso2ApiPlatformApiPortal: {
            enabled: true,
            auth: { mode: 'idp', idp: { strategy: 'service-account' } },
          },
        }),
      ),
    ).toThrow();
  });

  it('reads a reuse-signin strategy configuration', () => {
    const result = readApiPortalConfig(
      new ConfigReader({
        wso2ApiPlatformApiPortal: {
          enabled: true,
          auth: {
            mode: 'idp',
            idp: {
              strategy: 'reuse-signin',
              reuseSignIn: { providerId: 'oauth2', scopes: ['dp:api:manage'] },
            },
          },
        },
      }),
    );
    expect(result.auth.idp?.reuseSignIn).toEqual({
      providerId: 'oauth2',
      scopes: ['dp:api:manage'],
    });
  });
});
