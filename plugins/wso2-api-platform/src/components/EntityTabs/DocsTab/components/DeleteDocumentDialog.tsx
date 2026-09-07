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

export const DeleteDocumentDialog = (options: {
  entity: Entity;
  document: Wso2ApiDocument;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) => {
  const { entity, document: doc, open, onClose, onDeleted } = options;
  const { submitting, deleteDocument, snackbar, closeSnackbar } =
    useDocumentMutations(entity);
  const [error, setError] = useState<string | null>(null);
  const documentId = doc.documentId || doc.id;

  const handleDelete = async () => {
    setError(null);
    try {
      await deleteDocument(documentId!, doc.name);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete document.');
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose}>
        <DialogTitle>Delete document?</DialogTitle>
        <DialogContent>
          {error && (
            <Box mb={2}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}
          <Typography>
            "{doc.name}" will be permanently deleted from the WSO2 API Platform
            document store. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleDelete}
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={20} /> : 'Delete'}
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
