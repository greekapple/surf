import {forwardRef} from 'react';
import type {DataStore} from '../hooks/useAppData';
import type {ForecastState} from '../hooks/useForecast';
import type {UserProfile} from '../models/index';
import {Icon} from '../ui/Icon';

function Choice<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: readonly {value: T; label: string}[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="choice">
      <legend>{legend}</legend>
      <div className="choice-row">
        {options.map(o => (
          <label key={o.value}>
            <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export const Settings = forwardRef<HTMLDialogElement, {data: DataStore; view: ForecastState}>(function Settings(
  {data, view},
  ref,
) {
  const p = data.state.profile;
  const close = () => (ref && 'current' in ref ? ref.current?.close() : undefined);
  return (
    <dialog className="sheet" ref={ref} aria-labelledby="settings-title" onClick={e => e.target === e.currentTarget && close()}>
      <div className="sheet-body">
        <div className="sheet-head">
          <h2 id="settings-title">Settings</h2>
          <button className="icon-btn" onClick={close} aria-label="Close settings">
            <Icon name="close" />
          </button>
        </div>
        <Choice
          legend="Data source"
          name="mode"
          value={view.dataMode}
          options={[
            {value: 'Retrieved', label: 'Live public data'},
            {value: 'Demonstration', label: 'Demonstration week'},
          ]}
          onChange={view.setDataMode}
        />
        <p className="sheet-note">
          Live data comes from Open-Meteo, NOAA and CDIP and is rated experimentally. Demonstration is a fixed,
          illustrative week (Oct 16–22) and is never mixed with live data.
        </p>
        <Choice
          legend="Wave height"
          name="scale"
          value={p.scale}
          options={[
            {value: 'Face height', label: 'Face height'},
            {value: 'Hawaiian', label: 'Hawaiian'},
          ]}
          onChange={scale => data.profile({scale: scale as UserProfile['scale']})}
        />
        <p className="sheet-note">Hawaiian is about half of breaking face height. Offshore, swell and tide heights are unaffected.</p>
        <Choice
          legend="Height units"
          name="height"
          value={p.heightUnit}
          options={[
            {value: 'ft', label: 'Feet'},
            {value: 'm', label: 'Metres'},
          ]}
          onChange={heightUnit => data.profile({heightUnit: heightUnit as UserProfile['heightUnit']})}
        />
        <Choice
          legend="Wind units"
          name="wind"
          value={p.windUnit}
          options={[
            {value: 'mph', label: 'mph'},
            {value: 'kn', label: 'knots'},
            {value: 'km/h', label: 'km/h'},
          ]}
          onChange={windUnit => data.profile({windUnit: windUnit as UserProfile['windUnit']})}
        />
        <button className="btn" onClick={data.exportData}>
          Export a backup of your boards and settings
        </button>
      </div>
    </dialog>
  );
});
