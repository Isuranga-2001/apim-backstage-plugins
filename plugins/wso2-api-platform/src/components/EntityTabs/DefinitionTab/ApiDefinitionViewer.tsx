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
import ToggleButton from '@material-ui/lab/ToggleButton';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import GetAppIcon from '@material-ui/icons/GetApp';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import EditIcon from '@material-ui/icons/Edit';
import SaveIcon from '@material-ui/icons/Save';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import DeleteIcon from '@material-ui/icons/Delete';
import CloseIcon from '@material-ui/icons/Close';
import Brightness4Icon from '@material-ui/icons/Brightness4';
import Brightness7Icon from '@material-ui/icons/Brightness7';
import { useStyles } from './styles';
import { DefinitionDiffSummary } from './DefinitionDiffSummary';
import { SwaggerDefinitionPreview } from './SwaggerDefinitionPreview';
import { Wso2RestApiArtifactDiff } from '../../../api/types';

export interface ApiDefinitionViewerProps {
  value: string;
  language?: string;
  onUpdateClick?: () => void;
  onSaveClick?: (content: string) => Promise<void> | void;
  onPreviewDiff?: (
    content: string,
  ) => Promise<Wso2RestApiArtifactDiff | null | undefined>;
  onDeleteClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  showSavingWaitDialog?: boolean;
}

/** Every toolbar button (regular and toggle) shares this height so they line up. */
const TOOLBAR_BUTTON_HEIGHT = 30;

type EditorChromeTheme = {
  containerBg: string;
  containerBorder: string;
  headerBg: string;
  headerBorder: string;
  langColor: string;
  statusBg: string;
  statusColor: string;
  buttonColor: string;
  buttonBorder: string;
  activeButtonColor: string;
  activeButtonBorder: string;
  activeButtonBg: string;
};

const EDITOR_CHROME_THEMES: Record<'vs-dark' | 'vs', EditorChromeTheme> = {
  'vs-dark': {
    containerBg: '#1e1e1e',
    containerBorder: '1px solid #3c3c3c',
    headerBg: '#2d2d2d',
    headerBorder: '1px solid #3c3c3c',
    langColor: '#9d9d9d',
    statusBg: '#007acc',
    statusColor: '#fff',
    buttonColor: '#d4d4d4',
    buttonBorder: '#555',
    activeButtonColor: '#4dc3f7',
    activeButtonBorder: '#0e639c',
    activeButtonBg: '#0e639c33',
  },
  vs: {
    containerBg: '#ffffff',
    containerBorder: '1px solid #d4d4d4',
    headerBg: '#f3f3f3',
    headerBorder: '1px solid #d4d4d4',
    langColor: '#616161',
    statusBg: '#2c6fbb',
    statusColor: '#fff',
    buttonColor: '#3c3c3c',
    buttonBorder: '#bbb',
    activeButtonColor: '#0e639c',
    activeButtonBorder: '#0e639c',
    activeButtonBg: '#0e639c1a',
  },
};

const actionButtonStyle = (chrome: EditorChromeTheme) => ({
  color: chrome.buttonColor,
  borderColor: chrome.buttonBorder,
  textTransform: 'none' as const,
  height: TOOLBAR_BUTTON_HEIGHT,
});

const themeToggleButtonStyle = (
  chrome: EditorChromeTheme,
  active: boolean,
) => ({
  color: active ? chrome.activeButtonColor : chrome.buttonColor,
  borderColor: active ? chrome.activeButtonBorder : chrome.buttonBorder,
  backgroundColor: active ? chrome.activeButtonBg : 'transparent',
  height: TOOLBAR_BUTTON_HEIGHT,
  padding: '0 8px',
});

