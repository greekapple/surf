import {fmtIn} from '../../ocean/time';
import {activeZone} from '../../ocean/spotZone';
import {deleteObservation, observationsFor, type Observation} from '../forecast/observeApi';
import {sawWords, useObservations} from '../forecast/Observe';

const when = (iso: string) => fmtIn(activeZone(), {weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}).format(new Date(iso));

/** T-060: Personal › Surf journal › What you saw. Your observations from the spot page, newest first, each removable. */
export function SawList({spotName}: {spotName: (id: string) => string}) {
  useObservations(); // re-render on save, delete or another tab
  const all = [...observationsFor()].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
  return (
    <section className="saw" aria-labelledby="saw-h">
      <h2 id="saw-h">What you saw <span>{all.length} {all.length === 1 ? 'observation' : 'observations'}</span></h2>
      {all.length === 0 ? <p className="fine">Nothing yet. On a spot's forecast, “What did you see?” takes two taps.</p> : (
        <ul className="saw-l">{all.map((o: Observation) => (
          <li key={o.id}>
            <span className="saw-t"><b>{spotName(o.spotId)} · ~{sawWords(o.word)}</b><small>{when(o.observedAt)}{o.quality ? ` · quality ${o.quality} of 5` : ''}{o.paired === false ? ' · not paired with a forecast' : ''}</small></span>
            <button type="button" className="sp-link saw-del" aria-label={`Delete ${spotName(o.spotId)}, ~${sawWords(o.word)}, ${when(o.observedAt)}`} onClick={() => deleteObservation(o.id)}>Delete</button>
          </li>
        ))}</ul>
      )}
    </section>
  );
}
