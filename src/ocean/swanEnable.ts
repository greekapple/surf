import {SWAN_POINTS} from './swanPointsSourced.ts';
import {registerSwanTable} from './swanTable.ts';
/** Importing this module loads the SWAN point table into the registry. To turn SWAN on: set SWAN_ENABLED = true in swanFlag.ts AND import this file once from the app entry (src/main.tsx) and the Worker entry (worker/index.mjs). A test fails if the flag
 *  and these two imports disagree, so one half cannot be done without the other. Nothing imports it today. */
registerSwanTable(SWAN_POINTS);
