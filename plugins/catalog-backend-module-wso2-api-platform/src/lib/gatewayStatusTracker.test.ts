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

import { gatewayStatusTracker } from './gatewayStatusTracker';

describe('gatewayStatusTracker', () => {
  beforeEach(() => {
    gatewayStatusTracker.reset();
  });

  it('defaults to inactive for a gateway with no recorded sync', () => {
    expect(gatewayStatusTracker.getStatus('unknown-gw')).toEqual({
      active: false,
    });
  });

  it('flips to inactive after a single failed sync', () => {
    gatewayStatusTracker.recordSuccess('gw-1');
    gatewayStatusTracker.recordFailure('gw-1', 'boom');
    const status = gatewayStatusTracker.getStatus('gw-1');
    expect(status.active).toBe(false);
    expect(status.lastError).toBe('boom');
  });

  it('recovers to active on the very next successful sync', () => {
    gatewayStatusTracker.recordFailure('gw-1', 'boom');
    gatewayStatusTracker.recordSuccess('gw-1');
    expect(gatewayStatusTracker.getStatus('gw-1').active).toBe(true);
  });

  it('keeps the last known success time across a failure', () => {
    gatewayStatusTracker.recordSuccess('gw-1');
    const { lastSuccessAt } = gatewayStatusTracker.getStatus('gw-1');
    gatewayStatusTracker.recordFailure('gw-1');
    expect(gatewayStatusTracker.getStatus('gw-1').lastSuccessAt).toBe(
      lastSuccessAt,
    );
  });

  it('markStaleIfNeeded flips a gateway inactive once its last success is too old', () => {
    gatewayStatusTracker.recordSuccess('gw-1');
    gatewayStatusTracker.markStaleIfNeeded('gw-1', -1);
    expect(gatewayStatusTracker.getStatus('gw-1').active).toBe(false);
  });

  it('markStaleIfNeeded treats a gateway with no recorded success as stale', () => {
    gatewayStatusTracker.markStaleIfNeeded('never-synced', 60_000);
    expect(gatewayStatusTracker.getStatus('never-synced').active).toBe(false);
  });
});
