/** @jest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { usePolicyArtifact } from './usePolicyArtifact';

jest.mock('@backstage/core-plugin-api', () => ({
  useApi: jest.fn(),
  createApiRef: jest.fn().mockReturnValue({}),
}));

describe('usePolicyArtifact', () => {
  const entity = {
    metadata: { name: 'orders-api', namespace: 'default' },
    kind: 'Api',
  } as any;

  const artifact = { apiPolicies: [], operations: [] };
  const mockApiClient = { getPolicyArtifact: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue(mockApiClient);
    mockApiClient.getPolicyArtifact.mockResolvedValue({ policies: artifact });
  });

  it('fetches the live artifact on mount', async () => {
    const { result } = renderHook(() => usePolicyArtifact(entity));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.artifact).toEqual(artifact);
    expect(mockApiClient.getPolicyArtifact).toHaveBeenCalledTimes(1);
  });

  it('does not fetch when skipped', () => {
    renderHook(() => usePolicyArtifact(entity, { skip: true }));
    expect(mockApiClient.getPolicyArtifact).not.toHaveBeenCalled();
  });

  it('refresh() re-fetches the artifact', async () => {
    const { result } = renderHook(() => usePolicyArtifact(entity));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.refresh();
    expect(mockApiClient.getPolicyArtifact).toHaveBeenCalledTimes(2);
  });
});
