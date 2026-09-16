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

import { useState } from 'react';
import { Entity } from '@backstage/catalog-model';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import Snackbar from '@material-ui/core/Snackbar';
import TextField from '@material-ui/core/TextField';
import Alert from '@material-ui/lab/Alert';
import { Wso2ApiPortalPublishResult } from '../../../../api';
import { useApiPortalPublish } from '../hooks/useApiPortalPublish';

export const PublishToApiPortalDialog = (options: {
  entity: Entity;
  open: boolean;
  onClose: () => void;
  onPublished: (result: Wso2ApiPortalPublishResult) => void;
}) => {
  const { entity, open, onClose, onPublished } = options;
  const configApi = useApi(configApiRef);
  const baseUrl = configApi.getOptionalString(
    'wso2ApiPlatform.apiPortal.baseUrl',
  );
  const { submitting, publish, snackbar, closeSnackbar } =
    useApiPortalPublish(entity);

  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [documentWarnings, setDocumentWarnings] = useState<string[]>([]);

  const handleClose = () => {
    if (submitting) {
      return;
    }
    setToken('');
    setError(null);
    setDocumentWarnings([]);
    onClose();
  };

  const handleConfirm = async () => {
    if (!token.trim()) {
      setError('A Platform API access token is required.');
      return;
    }
    setError(null);
    setDocumentWarnings([]);
    try {
      const result = await publish(token.trim());
      setToken('');
      onPublished(result);
      if (result.warnings.length > 0) {
        setDocumentWarnings(result.warnings);
      } else {
        onClose();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to publish to the API Portal.',
      );
    }
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Publish to API Portal</DialogTitle>
        <DialogContent>
          {error && (
            <Box mb={2}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}
          {documentWarnings.length > 0 && (
            <Box mb={2}>
              <Alert severity="warning">
                The API was published, but attaching its documents failed:
                <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                  {documentWarnings.map(warning => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </Alert>
            </Box>
          )}
          <DialogContentText>
            {baseUrl
              ? `This will publish the API to ${baseUrl}.`
              : 'No API Portal base URL is configured.'}
          </DialogContentText>
          <TextField
            id="api-portal-access-token"
            fullWidth
            type="password"
            label="Platform API Access Token"
            helperText="Sent with this publish request only — it is not stored."
            value={token}
            onChange={e => setToken(e.target.value)}
            disabled={submitting}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={submitting}>
            {documentWarnings.length > 0 ? 'Close' : 'Cancel'}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConfirm}
            disabled={submitting || !baseUrl}
          >
            {submitting ? <CircularProgress size={20} /> : 'Publish'}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={closeSnackbar}
      >
        <Alert onClose={closeSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};
