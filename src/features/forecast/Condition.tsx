import {bandOf, titleCase} from './model';
import './condition.css';

export const conditionWord = (c: string) => (c === 'UNRATED' ? 'Unrated' : titleCase(c).charAt(0) + titleCase(c).slice(1).toLowerCase());

/** The one condition marker: a dot and a word, same colours everywhere. `compact` keeps the word for screen readers only. */
export function Condition({category, compact}: {category: string; compact?: boolean}) {
  const word = conditionWord(category);
  return <span className={`cond ${bandOf(category)}`}><i aria-hidden="true" />{compact ? <span className="sr-only">{word}</span> : word}</span>;
}

