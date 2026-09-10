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

import { useState, useEffect } from 'react';
/* eslint-disable no-nested-ternary */
import * as yaml from 'js-yaml';
import Editor from '@monaco-editor/react';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import Tooltip from '@material-ui/core/Tooltip';
import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import CircularProgress from '@material-ui/core/CircularProgress';
import GetAppIcon from '@material-ui/icons/GetApp';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import EditIcon from '@material-ui/icons/Edit';
import SaveIcon from '@material-ui/icons/Save';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import CloseIcon from '@material-ui/icons/Close';
import { useStyles } from './styles';
import { DefinitionDiffSummary } from './DefinitionDiffSummary';
import { Wso2RestApiArtifactDiff } from '../../../api/types';

export interface ApiDefinitionViewerProps {
  value: string;
  language?: string;
  onUpdateClick?: () => void;
  onSaveClick?: (content: string) => Promise<void> | void;
  onPreviewDiff?: (
    content: string,
  ) => Promise<Wso2RestApiArtifactDiff | null | undefined>;
  /** Disables definition editing actions. */
  disabled?: boolean;
  disabledReason?: string;
}

const editorActionButtonStyle = {
  color: '#d4d4d4',
  borderColor: '#555',
  textTransform: 'none' as const,
};

export const ApiDefinitionViewer = ({
  value,
  language,
  onUpdateClick,
  onSaveClick,
  onPreviewDiff,
  disabled,
  disabledReason,
}: ApiDefinitionViewerProps) => {
  const classes = useStyles();

  const [displayFormat, setDisplayFormat] = useState<'YAML' | 'JSON'>('YAML');
  const [localValue, setLocalValue] = useState<string>(value);
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [diffResult, setDiffResult] = useState<
    Wso2RestApiArtifactDiff | null | undefined
  >(undefined);

  // Detect if the original value looks like XML
  const isXml = language === 'xml' || value?.trimStart().startsWith('<');
  const isGraphql = language === 'graphql';

  // Parse and format the value whenever `value` or `displayFormat` changes.
  useEffect(() => {
    if (!value?.trim()) {
      setLocalValue('');
      return;
    }
    if (isXml || isGraphql) {
      setLocalValue(value);
      return;
    }
    try {
      // yaml.load works for both JSON and YAML strings
      const parsed = yaml.load(value);
      if (displayFormat === 'JSON') {
        setLocalValue(JSON.stringify(parsed, null, 2));
      } else {
        setLocalValue(yaml.dump(parsed));
      }
    } catch (e) {
      // If it fails to parse, fallback to the raw value
      setLocalValue(value);
    }
  }, [value, displayFormat, isXml, isGraphql]);

  const handleFormatToggle = () => {
    setDisplayFormat(prev => (prev === 'YAML' ? 'JSON' : 'YAML'));
  };

  // Detect if the CURRENT localValue looks like YAML, JSON, or XML
  let lang = 'YAML';
  if (isXml) {
    lang = 'XML';
  } else if (isGraphql) {
    lang = 'GRAPHQL';
  } else if (localValue.trimStart().startsWith('{')) {
    lang = 'JSON';
  }

  const handleDownload = () => {
    const ext = lang === 'GRAPHQL' ? 'graphql' : lang.toLowerCase();
    const blob = new Blob([localValue], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `source-definition.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEditToggle = async () => {
    if (!isEditing) {
      setEditedValue(localValue);
      setIsEditing(true);
      return;
    }

    if (onPreviewDiff) {
      setPreviewLoading(true);
      try {
        setDiffResult(await onPreviewDiff(editedValue));
      } catch (e) {
        // Save re-runs the same check and will surface any real error.
        setDiffResult(undefined);
      } finally {
        setPreviewLoading(false);
      }
    }
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    try {
      await onSaveClick?.(editedValue);
      setLocalValue(editedValue);
      setIsEditing(false);
      setConfirmOpen(false);
      setDiffResult(undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedValue(localValue);
    setIsEditing(false);
    setDiffResult(undefined);
  };

  return (
    <div className={classes.editorContainer}>
      {/* VS Code-style title bar */}
      <div className={classes.editorHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Typography className={classes.editorLang}>
            definition.{lang.toLowerCase()}
          </Typography>
        </div>
        <div className={classes.editorActions}>
          {/* Format Toggle button (hidden for XML and GraphQL) */}
          {!isEditing && !isXml && !isGraphql && (
            <Tooltip
              title={`Convert to ${displayFormat === 'YAML' ? 'JSON' : 'YAML'}`}
            >
              <Button
                id="swagger-format-btn"
                size="small"
                variant="outlined"
                startIcon={<AutorenewIcon />}
                onClick={handleFormatToggle}
                style={editorActionButtonStyle}
              >
                Convert to {displayFormat === 'YAML' ? 'JSON' : 'YAML'}
              </Button>
            </Tooltip>
          )}

          {/* Download button */}
          {!isEditing && (
            <Tooltip title="Download definition">
              <Button
                id="swagger-download-btn"
                size="small"
                variant="outlined"
                startIcon={<GetAppIcon />}
                onClick={handleDownload}
                style={editorActionButtonStyle}
              >
                Download
              </Button>
            </Tooltip>
          )}

          {!isEditing && onUpdateClick && (
            <Tooltip
              title={disabled ? disabledReason ?? '' : 'Upload definition'}
            >
              <span>
                <Button
                  id="swagger-update-btn"
                  size="small"
                  variant="outlined"
                  startIcon={<CloudUploadIcon />}
                  onClick={onUpdateClick}
                  disabled={disabled}
                  style={editorActionButtonStyle}
                >
                  Upload
                </Button>
              </span>
            </Tooltip>
          )}

          {isEditing && (
            <Tooltip title="Cancel editing">
              <Button
                id="swagger-cancel-edit-btn"
                size="small"
                variant="outlined"
                startIcon={<CloseIcon />}
                onClick={handleCancelEdit}
                disabled={saving}
                style={editorActionButtonStyle}
              >
                Cancel
              </Button>
            </Tooltip>
          )}

          {onSaveClick && (
            <Tooltip
              title={
                disabled
                  ? disabledReason ?? ''
                  : isEditing
                  ? 'Save definition'
                  : 'Edit definition'
              }
            >
              <span>
                <Button
                  id="swagger-edit-toggle-btn"
                  size="small"
                  variant="outlined"
                  startIcon={
                    previewLoading ? (
                      <CircularProgress size={14} />
                    ) : isEditing ? (
                      <SaveIcon />
                    ) : (
                      <EditIcon />
                    )
                  }
                  onClick={handleEditToggle}
                  disabled={previewLoading || disabled}
                  style={editorActionButtonStyle}
                >
                  {isEditing ? 'Save' : 'Edit'}
                </Button>
              </span>
            </Tooltip>
          )}
        </div>
      </div>

      {/* The editor itself */}
      <div
        style={{
          height: Math.max(
            400,
            Math.min(800, (localValue || '').split('\n').length * 19 + 40),
          ),
        }}
      >
        <Editor
          language={lang.toLowerCase()}
          theme="vs-dark"
          value={isEditing ? editedValue : localValue}
          onChange={val => {
            if (isEditing) {
              setEditedValue(val ?? '');
            }
          }}
          options={{
            readOnly: !isEditing,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            wordWrap: 'on',
            padding: { top: 16, bottom: 16 },
          }}
        />
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Save Definition</DialogTitle>
        <DialogContent>
          {onPreviewDiff ? (
            <>
              <DefinitionDiffSummary diff={diffResult} />
              <DialogContentText>
                Are you sure you want to save these changes?
              </DialogContentText>
            </>
          ) : (
            <DialogContentText>
              Are you sure you want to save the changes made to this definition?
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConfirmSave}
            disabled={saving || diffResult?.hasChanges === false}
          >
            {saving ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bottom status bar like VS Code */}
      <Box
        style={{
          backgroundColor: '#007acc',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          padding: '2px 12px',
          fontSize: 11,
        }}
      >
        <span>
          {lang} | {(localValue || '').split('\n').length} lines
        </span>
      </Box>
    </div>
  );
};
