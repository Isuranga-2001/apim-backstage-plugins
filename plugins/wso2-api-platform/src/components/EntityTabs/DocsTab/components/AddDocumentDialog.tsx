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
import DialogTitle from '@material-ui/core/DialogTitle';
import Snackbar from '@material-ui/core/Snackbar';
import Alert from '@material-ui/lab/Alert';
import { CreateWso2ApiDocumentRequest } from '../../../../api';
import { useDocumentMutations } from '../hooks/useDocumentMutations';
import {
  DocumentMetadataForm,
  DocumentMetadataFormValue,
} from './DocumentMetadataForm';
import {
  DocumentContentEditor,
  DocumentContentValue,
} from './content/DocumentContentEditor';

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const AddDocumentDialog = (options: {
  entity: Entity;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) => {
  const { entity, open, onClose, onCreated } = options;
  const configApi = useApi(configApiRef);
  const { submitting, createDocument, snackbar, closeSnackbar } =
    useDocumentMutations(entity);

  const maxFileSizeMb =
    configApi.getOptionalNumber(
      'wso2ApiPlatform.storage.documents.maxFileSizeMb',
    ) ?? 10;
  const maxInlineSizeKb =
    configApi.getOptionalNumber(
      'wso2ApiPlatform.storage.documents.maxInlineSizeKb',
    ) ?? 512;
  const allowedExtensions =
    configApi.getOptionalStringArray(
      'wso2ApiPlatform.storage.documents.allowedExtensions',
    ) ?? [];
  const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;
  const maxInlineSizeBytes = maxInlineSizeKb * 1024;

  const [metadata, setMetadata] = useState<DocumentMetadataFormValue>({
    name: '',
    type: 'HOWTO',
    otherTypeName: '',
    summary: '',
    visibility: 'API_LEVEL',
  });
  const [content, setContent] = useState<DocumentContentValue>({
    sourceType: 'MARKDOWN',
    inlineContent: '',
    sourceUrl: '',
    file: null,
  });
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!metadata.name.trim()) return 'Name is required.';
    if (metadata.type === 'OTHER' && !metadata.otherTypeName.trim()) {
      return "Other type name is required when type is 'Other'.";
    }
    if (content.sourceType === 'URL') {
      if (!content.sourceUrl.trim() || !isHttpUrl(content.sourceUrl)) {
        return 'A valid http:// or https:// URL is required.';
      }
    }
    if (
      (content.sourceType === 'MARKDOWN' || content.sourceType === 'INLINE') &&
      !content.inlineContent.trim()
    ) {
      return 'Content is required.';
    }
    if (content.sourceType === 'FILE') {
      if (!content.file) return 'A file is required.';
      if (content.file.size > maxFileSizeBytes) {
        return `File exceeds the ${maxFileSizeMb} MB limit.`;
      }
      const ext = content.file.name.split('.').pop()?.toLowerCase();
      if (
        allowedExtensions.length > 0 &&
        (!ext || !allowedExtensions.includes(ext))
      ) {
        return `File extension '${
          ext ?? ''
        }' is not in the allowed list: ${allowedExtensions.join(', ')}.`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    const input: CreateWso2ApiDocumentRequest = {
      name: metadata.name.trim(),
      type: metadata.type,
      summary: metadata.summary.trim() || undefined,
      visibility: metadata.visibility,
      sourceType: content.sourceType,
      ...(metadata.type === 'OTHER'
        ? { otherTypeName: metadata.otherTypeName.trim() }
        : {}),
      ...(content.sourceType === 'URL'
        ? { sourceUrl: content.sourceUrl.trim() }
        : {}),
      ...(content.sourceType === 'MARKDOWN' || content.sourceType === 'INLINE'
        ? { inlineContent: content.inlineContent }
        : {}),
      ...(content.sourceType === 'FILE' ? { file: content.file! } : {}),
    };

    try {
      await createDocument(input);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create document.');
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Add Document</DialogTitle>
        <DialogContent>
          {error && (
            <Box mb={2}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}
          <DocumentMetadataForm
            value={metadata}
            onChange={setMetadata}
            disabled={submitting}
          />
          <Box mt={3}>
            <DocumentContentEditor
              value={content}
              onChange={setContent}
              maxInlineSizeBytes={maxInlineSizeBytes}
              maxFileSizeBytes={maxFileSizeBytes}
              allowedExtensions={allowedExtensions}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={20} /> : 'Add Document'}
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
