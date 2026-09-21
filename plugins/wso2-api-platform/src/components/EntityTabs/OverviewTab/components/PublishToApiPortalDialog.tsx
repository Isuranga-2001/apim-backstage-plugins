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

import { useEffect, useState } from 'react';
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
import Autocomplete from '@material-ui/lab/Autocomplete';
import { Wso2ApiPortalPublishResult } from '../../../../api';
import { useApiPortalPublish } from '../hooks/useApiPortalPublish';

const GATEWAY_ENDPOINTS_ANNOTATION = 'wso2-gateway.com/api-endpoints';
const DEFAULT_LABELS = ['default'];

/** The gateway's configured runtime URLs (with the API's context appended), as baked into the entity at discovery time. */
function productionEndpointOptions(entity: Entity): string[] {
  const raw = entity.metadata.annotations?.[GATEWAY_ENDPOINTS_ANNOTATION];
  if (!raw) {
    return [];
  }
  try {
    const endpoints = JSON.parse(raw) as Array<{ urls?: string[] }>;
    return Array.from(new Set(endpoints[0]?.urls ?? []));
  } catch {
    return [];
  }
}

let lastUsedApiPortalToken = '';

export const PublishToApiPortalDialog = (options: {
  entity: Entity;
  open: boolean;
  onClose: () => void;
  onPublished: (result: Wso2ApiPortalPublishResult) => void;
}) => {
  const { entity, open, onClose, onPublished } = options;
  const configApi = useApi(configApiRef);
  const baseUrl = configApi.getOptionalString(
    'wso2ApiPlatformApiPortal.baseUrl',
  );
  const { submitting, publish, snackbar, closeSnackbar } =
    useApiPortalPublish(entity);

  const defaultDisplayName = entity.metadata.title || entity.metadata.name;
  const endpointOptions = productionEndpointOptions(entity);
  const defaultProductionEndpoint = endpointOptions[0] ?? '';
  const defaultSandboxEndpoint = endpointOptions[1] ?? '';

  const [token, setToken] = useState(lastUsedApiPortalToken);
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [productionEndpoint, setProductionEndpoint] = useState(
    defaultProductionEndpoint,
  );
  const [sandboxEndpoint, setSandboxEndpoint] = useState(
    defaultSandboxEndpoint,
  );
  const [labels, setLabels] = useState<string[]>(DEFAULT_LABELS);
  const [error, setError] = useState<string | null>(null);
  const [labelsError, setLabelsError] = useState<string | null>(null);
  const [documentWarnings, setDocumentWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setToken(lastUsedApiPortalToken);
    }
  }, [open]);

  const handleClose = () => {
    if (submitting) {
      return;
    }
    setDisplayName(defaultDisplayName);
    setProductionEndpoint(defaultProductionEndpoint);
    setSandboxEndpoint(defaultSandboxEndpoint);
    setLabels(DEFAULT_LABELS);
    setError(null);
    setLabelsError(null);
    setDocumentWarnings([]);
    onClose();
  };

  const handleConfirm = async () => {
    if (!token.trim()) {
      setError('A Platform API access token is required.');
      return;
    }
    if (!displayName.trim()) {
      setError('A display name is required.');
      return;
    }
    if (!productionEndpoint.trim()) {
      setError('A production endpoint is required.');
      return;
    }
    const trimmedLabels = labels.map(label => label.trim()).filter(Boolean);
    if (trimmedLabels.length === 0) {
      setError('At least one label is required.');
      setLabelsError('At least one label is required.');
      return;
    }
    setError(null);
    setLabelsError(null);
    setDocumentWarnings([]);
    try {
      const result = await publish(token.trim(), {
        displayName: displayName.trim(),
        productionEndpoint: productionEndpoint.trim(),
        sandboxEndpoint: sandboxEndpoint.trim() || undefined,
        labels: trimmedLabels,
      });
      onPublished(result);
      if (result.warnings.length > 0) {
        setDocumentWarnings(result.warnings);
      } else {
        onClose();
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to publish to the API Portal.';
      setError(message);
      setLabelsError(/label/i.test(message) ? message : null);
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
            helperText="Defaults to the last token used in this browser session — you can override it."
            value={token}
            onChange={e => {
              const value = e.target.value;
              setToken(value);
              lastUsedApiPortalToken = value;
            }}
            disabled={submitting}
          />
          <Box mt={2}>
            <TextField
              id="api-portal-display-name"
              fullWidth
              required
              label="Display Name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              disabled={submitting}
            />
          </Box>
          <Box mt={2}>
            <Autocomplete<string, true, false, true>
              id="api-portal-labels"
              multiple
              freeSolo
              fullWidth
              options={[]}
              value={labels}
              onChange={(_e, newValue) => {
                setLabels(newValue);
                setLabelsError(null);
              }}
              disabled={submitting}
              renderInput={params => (
                <TextField
                  {...params}
                  required
                  label="Labels"
                  error={!!labelsError}
                  helperText={
                    labelsError ??
                    'Type a label and press Enter to add it. Defaults to "default".'
                  }
                />
              )}
            />
          </Box>
          <Box mt={5}>
            <Box component="h3" m={0} mb={1} style={{ fontSize: '1rem' }}>
              Endpoints
            </Box>
          </Box>

          <Box mt={2}>
            <Autocomplete
              id="api-portal-production-endpoint"
              freeSolo
              fullWidth
              options={endpointOptions}
              value={productionEndpoint}
              onChange={(_e, newValue) => setProductionEndpoint(newValue ?? '')}
              onInputChange={(_e, newInputValue) =>
                setProductionEndpoint(newInputValue)
              }
              disabled={submitting}
              renderInput={params => (
                <TextField
                  {...params}
                  required
                  label="Production Endpoint"
                  helperText="The runtime URL to use as this API's production endpoint on the portal."
                />
              )}
            />
          </Box>
          <Box mt={2}>
            <Autocomplete
              id="api-portal-sandbox-endpoint"
              freeSolo
              fullWidth
              options={endpointOptions}
              value={sandboxEndpoint}
              onChange={(_e, newValue) => setSandboxEndpoint(newValue ?? '')}
              onInputChange={(_e, newInputValue) =>
                setSandboxEndpoint(newInputValue)
              }
              disabled={submitting}
              renderInput={params => (
                <TextField
                  {...params}
                  label="Sandbox Endpoint"
                  helperText="Optional."
                />
              )}
            />
          </Box>
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
