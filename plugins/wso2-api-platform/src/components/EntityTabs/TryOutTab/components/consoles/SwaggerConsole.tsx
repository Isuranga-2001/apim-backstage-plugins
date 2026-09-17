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

import {
  MutableRefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
// @ts-ignore
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import TextField from '@material-ui/core/TextField';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Badge from '@material-ui/core/Badge';
import Tooltip from '@material-ui/core/Tooltip';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import { Wso2ApiDetail } from '../../../../../api';

const hideInfoPlugin = {
  components: {
    info: () => null,
  },
};

const useStyles = makeStyles(theme => ({
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  accordionDetails: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  headersFabOverlay: {
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    zIndex: 10,
  },
  inlineHeaderEditor: {
    padding: theme.spacing(1, 0),
    margin: theme.spacing(0, 2, 1),
    borderTop: `1px solid ${theme.palette.divider}`,
    '& input.MuiOutlinedInput-input[type="text"]': {
      maxWidth: 'none !important',
      minWidth: '0 !important',
      margin: '0 !important',
      padding: '8.5px 14px !important',
      border: 'none !important',
      borderRadius: 0,
      background: 'transparent !important',
      lineHeight: 'inherit !important',
      color: 'inherit !important',
    },
  },
}));

type HeaderEntry = { name: string; value: string };

function pathTemplateToRegex(template: string): RegExp {
  const pattern = template
    .split('/')
    .map(segment =>
      segment.startsWith('{') && segment.endsWith('}')
        ? '[^/]+'
        : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('/');
  return new RegExp(`${pattern}/?$`);
}

function HeaderList({
  headers,
  onAdd,
  onRemove,
  onUpdate,
  classes,
}: {
  headers: HeaderEntry[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, field: 'name' | 'value', value: string) => void;
  classes: ReturnType<typeof useStyles>;
}) {
  return (
    <>
      {headers.map((header, idx) => (
        <Box key={idx} className={classes.headerRow}>
          <TextField
            placeholder="Header name"
            value={header.name}
            onChange={e => onUpdate(idx, 'name', e.target.value)}
            variant="outlined"
            size="small"
            style={{ flex: 1 }}
          />
          <TextField
            placeholder="Header value"
            value={header.value}
            onChange={e => onUpdate(idx, 'value', e.target.value)}
            variant="outlined"
            size="small"
            style={{ flex: 2 }}
          />
          <IconButton
            size="small"
            onClick={() => onRemove(idx)}
            color="secondary"
            aria-label="Remove header"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={onAdd}
        style={{ textTransform: 'none', alignSelf: 'flex-start' }}
      >
        Add Header
      </Button>
    </>
  );
}

function OperationHeaderEditor({
  operationKey,
  headersRef,
}: {
  operationKey: string;
  headersRef: MutableRefObject<Record<string, HeaderEntry[]>>;
}) {
  const classes = useStyles();
  const [headers, setHeaders] = useState<HeaderEntry[]>(
    () => headersRef.current[operationKey] || [],
  );

  const commit = (next: HeaderEntry[]) => {
    setHeaders(next);
    headersRef.current = { ...headersRef.current, [operationKey]: next };
  };

  const addHeader = () => commit([...headers, { name: '', value: '' }]);
  const removeHeader = (idx: number) =>
    commit(headers.filter((_, i) => i !== idx));
  const updateHeader = (idx: number, field: 'name' | 'value', value: string) =>
    commit(headers.map((h, i) => (i === idx ? { ...h, [field]: value } : h)));

  return (
    <Box className={classes.inlineHeaderEditor}>
      <Typography
        variant="caption"
        style={{
          fontWeight: 'bold',
          opacity: 0.7,
          display: 'block',
          marginBottom: 8,
        }}
      >
        Custom Headers
      </Typography>
      <HeaderList
        headers={headers}
        onAdd={addHeader}
        onRemove={removeHeader}
        onUpdate={updateHeader}
        classes={classes}
      />
    </Box>
  );
}

function buildInlineHeadersPlugin(
  headersRef: MutableRefObject<Record<string, HeaderEntry[]>>,
) {
  return {
    wrapComponents: {
      parameters: (Original: any) => (props: any) => {
        const [path, method] = props.pathMethod || [];
        const isHttpOp = typeof path === 'string' && typeof method === 'string';
        return (
          <>
            <Original {...props} />
            {isHttpOp && (
              <OperationHeaderEditor
                operationKey={`${method.toUpperCase()} ${path}`}
                headersRef={headersRef}
              />
            )}
          </>
        );
      },
    },
  };
}

interface SwaggerConsoleProps {
  swaggerSpec: any;
  tryOutPlugin: any;
  apiKeyRef: MutableRefObject<string | null>;
  externalApiKey: string;
  apiKeyAuthPolicy: any;
  details?: Wso2ApiDetail;
}

export const SwaggerConsole = ({
  swaggerSpec,
  tryOutPlugin,
  apiKeyRef,
  externalApiKey,
  apiKeyAuthPolicy,
  details,
}: SwaggerConsoleProps) => {
  const classes = useStyles();
  const defaultApiKeyHeader =
    details?.type?.toUpperCase() === 'SOAP' ? 'ApiKey' : 'apikey';

  const [headersDialogOpen, setHeadersDialogOpen] = useState(false);
  const [globalHeaders, setGlobalHeaders] = useState<HeaderEntry[]>([]);

  const globalHeadersRef = useRef<HeaderEntry[]>(globalHeaders);
  useEffect(() => {
    globalHeadersRef.current = globalHeaders;
  }, [globalHeaders]);

  const perRequestHeadersRef = useRef<Record<string, HeaderEntry[]>>({});

  const inlineHeadersPlugin = useMemo(
    () => buildInlineHeadersPlugin(perRequestHeadersRef),
    [],
  );

  const addGlobalHeader = () =>
    setGlobalHeaders(prev => [...prev, { name: '', value: '' }]);
  const removeGlobalHeader = (idx: number) =>
    setGlobalHeaders(prev => prev.filter((_, i) => i !== idx));
  const updateGlobalHeader = (
    idx: number,
    field: 'name' | 'value',
    value: string,
  ) =>
    setGlobalHeaders(prev =>
      prev.map((header, i) =>
        i === idx ? { ...header, [field]: value } : header,
      ),
    );

  return (
    <Box position="relative">
      <Dialog
        open={headersDialogOpen}
        onClose={() => setHeadersDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Global Headers</DialogTitle>
        <DialogContent>
          <Typography
            variant="caption"
            color="textSecondary"
            style={{ marginBottom: 8, display: 'block' }}
          >
            Applied to every request sent from this Swagger UI. To scope a
            header to a single request instead, expand that operation and use
            its own "Custom Headers" section, right above the Execute button.
          </Typography>
          <HeaderList
            headers={globalHeaders}
            onAdd={addGlobalHeader}
            onRemove={removeGlobalHeader}
            onUpdate={updateGlobalHeader}
            classes={classes}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHeadersDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Box className={classes.headersFabOverlay}>
        <Tooltip title="Configure global headers">
          <Button
            color="primary"
            variant="contained"
            size="small"
            startIcon={
              globalHeaders.length > 0 ? (
                <Badge badgeContent={globalHeaders.length} color="secondary">
                  <AddIcon />
                </Badge>
              ) : (
                <AddIcon />
              )
            }
            onClick={() => setHeadersDialogOpen(true)}
            style={{ textTransform: 'none' }}
          >
            Add Header
          </Button>
        </Tooltip>
      </Box>

      <SwaggerUI
        spec={swaggerSpec}
        plugins={[tryOutPlugin, hideInfoPlugin, inlineHeadersPlugin]}
        supportedSubmitMethods={[
          'get',
          'put',
          'post',
          'delete',
          'options',
          'head',
          'patch',
          'trace',
        ]}
        requestInterceptor={(req: any) => {
          const currentKey = apiKeyRef.current;
          if (currentKey !== null) {
            const headerName = details?.apiKeyHeader || defaultApiKeyHeader;
            req.headers[headerName] = currentKey;
          }
          if (externalApiKey && apiKeyAuthPolicy) {
            const { in: location, key } = apiKeyAuthPolicy.params || {};
            if (location === 'header') {
              req.headers[key || 'x-api-key'] = externalApiKey;
            } else if (location === 'query') {
              const separator = req.url.includes('?') ? '&' : '?';
              req.url = `${req.url}${separator}${
                key || 'api-key'
              }=${encodeURIComponent(externalApiKey)}`;
            }
          }

          globalHeadersRef.current.forEach(({ name, value }) => {
            if (name.trim()) {
              req.headers[name] = value;
            }
          });

          let requestPath = req.url;
          try {
            requestPath = new URL(req.url).pathname;
          } catch {
            // req.url wasn't absolute; fall back to using it as-is.
          }
          const requestMethod = (req.method || '').toUpperCase();
          Object.entries(perRequestHeadersRef.current).forEach(
            ([operation, headers]) => {
              const spaceIdx = operation.indexOf(' ');
              const method = operation.slice(0, spaceIdx);
              const template = operation.slice(spaceIdx + 1);
              if (
                method === requestMethod &&
                pathTemplateToRegex(template).test(requestPath)
              ) {
                headers.forEach(({ name, value }) => {
                  if (name.trim()) {
                    req.headers[name] = value;
                  }
                });
              }
            },
          );

          return req;
        }}
      />
    </Box>
  );
};
