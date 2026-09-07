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
/* eslint-disable no-nested-ternary */
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  InfoCard,
  EmptyState,
  Progress,
  WarningPanel,
} from '@backstage/core-components';
import Typography from '@material-ui/core/Typography';
import { Wso2ApiDocument } from '../../../api';
import { useApiDocumentSource } from './hooks/useApiDocumentSource';
import { useWso2Documents } from './hooks/useDocuments';
import { Wso2DocumentPreview } from './components/DocumentPreview';
import { Wso2DocumentTable } from './components/DocumentTable';
import { Wso2SingleDocumentView } from './components/SingleDocumentView';
import { DocumentsToolbar } from './components/DocumentsToolbar';
import { AddDocumentDialog } from './components/AddDocumentDialog';
import { EditDocumentMetadataDialog } from './components/EditDocumentMetadataDialog';
import { DeleteDocumentDialog } from './components/DeleteDocumentDialog';

export interface EntityWso2DocumentsCardProps {
  title?: string;
  documents?: Wso2ApiDocument[];
  loading?: boolean;
  error?: Error;
}

export const EntityWso2DocumentsCard = (
  props: EntityWso2DocumentsCardProps,
) => {
  const {
    documents: propDocuments,
    loading: propLoading,
    error: propError,
  } = props;
  const { entity } = useEntity();
  const { mode } = useApiDocumentSource(entity);

  const {
    documents,
    capabilities,
    refresh,
    previewDoc,
    previewContent,
    loadingPreview,
    setPreviewDoc,
    handleDownload,
    handlePreview,
  } = useWso2Documents({ entity, propDocuments, mode });

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Wso2ApiDocument | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<Wso2ApiDocument | null>(null);

  // Trigger preview automatically if there is only one document — on-prem
  // ('annotation' mode) only. Gateway mode always shows the table so
  // Add/Actions stay reachable (see OQ-2 in the design doc).
  useEffect(() => {
    if (
      mode === 'annotation' &&
      documents.length === 1 &&
      !previewDoc &&
      !loadingPreview
    ) {
      const doc = documents[0];
      if (doc.sourceType === 'MARKDOWN' || doc.sourceType === 'INLINE') {
        handlePreview(doc);
      }
    }
  }, [documents, mode, previewDoc, loadingPreview, handlePreview]);

  if (propLoading) {
    return (
      <InfoCard variant="gridItem">
        <Progress />
      </InfoCard>
    );
  }

  if (propError) {
    return (
      <InfoCard variant="gridItem">
        <WarningPanel severity="error" title="Failed to load documents">
          {propError.message}
        </WarningPanel>
      </InfoCard>
    );
  }

  const showBackButton =
    mode === 'store' ? true : documents.length > 1;

  const renderPreview = () => (
    <Wso2DocumentPreview
      previewDoc={previewDoc}
      previewContent={previewContent}
      loadingPreview={loadingPreview}
      showBackButton={showBackButton}
      onBack={() => setPreviewDoc(null)}
      onDownload={handleDownload}
    />
  );

  if (mode === 'unsupported') {
    return (
      <InfoCard variant="gridItem">
        <EmptyState
          title="Documents unavailable"
          missing="info"
          description="Documents are not supported for API Platform APIs discovered from self-hosted gateways. Please check the WSO2 API Platform directly for documentation."
        />
      </InfoCard>
    );
  }

  if (mode === 'store') {
    return (
      <InfoCard variant="gridItem">
        <DocumentsToolbar
          canAdd={capabilities.create}
          onAdd={() => setAddDialogOpen(true)}
        />
        {previewDoc ? (
          renderPreview()
        ) : documents.length === 0 ? (
          <Typography color="textSecondary" variant="body2">
            No documents yet — add one above.
          </Typography>
        ) : (
          <Wso2DocumentTable
            documents={documents}
            onPreview={handlePreview}
            onDownload={handleDownload}
            capabilities={capabilities}
            onEditMetadata={setEditingDoc}
            onDelete={setDeletingDoc}
          />
        )}
        {addDialogOpen && (
          <AddDocumentDialog
            entity={entity}
            open={addDialogOpen}
            onClose={() => setAddDialogOpen(false)}
            onCreated={() => {
              setAddDialogOpen(false);
              refresh();
            }}
          />
        )}
        {editingDoc && (
          <EditDocumentMetadataDialog
            entity={entity}
            document={editingDoc}
            open={!!editingDoc}
            onClose={() => setEditingDoc(null)}
            onUpdated={() => {
              setEditingDoc(null);
              refresh();
            }}
          />
        )}
        {deletingDoc && (
          <DeleteDocumentDialog
            entity={entity}
            document={deletingDoc}
            open={!!deletingDoc}
            onClose={() => setDeletingDoc(null)}
            onDeleted={() => {
              setDeletingDoc(null);
              refresh();
            }}
          />
        )}
      </InfoCard>
    );
  }

  // mode === 'annotation' — on-prem APIM, unchanged.
  return (
    <InfoCard variant="gridItem">
      {documents.length === 0 ? (
        <EmptyState
          title="No documents"
          missing="info"
          description="This API has no documents attached in WSO2 API Manager."
        />
      ) : (
        <>
          {previewDoc && documents.length > 1 ? (
            renderPreview()
          ) : documents.length === 1 ? (
            <Wso2SingleDocumentView
              document={documents[0]}
              onDownload={handleDownload}
              renderPreview={renderPreview}
            />
          ) : (
            <Wso2DocumentTable
              documents={documents}
              onPreview={handlePreview}
              onDownload={handleDownload}
            />
          )}
        </>
      )}
    </InfoCard>
  );
};
