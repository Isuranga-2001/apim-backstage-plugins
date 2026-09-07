import { useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { InfoCard } from '@backstage/core-components';
import Box from '@material-ui/core/Box';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import { makeStyles } from '@material-ui/core/styles';
import { useAsync } from 'react-use';
import { useApi } from '@backstage/core-plugin-api';
import { wso2ApiPlatformApiRef } from '../../../api';
import { ApiDefinitionViewer } from './ApiDefinitionViewer';
import { DefinitionPanel } from './DefinitionPanel';
import { isApiProductEntity } from '../../../utils';
import { EntityWso2ApiProductResourcesTab } from './ApiProductResourcesTab';

const useStyles = makeStyles(theme => ({
  subTabs: {
    '& .MuiTabs-indicator': {
      height: 2,
      backgroundColor: theme.palette.primary.main,
    },
  },
  tabRoot: {
    minWidth: 120,
    textTransform: 'none',
    fontWeight: 600,
    '&.Mui-selected': {
      borderBottom: `2px solid ${theme.palette.primary.main}`,
    },
  },
}));

export const EntityWso2ApiDefinitionTab = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const apiClient = useApi(wso2ApiPlatformApiRef);
  const [activeTab, setActiveTab] = useState<'source' | 'wsdl' | 'resources'>(
    'source',
  );

  const apiId =
    entity.metadata.annotations?.['wso2.com/api-id'] ||
    entity.metadata.annotations?.['wso2-gateway.com/api-id'];

  const typeStr = String(
    entity.metadata.annotations?.['wso2.com/api-type'] ||
      entity.spec?.type ||
      '',
  ).toUpperCase();
  const isSoap = typeStr === 'SOAP';
  const isApiProduct = isApiProductEntity(entity);
  const hasTabs = isSoap || isApiProduct;

  const wsdlContentState = useAsync(async () => {
    if (!isSoap || !apiId) return undefined;
    const annotationWsdl = entity.metadata.annotations?.['wso2.com/api-wsdl'];
    if (annotationWsdl) {
      return { isZip: false, text: annotationWsdl };
    }

    try {
      const blob = await apiClient.getApiWsdl(apiId);
      if (blob.type === 'application/zip') {
        return { isZip: true, text: undefined, blob };
      }
      const text = await blob.text();
      if (text.startsWith('PK')) {
        return { isZip: true, text: undefined, blob };
      }
      return { isZip: false, text, blob };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to dynamically load WSDL content:', err);
      return { isZip: false, text: undefined, error: err };
    }
  }, [apiId, isSoap, entity.metadata.annotations, apiClient]);

  if (!hasTabs) {
    return (
      <DefinitionPanel
        entity={entity}
        language={typeStr === 'GRAPHQL' ? 'graphql' : undefined}
        wrapInCard
      />
    );
  }

  return (
    <InfoCard>
      <Box mb={2}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          className={classes.subTabs}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab
            label="API Definition"
            value="source"
            className={classes.tabRoot}
          />
          {isSoap && (
            <Tab label="WSDL" value="wsdl" className={classes.tabRoot} />
          )}
          {isApiProduct && (
            <Tab
              label="Resources"
              value="resources"
              className={classes.tabRoot}
            />
          )}
        </Tabs>
      </Box>

      {activeTab === 'source' && (
        <Box p={2}>
          <DefinitionPanel
            entity={entity}
            language={typeStr === 'GRAPHQL' ? 'graphql' : undefined}
          />
        </Box>
      )}

      {activeTab === 'wsdl' && (
        <Box p={2}>
          {wsdlContentState.loading && (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={30} />
            </Box>
          )}

          {!wsdlContentState.loading &&
            wsdlContentState.value?.text &&
            (() => {
              const wsdlText = wsdlContentState.value.text;
              return (
                <Box mt={1}>
                  <Typography variant="h6" gutterBottom>
                    WSDL Definition
                  </Typography>
                  <ApiDefinitionViewer value={wsdlText} />
                </Box>
              );
            })()}

          {!wsdlContentState.loading &&
            wsdlContentState.value?.isZip &&
            wsdlContentState.value?.blob && (
              <Box
                mt={1}
                p={4}
                border={1}
                borderColor="divider"
                borderRadius={4}
                textAlign="center"
                bgcolor="background.default"
              >
                <Typography
                  variant="body2"
                  color="textSecondary"
                  style={{ marginBottom: '16px' }}
                >
                  This API's WSDL definition is provided as a ZIP archive
                  containing multiple files.
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    const url = window.URL.createObjectURL(
                      wsdlContentState.value!.blob!,
                    );
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', `${apiId}-wsdl.zip`);
                    document.body.appendChild(link);
                    link.click();
                    link.parentNode?.removeChild(link);
                    window.URL.revokeObjectURL(url);
                  }}
                >
                  Download ZIP
                </Button>
              </Box>
            )}

          {!wsdlContentState.loading &&
            !wsdlContentState.value?.text &&
            !wsdlContentState.value?.isZip && (
              <Box
                p={4}
                border={1}
                borderColor="divider"
                borderRadius={4}
                textAlign="center"
                bgcolor="background.default"
              >
                <Typography variant="body2" color="textSecondary">
                  WSDL text definition is not available for this API.
                </Typography>
              </Box>
            )}
        </Box>
      )}

      {activeTab === 'resources' && isApiProduct && (
        <Box p={2}>
          <EntityWso2ApiProductResourcesTab />
        </Box>
      )}
    </InfoCard>
  );
};