export const ApiDefinitionViewer = ({
  value,
  language,
  onUpdateClick,
  onSaveClick,
  onPreviewDiff,
  onDeleteClick,
  disabled,
  disabledReason,
  showSavingWaitDialog = true,
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
  const [swaggerPreviewError, setSwaggerPreviewError] = useState(false);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'vs'>('vs-dark');
  const chrome = EDITOR_CHROME_THEMES[editorTheme];

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

  const editorHeight = Math.max(
    400,
    Math.min(
      800,
      ((isEditing ? editedValue : localValue) || '').split('\n').length * 19 +
        40,
    ),
  );

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

  const handleConfirmSave = async () => {
    setSaving(true);
    try {
      await onSaveClick?.(editedValue);
      setLocalValue(editedValue);
      setIsEditing(false);
      setDiffResult(undefined);
      if (!showSavingWaitDialog) {
        setConfirmOpen(false);
        setSaving(false);
      }
    } catch (e) {
      setSaving(false);
    }
  };

  const handleEditToggle = async () => {
    if (!isEditing) {
      setEditedValue(localValue);
      setSwaggerPreviewError(false);
      setIsEditing(true);
      return;
    }

    let diff: Wso2RestApiArtifactDiff | null | undefined;
    if (onPreviewDiff) {
      setPreviewLoading(true);
      try {
        diff = await onPreviewDiff(editedValue);
      } catch (e) {
        diff = undefined;
      } finally {
        setPreviewLoading(false);
      }
    }
    setDiffResult(diff);

    if (diff?.hasChanges) {
      setConfirmOpen(true);
      return;
    }

    if (showSavingWaitDialog) {
      setConfirmOpen(true);
    }
    await handleConfirmSave();
  };

  const handleCancelEdit = () => {
    setEditedValue(localValue);
    setIsEditing(false);
    setDiffResult(undefined);
    setSwaggerPreviewError(false);
  };

  return (
    <div
      className={classes.editorContainer}
      style={{
        backgroundColor: chrome.containerBg,
        border: chrome.containerBorder,
      }}
    >
      {/* VS Code-style title bar */}
      <div
        className={classes.editorHeader}
        style={{
          backgroundColor: chrome.headerBg,
          borderBottom: chrome.headerBorder,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Typography
            className={classes.editorLang}
            style={{ color: chrome.langColor }}
          >
            definition.{lang.toLowerCase()}
          </Typography>
        </div>
        <div className={classes.editorActions}>
          {onSaveClick && (
            <Tooltip
              title={
                disabled
                  ? disabledReason ?? ''
                  : isEditing && swaggerPreviewError
                  ? 'Fix the errors shown in the Swagger preview before saving'
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
                  disabled={previewLoading || disabled || swaggerPreviewError}
                  style={actionButtonStyle(chrome)}
                >
                  {isEditing ? 'Save' : 'Edit'}
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
                style={actionButtonStyle(chrome)}
              >
                Cancel
              </Button>
            </Tooltip>
          )}

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
                style={actionButtonStyle(chrome)}
              >
                Convert to {displayFormat === 'YAML' ? 'JSON' : 'YAML'}
              </Button>
            </Tooltip>
          )}

          {/* Download button */}
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
                  style={actionButtonStyle(chrome)}
                >
                  Upload
                </Button>
              </span>
            </Tooltip>
          )}

          {!isEditing && (
            <Tooltip title="Download definition">
              <Button
                id="swagger-download-btn"
                size="small"
                variant="outlined"
                startIcon={<GetAppIcon />}
                onClick={handleDownload}
                style={actionButtonStyle(chrome)}
              >
                Download
              </Button>
            </Tooltip>
          )}

          {!isEditing && onDeleteClick && (
            <Tooltip
              title={disabled ? disabledReason ?? '' : 'Delete definition'}
            >
              <span>
                <Button
                  id="swagger-delete-btn"
                  size="small"
                  variant="outlined"
                  startIcon={<DeleteIcon />}
                  onClick={onDeleteClick}
                  disabled={disabled}
                  style={actionButtonStyle(chrome)}
                >
                  Delete
                </Button>
              </span>
            </Tooltip>
          )}

          {/* Editor color theme toggle — always visible, independent of the action buttons above */}
          <ToggleButtonGroup
            size="small"
            exclusive
            value={editorTheme}
            onChange={(_, next) => {
              if (next) {
                setEditorTheme(next);
              }
            }}
            style={{ marginLeft: 4 }}
          >
            <Tooltip title="Dark theme">
              <ToggleButton
                id="swagger-theme-dark-btn"
                value="vs-dark"
                aria-label="Dark theme"
                style={themeToggleButtonStyle(
                  chrome,
                  editorTheme === 'vs-dark',
                )}
              >
                <Brightness4Icon fontSize="small" />
              </ToggleButton>
            </Tooltip>
            <Tooltip title="Light theme">
              <ToggleButton
                id="swagger-theme-light-btn"
                value="vs"
                aria-label="Light theme"
                style={themeToggleButtonStyle(chrome, editorTheme === 'vs')}
              >
                <Brightness7Icon fontSize="small" />
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        </div>
      </div>

      {/* The editor itself, with a live Swagger preview alongside it while editing */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 400px', minWidth: 0, height: editorHeight }}>
          <Editor
            language={lang.toLowerCase()}
            theme={editorTheme}
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
        {isEditing && !isXml && !isGraphql && (
          <div style={{ flex: '1 1 400px', minWidth: 0 }}>
            <SwaggerDefinitionPreview
              content={editedValue}
              height={editorHeight}
              onValidityChange={setSwaggerPreviewError}
            />
          </div>
        )}
      </div>

      <Dialog
        open={confirmOpen}
        onClose={saving ? undefined : () => setConfirmOpen(false)}
        disableEscapeKeyDown={saving}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {saving && showSavingWaitDialog
            ? 'Applying Changes'
            : 'Save Definition'}
        </DialogTitle>
        <DialogContent>
          {saving && showSavingWaitDialog ? (
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
          ) : onPreviewDiff ? (
            <>
              <DefinitionDiffSummary
                diff={diffResult}
                pushesToGateway={showSavingWaitDialog}
              />
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
        {!(saving && showSavingWaitDialog) && (
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
              Save
            </Button>
          </DialogActions>
        )}
      </Dialog>

      {/* Bottom status bar like VS Code */}
      <Box
        style={{
          backgroundColor: chrome.statusBg,
          color: chrome.statusColor,
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
