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

export type SubscriptionPlanLimit = {
  limitType: 'REQUEST_COUNT';
  timeUnit: 'MINUTE' | null;
  timeAmount: number;
  limitCount: number;
};

export type DefaultSubscriptionPlan = {
  id: string;
  limits: SubscriptionPlanLimit[];
};

/** Mirrored (as plain IDs) in the backend plugin's `apiPortal/types.ts`. */
export const DEFAULT_SUBSCRIPTION_PLANS: DefaultSubscriptionPlan[] = [
  {
    id: 'Bronze',
    limits: [
      {
        limitType: 'REQUEST_COUNT',
        timeUnit: 'MINUTE',
        timeAmount: 1,
        limitCount: 1000,
      },
    ],
  },
  {
    id: 'Silver',
    limits: [
      {
        limitType: 'REQUEST_COUNT',
        timeUnit: 'MINUTE',
        timeAmount: 1,
        limitCount: 2000,
      },
    ],
  },
  {
    id: 'Gold',
    limits: [
      {
        limitType: 'REQUEST_COUNT',
        timeUnit: 'MINUTE',
        timeAmount: 1,
        limitCount: 5000,
      },
    ],
  },
  {
    id: 'Unlimited',
    limits: [
      {
        limitType: 'REQUEST_COUNT',
        timeUnit: null,
        timeAmount: 1,
        limitCount: -1,
      },
    ],
  },
];

export const DEFAULT_SUBSCRIPTION_PLAN_IDS = DEFAULT_SUBSCRIPTION_PLANS.map(
  plan => plan.id,
);

/** -1 limitCount (Unlimited) renders as "N/A". */
export function formatSubscriptionPlanQuota(
  plan: DefaultSubscriptionPlan,
): string {
  const limit = plan.limits[0];
  if (!limit || limit.limitCount < 0) {
    return 'N/A';
  }
  return `${limit.limitCount} / min`;
}
