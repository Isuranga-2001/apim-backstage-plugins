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

import { Entity } from '@backstage/catalog-model';
import Box from '@material-ui/core/Box';
import ButtonBase from '@material-ui/core/ButtonBase';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import { amber, blueGrey, grey, pink } from '@material-ui/core/colors';
import {
  DEFAULT_SUBSCRIPTION_PLANS,
  formatSubscriptionPlanQuota,
} from '../../../../utils/subscriptionPlans';
import { useApiPortalSubscriptions } from '../hooks/useApiPortalSubscriptions';

const PLAN_COLORS: Record<string, { selected: string; unselected: string }> = {
  Bronze: { selected: '#c9873f', unselected: amber[50] },
  Gold: { selected: '#d9b23c', unselected: '#faf3df' },
  Silver: { selected: blueGrey[300], unselected: grey[100] },
  Unlimited: { selected: pink[200], unselected: pink[50] },
};
const CUSTOM_PLAN_BACKGROUND = grey[100];

type PlanChipProps = {
  label: string;
  quota?: string;
  selected: boolean;
  colors: { selected: string; unselected: string };
  disabled: boolean;
  onClick: () => void;
  showCheckWhenSelected?: boolean;
};

const PlanChip = (props: PlanChipProps) => {
  const {
    label,
    quota,
    selected,
    colors,
    disabled,
    onClick,
    showCheckWhenSelected,
  } = props;
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      focusRipple
      style={{
        backgroundColor: selected ? colors.selected : colors.unselected,
        borderRadius: 8,
        padding: '8px 16px',
        minWidth: 96,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        position: 'relative',
        border: `1px solid ${
          selected && showCheckWhenSelected ? grey[400] : 'transparent'
        }`,
      }}
    >
      {showCheckWhenSelected && selected && (
        <Box position="absolute" top={4} right={4} color={grey[600]}>
          <CheckCircleIcon fontSize="small" />
        </Box>
      )}
      <Typography variant="body2" style={{ fontWeight: 700 }}>
        {label}
      </Typography>
      {quota && (
        <Typography variant="caption" color="textSecondary">
          {quota}
        </Typography>
      )}
    </ButtonBase>
  );
};

export const ApiPortalSubscriptionPlans = (props: { entity: Entity }) => {
  const {
    availableCustomPlanIds,
    selectedPlanIds,
    loading,
    saving,
    error,
    toggle,
  } = useApiPortalSubscriptions(props.entity);

  if (loading) {
    return (
      <Box display="flex" alignItems="center" py={1}>
        <CircularProgress size={16} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography
        variant="subtitle2"
        color="textSecondary"
        style={{ fontWeight: 600, marginBottom: 8 }}
      >
        Subscription Plans
      </Typography>
      <Box display="flex" flexWrap="wrap" gridGap={8}>
        {DEFAULT_SUBSCRIPTION_PLANS.map(plan => (
          <PlanChip
            key={plan.id}
            label={plan.id}
            quota={formatSubscriptionPlanQuota(plan)}
            selected={selectedPlanIds.includes(plan.id)}
            colors={
              PLAN_COLORS[plan.id] ?? {
                selected: grey[400],
                unselected: grey[100],
              }
            }
            disabled={saving}
            onClick={() => toggle(plan.id)}
          />
        ))}
        {availableCustomPlanIds.map(planId => (
          <PlanChip
            key={planId}
            label={planId}
            selected={selectedPlanIds.includes(planId)}
            colors={{
              selected: CUSTOM_PLAN_BACKGROUND,
              unselected: CUSTOM_PLAN_BACKGROUND,
            }}
            disabled={saving}
            onClick={() => toggle(planId)}
            showCheckWhenSelected
          />
        ))}
      </Box>
      {error && (
        <Typography
          variant="caption"
          color="error"
          display="block"
          style={{ marginTop: 4 }}
        >
          {error}
        </Typography>
      )}
    </Box>
  );
};
