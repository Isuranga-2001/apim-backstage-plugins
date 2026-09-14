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

const entityWith = (annotations: Record<string, string>) => ({
  metadata: { annotations },
}) as any;

describe('usePolicyAccessMode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({
      getOptionalBoolean: jest.fn().mockReturnValue(undefined),
    });
    (useGatewayStatus as jest.Mock).mockReturnValue({
      applicable: false,
      active: true,
    });
  });

  it('is editable for an OpenChoreo-gateway API with storage enabled by default', () => {
    (useGatewayStatus as jest.Mock).mockReturnValue({ applicable: true, active: true });
    const { result } = renderHook(() =>
      usePolicyAccessMode(
        entityWith({ 'wso2.com/api-discovery-type': 'openchoreo-gateway' }),
      ),
    );
    expect(result.current.mode).toBe('editable');
    expect(result.current.editingDisabledReason).toBeUndefined();
  });

  it('is editable but disabled when the OpenChoreo gateway is inactive', () => {
    (useGatewayStatus as jest.Mock).mockReturnValue({ applicable: true, active: false });
    const { result } = renderHook(() =>
      usePolicyAccessMode(
        entityWith({ 'wso2.com/api-discovery-type': 'openchoreo-gateway' }),
      ),
    );
    expect(result.current.mode).toBe('editable');
    expect(result.current.editingDisabledReason).toBe('Gateway is currently inactive');
  });

  it('is read-only when definition storage is disabled', () => {
    (useApi as jest.Mock).mockReturnValue({
      getOptionalBoolean: jest.fn().mockReturnValue(false),
    });
    const { result } = renderHook(() =>
      usePolicyAccessMode(
        entityWith({ 'wso2.com/api-discovery-type': 'openchoreo-gateway' }),
      ),
    );
    expect(result.current.mode).toBe('read-only');
  });

  it('is read-only for a self-hosted-gateway API', () => {
    const { result } = renderHook(() =>
      usePolicyAccessMode(
        entityWith({ 'wso2.com/api-discovery-type': 'self-hosted-gateway' }),
      ),
    );
    expect(result.current.mode).toBe('read-only');
  });

  it('is read-only when there is no discovery-type annotation', () => {
    const { result } = renderHook(() => usePolicyAccessMode(entityWith({})));
    expect(result.current.mode).toBe('read-only');
  });
});
