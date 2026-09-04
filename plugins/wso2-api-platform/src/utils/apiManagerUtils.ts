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

import { Wso2GatewayInfo } from '../api';
import { formatLifecycleStatus } from '../utils';

export const CATALOG_SYNC_RETRY_MS = 3000;
export const CATALOG_AUTH_RETRY_DELAYS_MS = [500, 1000, 2000];
export const SYNC_LOADING_DIALOG_COMPLETE_DELAY_MS = 3000;

/**
 * Resolves after the supplied delay, mainly for bounded retry backoff.
 */
export const sleep = (delayMs: number) =>
  new Promise(resolve => setTimeout(resolve, delayMs));

/**
 * Detects transient unauthorized errors across Fetch, Backstage, and plain Error shapes.
 */
export const isUnauthorizedError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    status?: number;
    statusCode?: number;
    response?: { status?: number };
    message?: string;
  };

  return (
    candidate.status === 401 ||
    candidate.statusCode === 401 ||
    candidate.response?.status === 401 ||
    Boolean(candidate.message?.match(/\b401\b|unauthorized/i))
  );
};

/**
 * Detects not-found errors across Fetch, Backstage, and plain Error shapes.
 */
export const isNotFoundError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    status?: number;
    statusCode?: number;
    response?: { status?: number };
    message?: string;
  };

  return (
    candidate.status === 404 ||
    candidate.statusCode === 404 ||
    candidate.response?.status === 404 ||
    Boolean(candidate.message?.match(/\b404\b|not found/i))
  );
};

/**
 * Retries an operation only when authentication propagation returns transient 401s.
 */
export const retryTransientUnauthorized = async <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  let lastError: unknown;

  for (
    let attempt = 0;
    attempt <= CATALOG_AUTH_RETRY_DELAYS_MS.length;
    attempt++
  ) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (
        !isUnauthorizedError(error) ||
        attempt === CATALOG_AUTH_RETRY_DELAYS_MS.length
      ) {
        throw error;
      }

      await sleep(CATALOG_AUTH_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
};

/**
 * Parses publisher API progress embedded in sync status messages.
 */
export const parsePublisherProgressFromMessage = (message?: string) => {
  if (!message) {
    return undefined;
  }

  const ratioMatch = message.match(/\((\d+)\s*\/\s*(\d+)\)/);
  if (ratioMatch) {
    return {
      loaded: Number(ratioMatch[1]),
      total: Number(ratioMatch[2]),
    };
  }

  const loadedMatch = message.match(/\((\d+)\s+loaded\)/i);
  if (loadedMatch) {
    return {
      loaded: Number(loadedMatch[1]),
      total: undefined,
    };
  }

  return undefined;
};

/**
 * Normalizes a name for use as a Backstage entity name.
 * Matches the logic in Wso2ApiEntityProvider.ts
 */
export function normalizeEntityName(name?: string): string {
  return (name || '').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
}

/**
 * Normalizes gateway types for consistent display.
 */
export function normalizeGatewayType(type?: string): string {
  const t = (type || '').toLowerCase().trim();
  if (
    t === 'wso2/synapse' ||
    t === 'synapse' ||
    t === 'wso2' ||
    t === 'regular' ||
    t === 'default'
  )
    return 'WSO2';
  if (t === 'self hosted' || t === 'self-hosted') return 'Self Hosted';
  if (t === 'openchoreo') return 'OpenChoreo';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Normalizes gateway names for consistent display, converting 'Default' to 'WSO2'.
 */
export function normalizeGatewayName(name?: string): string {
  const n = name || 'Unknown';
  return n.toLowerCase() === 'default' ? 'WSO2' : n;
}

export type GatewayDiscoverySnapshot = {
  discoveredApiCount: number;
  onlineGatewayCount: number;
  configuredGatewayCount: number;
};

/**
 * Summarizes current gateway discovery results for progress displays.
 */
export const getGatewayDiscoverySnapshot = (
  gateways: any[],
): GatewayDiscoverySnapshot => {
  const discoveredApiCount = gateways.reduce(
    (total: number, gateway: any) =>
      total +
      (Array.isArray(gateway.discoveredApis)
        ? gateway.discoveredApis.length
        : 0),
    0,
  );
  const onlineGatewayCount = gateways.filter(
    (gateway: any) => gateway.status !== 'Offline',
  ).length;

  return {
    discoveredApiCount,
    onlineGatewayCount,
    configuredGatewayCount: gateways.length,
  };
};

/**
 * Extracts gateway information from annotations.
 */
export function extractGateways(
  annotations: Record<string, string>,
): Wso2GatewayInfo[] {
  const isApiPlatformEntity =
    !!annotations['wso2.com/platform-gateway-endpoints'];
  const isSelfHosted = !!annotations['wso2-gateway.com/api-endpoints'];

  let gwEndpointsStr = annotations['wso2.com/gateway-endpoints'];
  if (isApiPlatformEntity) {
    gwEndpointsStr = annotations['wso2.com/platform-gateway-endpoints'];
  } else if (isSelfHosted) {
    gwEndpointsStr = annotations['wso2-gateway.com/api-endpoints'];
  }

  if (!gwEndpointsStr || gwEndpointsStr === '[]') return [];

  try {
    const endpoints = JSON.parse(gwEndpointsStr);
    if (Array.isArray(endpoints)) {
      return endpoints.map((ep: any) => ({
        name: normalizeGatewayName(ep.environmentName),
        displayName: normalizeGatewayName(ep.displayName || ep.environmentName),
        gatewayType: normalizeGatewayType(ep.gatewayType),
      }));
    }
  } catch {
    // Ignore malformed gateway annotations
  }

  return [];
}

export function renderGatewayTypes(gateways?: Wso2GatewayInfo[]): string {
  if (!gateways?.length) {
    return 'WSO2';
  }

  const types = Array.from(
    new Set(gateways.map(gateway => normalizeGatewayType(gateway.gatewayType))),
  );
  return types[0];
}

export function expandByGateways<
  T extends { id?: string; gateways?: Wso2GatewayInfo[] },
>(items: T[]): T[] {
  return items.flatMap(item => {
    if (!item.gateways || item.gateways.length <= 1) {
      return [item];
    }
    return item.gateways.map(gateway => ({
      ...item,
      id: `${item.id}-${gateway.name || gateway.gatewayType}`,
      gateways: [gateway],
    }));
  });
}

export function renderRowLifecycleStatus(rowData: {
  lifeCycleStatus?: string;
  lifecycleStatus?: string;
  lifecycleState?: string;
}): string | undefined {
  return formatLifecycleStatus(
    rowData.lifeCycleStatus ||
      rowData.lifecycleStatus ||
      rowData.lifecycleState,
  );
}

export const filterRowsBySearchText = <T extends object>(
  rows: T[],
  searchText: string,
): T[] => {
  const query = searchText.trim().toLocaleLowerCase();
  if (!query) {
    return rows;
  }

  return rows.filter(row => {
    const searchableText = Object.values(row)
      .flatMap(value => {
        if (Array.isArray(value)) {
          return value.flatMap(item =>
            item && typeof item === 'object' ? Object.values(item) : item,
          );
        }

        if (value && typeof value === 'object') {
          return Object.values(value);
        }

        return value;
      })
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();

    return searchableText.includes(query);
  });
};
