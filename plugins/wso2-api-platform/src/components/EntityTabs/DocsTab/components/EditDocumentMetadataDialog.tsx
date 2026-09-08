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
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Snackbar from '@material-ui/core/Snackbar';
import Typography from '@material-ui/core/Typography';
import Alert from '@material-ui/lab/Alert';
import { Wso2ApiDocument } from '../../../../api';
import { useDocumentMutations } from '../hooks/useDocumentMutations';
import { humanizeBytes } from '../utils/humanizeBytes';
import {
  DocumentMetadataForm,
  DocumentMetadataFormValue,
} from './DocumentMetadataForm';
import { UrlContentInput } from './content/UrlContentInput';

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const EditDocumentMetadataDialog = (options: {
  entity: Entity;
  document: Wso2ApiDocument;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) => {
  const { entity, document: doc, open, onClose, onUpdated } = options;
  const { submitting, updateDocumentMetadata, snackbar, closeSnackbar } =
    useDocumentMutations(entity);

  const [metadata, setMetadata] = useState<DocumentMetadataFormValue>({
    name: doc.name,
    type: doc.type ?? 'OTHER',
    otherTypeName: doc.otherTypeName ?? '',
    summary: doc.summary ?? '',
  });
  // sourceUrl is editable only for URL documents (OQ-1) — a metadata
  // column, unlike blob/text content, which stays frozen this release.
  const [sourceUrl, setSourceUrl] = useState(doc.sourceUrl ?? '');
  const [error, setError] = useState<string | null>(null);

  const documentId = doc.documentId || doc.id;

  const handleSubmit = async () => {
    if (!metadata.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (metadata.type === 'OTHER' && !metadata.otherTypeName.trim()) {
      setError("Other type name is required when type is 'Other'.");
      return;
    }
    if (doc.sourceType === 'URL' && !isHttpUrl(sourceUrl)) {
      setError('Source URL must be an http:// or https:// URL.');
      return;
    }
    setError(null);

    try {
      await updateDocumentMetadata(documentId!, {
        name: metadata.name.trim(),
        type: metadata.type,
        summary: metadata.summary.trim() || undefined,
        ...(metadata.type === 'OTHER'
          ? { otherTypeName: metadata.otherTypeName.trim() }
          : {}),
        ...(doc.sourceType === 'URL' ? { sourceUrl: sourceUrl.trim() } : {}),
      });
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update document.');
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Edit document metadata</DialogTitle>
        <DialogContent>
          {error && (
            <Box mb={2}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}
          <Box mb={2}>
            <Typography variant="body2" color="textSecondary">
              Source type: {doc.sourceType}
              {doc.fileName ? ` — ${doc.fileName}` : ''}
              {doc.sizeBytes !== undefined
                ? ` (${humanizeBytes(doc.sizeBytes)})`
                : ''}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Content cannot be changed in this release.
            </Typography>
          </Box>
          <DocumentMetadataForm
            value={metadata}
            onChange={setMetadata}
            disabled={submitting}
          />
          {doc.sourceType === 'URL' && (
            <Box mt={2}>
              <UrlContentInput value={sourceUrl} onChange={setSourceUrl} />
            </Box>
          )}
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
            {submitting ? <CircularProgress size={20} /> : 'Save'}
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
