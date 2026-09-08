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
import { EmptyState, InfoCard } from '@backstage/core-components';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import AddIcon from '@material-ui/icons/Add';
import { ApiDefinitionViewer } from './ApiDefinitionViewer';
import { DefinitionUploadDialog } from './DefinitionUploadDialog';
import { useApiDefinition } from './hooks/useApiDefinition';
import { useApiDefinitionSource } from './hooks/useApiDefinitionSource';

const NotAvailableBox = ({ message }: { message: string }) => (
  <Box
    p={4}
    border={1}
    borderColor="divider"
    borderRadius={4}
    textAlign="center"
    bgcolor="background.default"
  >
    <Typography variant="body2" color="textSecondary">
      {message}
    </Typography>
  </Box>
);

const NoDefinitionBox = ({ onAdd }: { onAdd: () => void }) => (
  <Box
    p={4}
    border={1}
    borderColor="divider"
    borderRadius={4}
    textAlign="center"
    bgcolor="background.default"
  >
    <Typography variant="body2" color="textSecondary" gutterBottom>
      No definition has been added for this API yet.
    </Typography>
    <Box mt={2} display="flex" justifyContent="center">
      <Button
        variant="contained"
        color="primary"
        size="small"
        startIcon={<AddIcon />}
        onClick={onAdd}
      >
        Add Definition
      </Button>
    </Box>
  </Box>
);

export const DefinitionPanel = (props: {
  entity: Entity;
  language?: string;
  wrapInCard?: boolean;
}) => {
  const { entity, language, wrapInCard } = props;
  const { mode } = useApiDefinitionSource(entity);
  const { definition, capabilities, refresh } = useApiDefinition(entity, mode);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (mode === 'unsupported') {
    return wrapInCard ? (
      <EmptyState
        title="Definition unavailable"
        missing="info"
        description="API definitions are not supported for API Platform APIs discovered from self-hosted gateways."
      />
    ) : (
      <NotAvailableBox message="API definition is not available for this API." />
    );
  }

  if (mode === 'annotation') {
    if (!definition) {
      return wrapInCard ? (
        <EmptyState
          title="No Definition"
          missing="data"
          description="This API does not have a definition available."
        />
      ) : (
        <NotAvailableBox message="API definition is not available for this API." />
      );
    }
    const viewer = (
      <ApiDefinitionViewer value={definition.content} language={language} />
    );
    return wrapInCard ? <InfoCard>{viewer}</InfoCard> : viewer;
  }

  let definitionContent;
  if (definition) {
    definitionContent = (
      <ApiDefinitionViewer
        value={definition.content}
        onUpdateClick={
          capabilities.write ? () => setDialogOpen(true) : undefined
        }
      />
    );
  } else if (capabilities.write) {
    definitionContent = <NoDefinitionBox onAdd={() => setDialogOpen(true)} />;
  } else {
    definitionContent = (
      <NotAvailableBox message="No definition has been added for this API yet." />
    );
  }

  const content = (
    <Box>
      {definitionContent}
      {dialogOpen && (
        <DefinitionUploadDialog
          entity={entity}
          open={dialogOpen}
          hasExistingDefinition={!!definition}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            refresh();
          }}
        />
      )}
    </Box>
  );

  return wrapInCard ? <InfoCard>{content}</InfoCard> : content;
};
