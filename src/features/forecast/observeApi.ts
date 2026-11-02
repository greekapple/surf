/** T-060: the observation API the UI uses is engineering's (T-059, src/services/calibration.ts). This file is the seam the UI imports from. */
export * from '../../services/calibration';
export type {LogEnv as ObserveEnv} from '../../services/calibration';
export type Quality = 1 | 2 | 3 | 4 | 5;
