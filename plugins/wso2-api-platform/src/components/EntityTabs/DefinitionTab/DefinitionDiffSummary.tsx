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

import Box from '@material-ui/core/Box';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Typography from '@material-ui/core/Typography';
import { CODE_FONT_FAMILY } from '../../../styles/fonts';
import { Wso2RestApiArtifactDiff } from '../../../api/types';

export interface DefinitionDiffSummaryProps {
  diff: Wso2RestApiArtifactDiff | null | undefined;
}

const ADDED_COLOR = '#28a745';
const REMOVED_COLOR = '#e74c3c';

const operationRowStyle = (color: string) => ({
  color,
  fontFamily: CODE_FONT_FAMILY,
  fontSize: 13,
});

export const DefinitionDiffSummary = ({ diff }: DefinitionDiffSummaryProps) => {
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
        No changes to the gateway configuration were detected.
      </Typography>
    );
  }

  return (
    <Box mb={2}>
      <Typography variant="subtitle2" gutterBottom>
        This will change the following on the gateway:
      </Typography>
      {diff.displayNameChange && (
        <Typography variant="body2" style={{ marginBottom: 4 }}>
          Title: <strong>{diff.displayNameChange.from}</strong> &rarr;{' '}
          <strong>{diff.displayNameChange.to}</strong>
        </Typography>
      )}
      {diff.versionChange && (
        <Typography variant="body2" style={{ marginBottom: 4 }}>
          Version: <strong>{diff.versionChange.from}</strong> &rarr;{' '}
          <strong>{diff.versionChange.to}</strong>
        </Typography>
      )}
      {(diff.addedOperations.length > 0 ||
        diff.removedOperations.length > 0) && (
        <List dense disablePadding>
          {diff.addedOperations.map(op => (
            <ListItem key={`added-${op.method}-${op.path}`} disableGutters>
              <ListItemText
                primaryTypographyProps={{
                  style: operationRowStyle(ADDED_COLOR),
                }}
                primary={`+ ${op.method} ${op.path}`}
              />
            </ListItem>
          ))}
          {diff.removedOperations.map(op => (
            <ListItem key={`removed-${op.method}-${op.path}`} disableGutters>
              <ListItemText
                primaryTypographyProps={{
                  style: operationRowStyle(REMOVED_COLOR),
                }}
                primary={`- ${op.method} ${op.path}`}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};
