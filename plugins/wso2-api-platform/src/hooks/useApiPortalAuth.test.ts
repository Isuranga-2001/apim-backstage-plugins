/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react';
import { useApiHolder } from '@backstage/core-plugin-api';
import { useApiPortalAuth } from './useApiPortalAuth';
import { Wso2ApiPortalAuthConfig } from '../api';

jest.mock('@backstage/core-plugin-api', () => ({
  useApiHolder: jest.fn(),
  createApiRef: jest.fn((config: { id: string }) => ({ id: config.id })),
}));

describe('useApiPortalAuth', () => {
  const mockOAuthApi = { getAccessToken: jest.fn() };
  const apiHolder = { get: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (useApiHolder as jest.Mock).mockReturnValue(apiHolder);
  });

  it('returns manual mode when no strategy is configured', () => {
    const config: Wso2ApiPortalAuthConfig = { mode: 'platform-login' };
    const { result } = renderHook(() => useApiPortalAuth(config));
    expect(result.current).toEqual({ mode: 'manual' });
  });

  it('returns manual mode for the manual strategy', () => {
    const config: Wso2ApiPortalAuthConfig = { mode: 'idp', strategy: 'manual' };
    const { result } = renderHook(() => useApiPortalAuth(config));
    expect(result.current).toEqual({ mode: 'manual' });
  });

  it('returns service-account mode without touching the ApiHolder', () => {
    const config: Wso2ApiPortalAuthConfig = {
      mode: 'idp',
      strategy: 'service-account',
    };
    const { result } = renderHook(() => useApiPortalAuth(config));
    expect(result.current).toEqual({ mode: 'service-account' });
    expect(apiHolder.get).not.toHaveBeenCalled();
  });

  it('returns an auto getToken for reuse-signin when the provider is registered', async () => {
    apiHolder.get.mockReturnValue(mockOAuthApi);
    mockOAuthApi.getAccessToken.mockResolvedValue('user-token');
    const config: Wso2ApiPortalAuthConfig = {
      mode: 'idp',
      strategy: 'reuse-signin',
      reuseSignIn: { providerId: 'oauth2', scopes: ['dp:api:manage'] },
    };
    const { result } = renderHook(() => useApiPortalAuth(config));

    expect(result.current.mode).toBe('auto');
    expect(apiHolder.get).toHaveBeenCalledWith({ id: 'oauth2' });
    const token = await (result.current as any).getToken();
    expect(token).toBe('user-token');
    expect(mockOAuthApi.getAccessToken).toHaveBeenCalledWith(['dp:api:manage']);
  });

  it('falls back to manual with an error when the configured provider is not registered', () => {
    apiHolder.get.mockReturnValue(undefined);
    const config: Wso2ApiPortalAuthConfig = {
      mode: 'idp',
      strategy: 'reuse-signin',
      reuseSignIn: { providerId: 'missing-provider', scopes: [] },
    };
    const { result } = renderHook(() => useApiPortalAuth(config));
    expect(result.current.mode).toBe('manual');
    expect((result.current as any).error).toMatch(/missing-provider/);
  });

  it('falls back to manual with an error when reuseSignIn.providerId is not configured', () => {
    const config: Wso2ApiPortalAuthConfig = {
      mode: 'idp',
      strategy: 'reuse-signin',
    };
    const { result } = renderHook(() => useApiPortalAuth(config));
    expect(result.current.mode).toBe('manual');
    expect((result.current as any).error).toMatch(/reuseSignIn.providerId/);
  });
});
