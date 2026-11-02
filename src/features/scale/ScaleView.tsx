import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {ScaleStage} from './ScaleStage';
import './scale.css';

/** Wave Scale page (T-052): the drawn, to-scale comparison. The size-band photo is an optional example inside it. */
export function ScaleView({go}: ViewProps) {
  const {spot} = useSwello();
  return (
    <div className="scale-page">
      <ScaleStage />
      <div><button className="btn primary" onClick={() => go('forecast')}>Back to {spot.name} forecast</button></div>
    </div>
  );
}
