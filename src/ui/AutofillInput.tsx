import type {InputHTMLAttributes, KeyboardEvent} from 'react';

/** A search input with an inline completion (spec 2026-11-10-map-zoom-groups.md §6): the top match's remaining letters show in light grey after what was typed.
 *  Tab, or → with the caret at the end, accepts them (onAccept); every other key goes to the caller's onKeyDown. The grey text is a decoration: screen readers
 *  get the suggestion from the list (aria-activedescendant), not from the overlay. */
export function AutofillInput({value, completion, onAccept, onKeyDown, className, ...rest}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value'> & {value: string; completion: string; onAccept: () => void}) {
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    const atEnd = e.currentTarget.selectionStart === value.length && e.currentTarget.selectionEnd === value.length;
    if (completion && atEnd && ((e.key === 'Tab' && !e.shiftKey) || e.key === 'ArrowRight')) { e.preventDefault(); onAccept(); return; }   // only with the caret at the end: elsewhere Tab and → keep their usual jobs
    onKeyDown?.(e);
  };
  return (
    <span className={`acf${className ? ` ${className}` : ''}`}>
      <span className="acf-g" aria-hidden="true"><span className="acf-t">{value}</span><span className="acf-c">{completion}</span></span>
      <input {...rest} value={value} onKeyDown={key} aria-autocomplete="both" autoComplete="off" spellCheck={false} />
    </span>
  );
}
