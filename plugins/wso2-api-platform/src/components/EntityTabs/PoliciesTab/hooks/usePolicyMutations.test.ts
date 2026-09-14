/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { usePolicyMutations } from './usePolicyMutations';

jest.mock('@backstage/core-plugin-api', () => ({
  useApi: jest.fn(),
  createApiRef: jest.fn().mockReturnValue({}),
}));

describe('usePolicyMutations', () => {
  const entity = {
    metadata: { name: 'orders-api', namespace: 'default' },
    kind: 'Api',
  } as any;

  const artifact = { apiPolicies: [], operations: [] };
  const mockApiClient = {
    upsertPolicyArtifact: jest.fn(),
    previewPolicyDiff: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue(mockApiClient);
  });

  it('upsertPolicies saves the artifact and shows a success snackbar', async () => {
    mockApiClient.upsertPolicyArtifact.mockResolvedValue({
      policies: artifact,
    });
    const { result } = renderHook(() => usePolicyMutations(entity));

    await act(async () => {
      await result.current.upsertPolicies(artifact);
    });

    expect(mockApiClient.upsertPolicyArtifact).toHaveBeenCalledWith(
      expect.anything(),
      artifact,
    );
    expect(result.current.snackbar).toEqual(
      expect.objectContaining({ open: true, severity: 'success' }),
    );
  });

  it('previewDiff returns the diff from the backend', async () => {
    const diff = { apiLevel: [], operations: [], hasChanges: true };
    mockApiClient.previewPolicyDiff.mockResolvedValue({ diff });
    const { result } = renderHook(() => usePolicyMutations(entity));

    let returned;
    await act(async () => {
      returned = await result.current.previewDiff(artifact);
    });

    expect(returned).toEqual(diff);
    await waitFor(() => expect(result.current.previewing).toBe(false));
  });
});
