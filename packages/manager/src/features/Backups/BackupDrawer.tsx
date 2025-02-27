import { Linode, LinodeType } from '@linode/api-v4/lib/linodes';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import { isEmpty, path, pathOr } from 'ramda';
import * as React from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { compose } from 'recompose';
import ActionsPanel from 'src/components/ActionsPanel';
import Button from 'src/components/Button';
import Typography from 'src/components/core/Typography';
import DisplayPrice from 'src/components/DisplayPrice';
import Drawer from 'src/components/Drawer';
import Grid from 'src/components/Grid';
import Link from 'src/components/Link';
import Notice from 'src/components/Notice';
import { accountBackupsEnabled } from 'src/queries/accountSettings';
import { ApplicationState } from 'src/store';
import {
  BackupError,
  enableAllBackups,
  enableAutoEnroll,
  handleAutoEnrollToggle,
  handleClose,
  handleResetError,
  handleResetSuccess,
} from 'src/store/backupDrawer';
import { getLinodesWithoutBackups } from 'src/store/selectors/getLinodesWithBackups';
import { ThunkDispatch } from 'src/store/types';
import { getTypeInfo } from 'src/utilities/typesHelpers';
import AutoEnroll from './AutoEnroll';
import BackupsTable from './BackupsTable';
import { ExtendedLinode, LinodeWithTypeInfo } from './types';

interface DispatchProps {
  actions: {
    enable: () => void;
    enroll: () => void;
    close: () => void;
    dismissError: () => void;
    dismissSuccess: () => void;
    toggle: () => void;
  };
}

interface StateProps {
  accountBackups: boolean;
  open: boolean;
  loading: boolean;
  enabling: boolean;
  backupLoadError: string;
  linodesWithoutBackups: ExtendedLinode[];
  backupsLoading: boolean;
  enableSuccess: boolean;
  enableErrors?: BackupError[];
  autoEnroll: boolean;
  autoEnrollError?: string;
  enrolling: boolean;
  updatedCount: number;
}

type CombinedProps = DispatchProps &
  StateProps &
  WithTypesProps &
  WithSnackbarProps;

const getFailureNotificationText = (
  success: number,
  failed: number
): string => {
  if (success > 0) {
    const pluralizedSuccess = success > 1 ? 'Linodes' : 'Linode';
    const pluralizedFailure = failed > 1 ? 'Linodes' : 'Linode';
    return `Enabled backups successfully for ${success} ${pluralizedSuccess}
    , but ${failed} ${pluralizedFailure} failed.`;
  }
  // This function will only be called if at least one backup failed.
  else {
    return `There was an error enabling backups for your Linodes.`;
  }
};

export const getTotalPrice = (linodes: ExtendedLinode[]) => {
  return linodes.reduce((prevValue: number, linode: ExtendedLinode) => {
    return (
      prevValue +
      pathOr(0, ['typeInfo', 'addons', 'backups', 'price', 'monthly'], linode)
    );
  }, 0);
};
export class BackupDrawer extends React.Component<CombinedProps, {}> {
  componentDidUpdate() {
    const { close, dismissSuccess } = this.props.actions;
    const { autoEnroll, enableSuccess, updatedCount } = this.props;
    if (enableSuccess) {
      const pluralizedLinodes =
        updatedCount > 1 ? 'Linodes have' : 'Linode has';
      const text = autoEnroll
        ? `${updatedCount} ${pluralizedLinodes} been enrolled in automatic backups, and
        all new Linodes will automatically be backed up.`
        : `${updatedCount} ${pluralizedLinodes} been enrolled in automatic backups.`;
      this.props.enqueueSnackbar(text, {
        variant: 'success',
      });
      dismissSuccess();
      close();
    }
  }

  handleSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    const {
      actions: { enable, enroll },
      accountBackups,
    } = this.props;
    if (accountBackups) {
      enable();
    } else {
      enroll();
    }
  };

  render() {
    const {
      accountBackups,
      actions: { close, toggle },
      autoEnroll,
      autoEnrollError,
      enableErrors,
      enabling,
      enrolling,
      linodesWithoutBackups,
      loading,
      open,
      updatedCount,
    } = this.props;
    const linodeCount = linodesWithoutBackups.length;
    return (
      <Drawer title="Enable All Backups" open={open} onClose={close}>
        <Grid container direction={'column'}>
          <Grid item>
            <Typography variant="body1">
              Three backup slots are executed and rotated automatically: a daily
              backup, a 2-7 day old backup, and an 8-14 day old backup. See our
              {` `}
              <Link
                to={
                  'https://www.linode.com/docs/platform' +
                  '/disk-images/linode-backup-service/'
                }
              >
                guide on Backups
              </Link>{' '}
              for more information on features and limitations. Confirm to add
              backups to <strong data-qa-backup-count>{linodeCount}</strong>{' '}
              {linodeCount > 1 ? 'Linodes' : 'Linode'}.
            </Typography>
          </Grid>
          {enableErrors && !isEmpty(enableErrors) && (
            <Grid item data-testid={'result-notice'}>
              <Notice error spacingBottom={0}>
                {getFailureNotificationText(updatedCount, enableErrors.length)}
              </Notice>
            </Grid>
          )}
          {/* Don't show this if the setting is already active. */}
          {!accountBackups && (
            <Grid item>
              <AutoEnroll
                enabled={autoEnroll}
                error={autoEnrollError}
                toggle={toggle}
              />
            </Grid>
          )}
          <Grid item>
            <DisplayPrice
              price={getTotalPrice(linodesWithoutBackups)}
              interval="mo"
            />
          </Grid>
          <Grid item>
            <ActionsPanel style={{ padding: 0, margin: 0 }}>
              <Button
                onClick={this.handleSubmit}
                loading={loading || enabling || enrolling}
                buttonType="primary"
                data-qa-submit
                data-testid={'submit'}
              >
                Confirm
              </Button>
              <Button
                onClick={close}
                buttonType="secondary"
                className="cancel"
                data-qa-cancel
                data-testid={'cancel'}
              >
                Cancel
              </Button>
            </ActionsPanel>
          </Grid>
          <Grid item>
            <BackupsTable linodes={linodesWithoutBackups} loading={loading} />
          </Grid>
        </Grid>
      </Drawer>
    );
  }
}

const mapDispatchToProps: MapDispatchToProps<DispatchProps, {}> = (
  dispatch: ThunkDispatch,
  ownProps
) => {
  return {
    actions: {
      enable: () => dispatch(enableAllBackups()),
      close: () => dispatch(handleClose()),
      dismissError: () => dispatch(handleResetError()),
      dismissSuccess: () => dispatch(handleResetSuccess()),
      enroll: () => dispatch(enableAutoEnroll()),
      toggle: () => dispatch(handleAutoEnrollToggle()),
    },
  };
};

/* Attaches a full type object to each Linode. Needed to calculate
 * price and label information in BackupsTable.tsx.
 */
export const addTypeInfo = (types: LinodeType[], linodes: Linode[]) =>
  linodes.map((linode) => {
    const typeInfo = getTypeInfo(linode.type, types || []);
    return {
      ...linode,
      typeInfo,
    };
  });

/* Attaches an error object to each Linode */
export const addErrors = (
  errors: BackupError[],
  linodes: LinodeWithTypeInfo[]
) =>
  linodes.map((linode: LinodeWithTypeInfo) => {
    const linodeError = errors.find(
      (error) => Number(error.linodeId) === Number(linode.id)
    );
    return {
      ...linode,
      linodeError,
    };
  });

/* Add type and error info to each Linode, so that it's available when rendering each Linode later */
export const enhanceLinodes = (
  linodes: Linode[],
  errors: BackupError[],
  types: LinodeType[]
) => {
  const linodesWithTypes = addTypeInfo(types, linodes);
  return addErrors(errors, linodesWithTypes);
};

const mapStateToProps: MapStateToProps<
  StateProps,
  CombinedProps,
  ApplicationState
> = (state: ApplicationState, ownProps: CombinedProps) => {
  const enableErrors = pathOr([], ['backups', 'enableErrors'], state);
  const linodes = getLinodesWithoutBackups(state.__resources);
  return {
    accountBackups: accountBackupsEnabled,
    backupLoadError: pathOr('', ['backups', 'error'], state),
    backupsLoading: pathOr(false, ['backups', 'loading'], state),
    enableErrors,
    enableSuccess: pathOr(false, ['backups', 'enableSuccess'], state),
    updatedCount: pathOr<number>(0, ['backups', 'updatedCount'], state),
    open: pathOr(false, ['backups', 'open'], state),
    loading: pathOr(false, ['backups', 'loading'], state),
    enabling: pathOr(false, ['backups', 'enabling'], state),
    linodesWithoutBackups: enhanceLinodes(
      linodes,
      enableErrors,
      ownProps.typesData
    ),
    autoEnroll: pathOr(false, ['backups', 'autoEnroll'], state),
    enrolling: pathOr(false, ['backups', 'enrolling'], state),
    autoEnrollError: path(['backups', 'autoEnrollError'], state),
  };
};

const connected = connect(mapStateToProps, mapDispatchToProps);

interface WithTypesProps {
  typesData: LinodeType[];
}

const withTypes = connect((state: ApplicationState, ownProps) => ({
  typesData: state.__resources.types.entities,
}));

const enhanced = compose<CombinedProps, {}>(withTypes, connected, withSnackbar);

export default enhanced(BackupDrawer);
