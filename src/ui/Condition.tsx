import {bandOf, titleCase} from '../features/forecast/model';
import './condition.css';

export const conditionWord = (c: string) => (c === 'UNRATED' ? 'Unrated' : titleCase(c).charAt(0) + titleCase(c).slice(1).toLowerCase());

/** The one condition marker, same colours everywhere. Default: a dot and a word. `chip`: a filled pill (reference style).
 * `compact` keeps the word for screen readers only. */
export function Condition({category, compact, chip}: {category: string; compact?: boolean; chip?: boolean}) {
  const word = conditionWord(category);
  return <span className={`cond ${bandOf(category)}${chip ? ' chip-c' : ''}`}>{!chip && <i aria-hidden="true" />}{compact && !chip ? <span className="sr-only">{word}</span> : word}</span>;
}
