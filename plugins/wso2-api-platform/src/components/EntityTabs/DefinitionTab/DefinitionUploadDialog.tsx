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
import { Entity } from '@backstage/catalog-model';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
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

const ALLOWED_EXTENSIONS = ['yaml', 'yml', 'json'];

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
}) => {
  const { entity, open, hasExistingDefinition, onClose, onSaved } = options;
  const configApi = useApi(configApiRef);
  const {
    submitting,
    upsertDefinition,
    previewing,
    previewDiff,
    snackbar,
    closeSnackbar,
  } = useDefinitionMutations(entity);

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
    try {
      await upsertDefinition(file.name, content);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save definition.');
    }
  };

  const handleSubmit = async () => {
    const content = await validateAndReadFile();
    if (content === undefined) {
      return;
    }

    if (!hasExistingDefinition) {
      await handleSave(content);
      return;
    }

    try {
      const diff = await previewDiff(content);
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

  let dialogTitle = 'Add Definition';
  if (isReviewing) {
    dialogTitle = 'Review Changes';
  } else if (hasExistingDefinition) {
    dialogTitle = 'Upload Definition';
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          {error && (
            <Box mb={2}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}
          {isReviewing ? (
            <DefinitionDiffSummary diff={diffResult} />
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
        </DialogContent>
        <DialogActions>
          {isReviewing ? (
            <>
              <Button onClick={handleBackToFilePicker} disabled={submitting}>
                Back
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleConfirmReplace}
                disabled={submitting || diffResult?.hasChanges === false}
              >
                {submitting ? <CircularProgress size={20} /> : 'Confirm & Save'}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onClose} disabled={submitting || previewing}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit}
                disabled={submitting || previewing}
              >
                {submitting || previewing ? (
                  <CircularProgress size={20} />
                ) : (
                  'Save'
                )}
              </Button>
            </>
          )}
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
