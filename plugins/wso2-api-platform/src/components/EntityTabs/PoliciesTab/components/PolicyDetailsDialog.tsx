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

import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import CloseIcon from '@material-ui/icons/Close';
import {
  Wso2PolicyDetailsViewer,
  getPolicyFriendlyName,
} from './PolicyDetailsViewer';

export type PolicyDetailsRef = {
  name: string;
  version?: string;
  parameters?: any;
};

export const PolicyDetailsDialog = ({
  policy,
  open,
  onClose,
}: {
  policy: PolicyDetailsRef | null;
  open: boolean;
  onClose: () => void;
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle disableTypography>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            {getPolicyFriendlyName(policy?.name || '')}
            {policy?.version && (
              <span
                style={{
                  fontWeight: 400,
                  opacity: 0.5,
                  fontSize: '0.85rem',
                  marginLeft: '8px',
                }}
              >
                ({policy.version})
              </span>
            )}
          </Typography>
          <IconButton aria-label="Close" onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers style={{ padding: 0 }}>
        <Wso2PolicyDetailsViewer parameters={policy?.parameters} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
