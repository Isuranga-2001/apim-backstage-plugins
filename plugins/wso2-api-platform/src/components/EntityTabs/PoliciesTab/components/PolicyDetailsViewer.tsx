import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { useViewerStyles } from './styles';

export const humanize = (str: string): string => {
  if (!str) return '';
  let result = str.replace(/[-_]/g, ' ');
  result = result.replace(/([A-Z])/g, ' $1');
  return result
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export const Wso2PolicyDetailsViewer = ({
  parameters,
}: {
  parameters: any;
}) => {
  const classes = useViewerStyles();

  if (!parameters || Object.keys(parameters).length === 0) {
    return (
      <Box p={3} textAlign="center">
        <Typography variant="body2" color="textSecondary">
          No configuration parameters found for this policy.
        </Typography>
      </Box>
    );
  }

  return (
    <Box className={classes.root}>
      <Box component="pre" className={classes.codeBlock}>
        {JSON.stringify(parameters, null, 2)}
      </Box>
    </Box>
  );
};

export { humanize as getPolicyFriendlyName };
