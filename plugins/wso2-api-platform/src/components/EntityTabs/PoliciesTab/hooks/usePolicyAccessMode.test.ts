import { renderHook } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { useGatewayStatus } from '../../../common/useGatewayStatus';
import { usePolicyAccessMode } from './usePolicyAccessMode';

jest.mock('@backstage/core-plugin-api', () => ({
  useApi: jest.fn(),
  configApiRef: { id: 'core.config' },
}));

jest.mock('../../../common/useGatewayStatus', () => ({
  useGatewayStatus: jest.fn(),
}));

const entityWith = (annotations: Record<string, string>) =>
  ({
    metadata: { annotations },
  } as any);

function mockConfig(overrides: Record<string, boolean | undefined> = {}) {
  (useApi as jest.Mock).mockReturnValue({
    getOptionalBoolean: jest.fn((key: string) => overrides[key]),
  });
}

describe('usePolicyAccessMode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig();
    (useGatewayStatus as jest.Mock).mockReturnValue({
      applicable: false,
      active: true,
    });
  });

  it('is read-only by default for an API Platform gateway API, even with storage enabled', () => {
    mockConfig({ 'wso2ApiPlatformStorage.enabled': true });
    (useGatewayStatus as jest.Mock).mockReturnValue({
      applicable: true,
      active: true,
    });
    const { result } = renderHook(() =>
      usePolicyAccessMode(
        entityWith({ 'wso2.com/api-discovery-type': 'api-platform-gateway' }),
      ),
    );
    expect(result.current.mode).toBe('read-only');
    expect(result.current.isGatewayDiscovered).toBe(true);
  });

  it('stays read-only even when wso2ApiPlatformGateway.enableWriteOperations is turned on in config, because Full Sync Mode is locked for this release', () => {
    mockConfig({
      'wso2ApiPlatformStorage.enabled': true,
      'wso2ApiPlatformGateway.enableWriteOperations': true,
    });
    (useGatewayStatus as jest.Mock).mockReturnValue({
      applicable: true,
      active: true,
    });
    const { result } = renderHook(() =>
      usePolicyAccessMode(
        entityWith({ 'wso2.com/api-discovery-type': 'api-platform-gateway' }),
      ),
    );
    expect(result.current.mode).toBe('read-only');
    expect(result.current.editingDisabledReason).toBeUndefined();
  });

  it('stays read-only (with no editingDisabledReason) regardless of gateway status, since editable mode is locked for this release', () => {
    mockConfig({
      'wso2ApiPlatformStorage.enabled': true,
      'wso2ApiPlatformGateway.enableWriteOperations': true,
    });
    (useGatewayStatus as jest.Mock).mockReturnValue({
      applicable: true,
      active: false,
    });
    const { result } = renderHook(() =>
      usePolicyAccessMode(
        entityWith({ 'wso2.com/api-discovery-type': 'api-platform-gateway' }),
      ),
    );
    expect(result.current.mode).toBe('read-only');
    expect(result.current.editingDisabledReason).toBeUndefined();
  });

  it('is read-only when definition storage is disabled, even with writes enabled', () => {
    mockConfig({
      'wso2ApiPlatformStorage.enabled': false,
      'wso2ApiPlatformGateway.enableWriteOperations': true,
    });
    const { result } = renderHook(() =>
      usePolicyAccessMode(
        entityWith({ 'wso2.com/api-discovery-type': 'api-platform-gateway' }),
      ),
    );
    expect(result.current.mode).toBe('read-only');
  });

  it('is read-only when there is no discovery-type annotation', () => {
    const { result } = renderHook(() => usePolicyAccessMode(entityWith({})));
    expect(result.current.mode).toBe('read-only');
    expect(result.current.isGatewayDiscovered).toBe(false);
  });
});
