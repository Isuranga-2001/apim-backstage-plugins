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

import { Fragment } from 'react';
import Box from '@material-ui/core/Box';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Typography from '@material-ui/core/Typography';
import {
  Wso2ApiPolicyDiff,
  Wso2PolicyChangeRef,
  Wso2PolicyFlowDiff,
} from '../../../../../api';
import { CODE_FONT_FAMILY } from '../../../../../styles/fonts';
import { getPolicyFriendlyName } from '../PolicyDetailsViewer';

export interface PolicyDiffSummaryProps {
  diff: Wso2ApiPolicyDiff | null | undefined;
}

const ADDED_COLOR = '#28a745';
const CHANGED_COLOR = '#f0ad4e';
const REMOVED_COLOR = '#e74c3c';

const FLOW_LABELS: Record<string, string> = {
  request: 'Request',
  response: 'Response',
  fault: 'Fault',
};

const rowStyle = (color: string) => ({
  color,
  fontFamily: CODE_FONT_FAMILY,
  fontSize: 13,
});

const renderChangeRow = (
  prefix: string,
  color: string,
  p: Wso2PolicyChangeRef,
) => (
  <ListItem key={`${prefix}-${p.name}-${p.version}`} disableGutters>
    <ListItemText
      primaryTypographyProps={{ style: rowStyle(color) }}
      primary={`${prefix} ${getPolicyFriendlyName(p.name)} (${p.version})`}
    />
  </ListItem>
);

const renderFlowDiff = (flow: Wso2PolicyFlowDiff, keyPrefix: string) => (
  <Fragment key={`${keyPrefix}-${flow.flow}`}>
    {flow.flow !== 'flat' && (
      <Typography variant="caption" style={{ fontWeight: 700, opacity: 0.7 }}>
        {FLOW_LABELS[flow.flow]}
      </Typography>
    )}
    <List dense disablePadding>
      {flow.added.map(p => renderChangeRow('+', ADDED_COLOR, p))}
      {flow.changed.map(p => renderChangeRow('~', CHANGED_COLOR, p))}
      {flow.removed.map(p => renderChangeRow('-', REMOVED_COLOR, p))}
    </List>
  </Fragment>
);

export const PolicyDiffSummary = ({ diff }: PolicyDiffSummaryProps) => {
  if (!diff) {
    return null;
  }

  if (!diff.hasChanges) {
    return (
      <Typography
        variant="body2"
        color="textSecondary"
        style={{ marginBottom: 8 }}
      >
        No changes to the policies were detected.
      </Typography>
    );
  }

  return (
    <Box mb={2}>
      <Typography variant="subtitle2" gutterBottom>
        This will change the following policies on the gateway:
      </Typography>
      {diff.apiLevel.length > 0 && (
        <Box mb={1}>
          <Typography variant="body2" style={{ fontWeight: 600 }}>
            API level
          </Typography>
          {diff.apiLevel.map(flow => renderFlowDiff(flow, 'api'))}
        </Box>
      )}
      {diff.operations.map(op => (
        <Box mb={1} key={`${op.method}-${op.path}`}>
          <Typography
            variant="body2"
            style={{ fontFamily: CODE_FONT_FAMILY, fontWeight: 600 }}
          >
            {op.method} {op.path}
          </Typography>
          {op.flows.map(flow =>
            renderFlowDiff(flow, `${op.method}-${op.path}`),
          )}
        </Box>
      ))}
    </Box>
  );
};
