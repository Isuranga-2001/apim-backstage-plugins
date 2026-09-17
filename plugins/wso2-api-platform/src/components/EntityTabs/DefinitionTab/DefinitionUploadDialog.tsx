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

import { useRef, useState } from 'react';
import * as yaml from 'js-yaml';
import { useNavigate } from 'react-router-dom';
import { Entity } from '@backstage/catalog-model';
import { configApiRef, useApi, useRouteRef } from '@backstage/core-plugin-api';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import CircularProgress from '@material-ui/core/CircularProgress';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Snackbar from '@material-ui/core/Snackbar';
import Typography from '@material-ui/core/Typography';
import Alert from '@material-ui/lab/Alert';
import { useDefinitionMutations } from './hooks/useDefinitionMutations';
import { humanizeBytes } from '../DocsTab/utils/humanizeBytes';
import { DefinitionDiffSummary } from './DefinitionDiffSummary';
import { Wso2RestApiArtifactDiff } from '../../../api/types';
import { rootRouteRef } from '../../../routes';

const ALLOWED_EXTENSIONS = ['yaml', 'yml', 'json'];
const WARN_COLOR = '#e7893c';

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export const DefinitionUploadDialog = (options: {
  entity: Entity;
  open: boolean;
  hasExistingDefinition: boolean;
  onClose: () => void;
  onSaved: () => void;
  savePushesToGateway: boolean;
}) => {
  const {
    entity,
    open,
    hasExistingDefinition,
    onClose,
    onSaved,
    savePushesToGateway,
  } = options;
  const configApi = useApi(configApiRef);
  const navigate = useNavigate();
  const homeRoute = useRouteRef(rootRouteRef);
  const { upsertDefinition, previewing, previewDiff, snackbar, closeSnackbar } =
    useDefinitionMutations(entity);

  const [applying, setApplying] = useState(false);

  const maxSizeKb =
    configApi.getOptionalNumber(
      'wso2ApiPlatform.storage.definitions.maxSizeKb',
    ) ?? 1024;
  const maxSizeBytes = maxSizeKb * 1024;

  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<
    Wso2RestApiArtifactDiff | null | undefined
  >(undefined);

  const validateAndReadFile = async (): Promise<string | undefined> => {
    if (!file) {
      setError('Choose a YAML or JSON file to upload.');
      return undefined;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      setError(
        `File extension '${
          ext ?? ''
        }' is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}.`,
      );
      return undefined;
    }
    if (file.size > maxSizeBytes) {
      setError(`File exceeds the ${humanizeBytes(maxSizeBytes)} limit.`);
      return undefined;
    }

    const content = await readFileAsText(file);
    try {
      yaml.load(content);
    } catch (e) {
      setError('The file does not contain valid YAML or JSON.');
      return undefined;
    }

    setError(null);
    return content;
  };

  const handleSave = async (content: string) => {
    if (!file) {
      return;
    }
    setApplying(true);
    try {
      await upsertDefinition(file.name, content);
      onSaved();
      if (savePushesToGateway) {
        navigate(homeRoute());
      } else {
        setApplying(false);
      }
    } catch (e) {
      setApplying(false);
      setError(e instanceof Error ? e.message : 'Failed to save definition.');
    }
  };

  const handleSubmit = async () => {
    const content = await validateAndReadFile();
    if (content === undefined) {
      return;
    }

    try {
      const diff = await previewDiff(content);
      if (!diff?.hasChanges) {
        setDiffResult(diff);
        await handleSave(content);
        return;
      }
      setDiffResult(diff);
      setPendingContent(content);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to preview the changes.',
      );
    }
  };

  const handleBackToFilePicker = () => {
    setPendingContent(null);
    setDiffResult(undefined);
  };

  const handleConfirmReplace = async () => {
    if (pendingContent) {
      await handleSave(pendingContent);
    }
  };

  const isReviewing = pendingContent !== null;
  const isAddFlow = !hasExistingDefinition;
  const diffHasChanges = diffResult?.hasChanges === true;
  const diffHasBlockingMismatch =
    isAddFlow &&
    !!(
      diffResult?.displayNameChange ||
      diffResult?.versionChange ||
      (diffResult?.addedOperations.length ?? 0) > 0 ||
      (diffResult?.removedOperations.length ?? 0) > 0
    );
  const blocksAdd = isAddFlow && savePushesToGateway && diffHasBlockingMismatch;
  let confirmLabel = 'Confirm & Save';
  if (isAddFlow) {
    confirmLabel = diffHasChanges ? 'Understand & Confirm' : 'Save';
  }

  let dialogTitle = 'Add Definition';
  if (isReviewing) {
    dialogTitle = 'Review Changes';
  } else if (hasExistingDefinition) {
    dialogTitle = 'Upload Definition';
  }
  const showApplyingWaitScreen = applying && savePushesToGateway;
  if (showApplyingWaitScreen) {
    dialogTitle = 'Applying Changes';
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={applying ? undefined : onClose}
        disableEscapeKeyDown={applying}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          {showApplyingWaitScreen ? (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              py={4}
            >
              <CircularProgress />
              <Typography
                variant="body2"
                color="textSecondary"
                style={{ marginTop: 16 }}
              >
                Saving the definition and syncing the catalog. Please wait…
              </Typography>
            </Box>
          ) : (
            <>
              {error && (
                <Box mb={2}>
                  <Alert severity="error">{error}</Alert>
                </Box>
              )}
              {isReviewing ? (
                <>
                  <DefinitionDiffSummary
                    diff={diffResult}
                    pushesToGateway={savePushesToGateway}
                  />
                  {isAddFlow && diffHasChanges && (
                    <Alert
                      severity={blocksAdd ? 'error' : 'warning'}
                      style={{ marginTop: 8 }}
                    >
                      {blocksAdd
                        ? "This definition doesn't match the API currently discovered on the gateway. Resolve the differences above before adding it."
                        : 'There may be problems after adding this definition because of the differences above.'}
                    </Alert>
                  )}
                </>
              ) : (
                <>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".yaml,.yml,.json"
                    style={{ display: 'none' }}
                    data-testid="definition-file-input"
                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => inputRef.current?.click()}
                  >
                    Choose file
                  </Button>
                  {file && (
                    <Chip
                      style={{ marginLeft: 8 }}
                      label={`${file.name} (${humanizeBytes(file.size)})`}
                      onDelete={() => setFile(null)}
                    />
                  )}
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    display="block"
                    style={{ marginTop: 8 }}
                  >
                    Allowed types: {ALLOWED_EXTENSIONS.join(', ')}. Max size:{' '}
                    {humanizeBytes(maxSizeBytes)}.
                  </Typography>
                </>
              )}
            </>
          )}
        </DialogContent>
        {!showApplyingWaitScreen && (
          <DialogActions>
            {isReviewing ? (
              <>
                <Button onClick={handleBackToFilePicker} disabled={applying}>
                  Back
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleConfirmReplace}
                  style={
                    confirmLabel === 'Understand & Confirm'
                      ? { backgroundColor: WARN_COLOR }
                      : undefined
                  }
                  disabled={
                    applying ||
                    blocksAdd ||
                    (!isAddFlow && diffResult?.hasChanges === false)
                  }
                >
                  {confirmLabel}
                </Button>
              </>
            ) : (
              <>
                <Button onClick={onClose} disabled={previewing || applying}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSubmit}
                  disabled={previewing || applying}
                >
                  {previewing ? <CircularProgress size={20} /> : 'Save'}
                </Button>
              </>
            )}
          </DialogActions>
        )}
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
