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

export type GatewaySyncStatus = {
  active: boolean;
  lastSuccessAt?: number;
  lastCheckedAt?: number;
  lastError?: string;
};

/** Tracks the latest sync status for each gateway. */
class GatewayStatusTracker {
  private readonly statuses = new Map<string, GatewaySyncStatus>();

  recordSuccess(gatewayId: string): void {
    const now = Date.now();
    this.statuses.set(gatewayId, {
      active: true,
      lastSuccessAt: now,
      lastCheckedAt: now,
    });
  }

  recordFailure(gatewayId: string, error?: string): void {
    const previous = this.statuses.get(gatewayId);
    this.statuses.set(gatewayId, {
      active: false,
      lastSuccessAt: previous?.lastSuccessAt,
      lastCheckedAt: Date.now(),
      lastError: error,
    });
  }

  /** Marks a gateway inactive when its last success exceeds maxAgeMs. */
  markStaleIfNeeded(gatewayId: string, maxAgeMs: number): void {
    const previous = this.statuses.get(gatewayId);
    const age = previous?.lastSuccessAt
      ? Date.now() - previous.lastSuccessAt
      : undefined;
    if (age === undefined || age > maxAgeMs) {
      this.statuses.set(gatewayId, {
        ...previous,
        active: false,
        lastCheckedAt: Date.now(),
      });
    }
  }

  /** Returns inactive when no status has been recorded. */
  getStatus(gatewayId: string): GatewaySyncStatus {
    return this.statuses.get(gatewayId) ?? { active: false };
  }

  reset(): void {
    this.statuses.clear();
  }
}

export const gatewayStatusTracker = new GatewayStatusTracker();
