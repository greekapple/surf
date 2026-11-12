// srf-compare: a parser for NWS Surf Zone Forecast (SRF) products as api.weather.gov serves them ({id, issuingOffice, issuanceTime, productText}).
// It pulls, per zone and per period, every "Surf Height" range exactly as written (with the facing label when the product splits by facing, the "becoming ..." remainder and "sets to" as text),
// the rip current lines and every other keyed line (raw text). It never fills, guesses or converts: a surf line it cannot read is returned with kind 'text' and no numbers, a period whose date cannot be
// read from its label has date null, an "N feet or less" has no lower bound, "around N feet" is lo = hi = N with kind 'around'. Units are feet as the product says them.
// Nothing here is shown in the app; it feeds the comparison scripts (scripts/srf-compare.mjs).

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = {Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12};
const pad = (n) => String(n).padStart(2, '0');
const addDays = (key, n) => new Date(Date.parse(key + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const weekdayOf = (key) => new Date(Date.parse(key + 'T00:00:00Z')).getUTCDay();

/** UGC codes of a header ("HIZ003-029>031-120245-" or "GUZ001-MPZ001>003-110915-") -> {zones: ['HIZ003', 'HIZ029', 'HIZ030', 'HIZ031'], expires: 'DDHHMM'}. A bare number token takes the last prefix. */
export function expandUgc(header) {
  const toks = header.replace(/\s+/g, '').split('-').filter(Boolean), zones = []; let prefix = null, expires = null;
  for (const t of toks) {
    if (/^\d{6}$/.test(t)) { expires = t; continue; }
    let m = /^([A-Z]{2}[ZC])(\d{3})(?:>(\d{3}))?$/.exec(t);
    if (m) { prefix = m[1]; } else if ((m = /^(\d{3})(?:>(\d{3}))?$/.exec(t)) && prefix) { m = [t, prefix, m[1], m[2]]; } else continue;
    const a = +m[2], b = m[3] ? +m[3] : a; for (let n = a; n <= b; n++) zones.push(`${m[1]}${String(n).padStart(3, '0')}`);
  }
  return {zones, expires};
}
const COMPASS = /\b(northeast|northwest|southeast|southwest|north|south|east|west)\b/i;
export const facingOf = (label) => { const m = COMPASS.exec(label ?? ''); return m ? m[1].toLowerCase() : null; };
export const COMPASS_DEG = {north: 0, northeast: 45, east: 90, southeast: 135, south: 180, southwest: 225, west: 270, northwest: 315};
const FT = '(?:feet|foot|ft)\\b';
const NUM = '(\\d+(?:\\.\\d+)?)';
/** One range text -> {lo, hi, kind} or null. kind: range | around | or_less | single. */
export function parseRange(text) {
  const t = String(text).trim();
  let m = new RegExp(`${NUM}\\s*(?:to|-)\\s*${NUM}\\s*${FT}`, 'i').exec(t); if (m) return {lo: +m[1], hi: +m[2], kind: 'range'};
  m = new RegExp(`${NUM}\\s*${FT}\\s+or\\s+less`, 'i').exec(t); if (m) return {lo: null, hi: +m[1], kind: 'or_less'};
  m = new RegExp(`around\\s+${NUM}\\s*${FT}`, 'i').exec(t); if (m) return {lo: +m[1], hi: +m[1], kind: 'around'};
  m = new RegExp(`^${NUM}\\s*${FT}\\.?$`, 'i').exec(t); if (m) return {lo: +m[1], hi: +m[1], kind: 'single'};
  return null;
}
const CHANGE = /,?\s*(?:becoming|increasing to|decreasing to|subsiding to|rising to|building to|falling to|diminishing to)\s/i;
/** The text of a "Surf Height" value (one line or several joined) -> entries [{label, facing, lo, hi, kind, raw, then, sets}]. A facing split ("Northwest Facing Beaches - 7 to 11 feet.") gives one entry per label. */
export function parseSurfValue(value, label = null) {
  const text = String(value).replace(/\s+/g, ' ').trim(); if (!text) return [];
  const sentences = text.split(/(?<=[a-z])\.\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean), out = [];
  for (const s of sentences) {
    const so = /^sets?\s+(?:to|up to)\s+(\d+(?:\.\d+)?)\s*(?:feet|foot|ft)\.?$/i.exec(s); if (so && out.length) { out[out.length - 1].sets = +so[1]; out[out.length - 1].raw += ' ' + s; continue; }
    const lm = /^(.{2,60}?)\s+-\s+(.+)$/.exec(s), lab = lm && /facing|coast|reef|shore|beach/i.test(lm[1]) ? lm[1].trim() : label, body = lm && lab === lm[1].trim() ? lm[2] : s;
    const parts = body.split(CHANGE), first = parts[0].trim().replace(/\.$/, ''), rest = parts.length > 1 ? body.slice(first.length).replace(/^[,\s]+/, '').trim() : null;
    const sets = /\bsets?\s+(?:to|up to)\s+(\d+(?:\.\d+)?)/i.exec(body), core = first.replace(/\.?\s*sets?\s+(?:to|up to).*$/i, '').trim(), r = parseRange(core) ?? parseRange(core + ' ');
    out.push({label: lab ?? null, facing: facingOf(lab), lo: r?.lo ?? null, hi: r?.hi ?? null, kind: r?.kind ?? 'text', raw: s, then: rest, sets: sets ? +sets[1] : null});
  }
  return out;
}
/** A period label -> {date (local YYYY-MM-DD) or null, part: 'day' | 'night' | null}. issueDate is the zone block's own local issue date. A weekday is the first such day AFTER the issue date; a label that names neither (a holiday) has no date. */
export function periodWhen(label, issueDate) {
  const L = label.toUpperCase().trim();
  if (/^(TODAY|REST OF TODAY|THIS AFTERNOON|THIS MORNING)$/.test(L)) return {date: issueDate, part: 'day'};
  if (/^(TONIGHT|THIS EVENING|REST OF TONIGHT)$/.test(L)) return {date: issueDate, part: 'night'};
  const m = /^(SUNDAY|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY)( NIGHT)?$/.exec(L);
  if (m && issueDate) { const want = WEEKDAYS.indexOf(m[1]); let d = addDays(issueDate, 1); while (weekdayOf(d) !== want) d = addDays(d, 1); return {date: d, part: m[2] ? 'night' : 'day'}; }
  return {date: null, part: null};
}

const UGC_START = /^[A-Z]{2}[ZC]\d{3}(?:>\d{3})?(?:-|$)/;
const TIME_LINE = /^\s*(\d{3,4})\s+(AM|PM)\s+(\w+)\s+(\w{3})\s+(\w{3})\s+(\d{1,2})\s+(\d{4})\s*$/;
const PERIOD = /^\.([A-Z][A-Z0-9 '\/]*?)\.\.\.(.*)$/;
const KEY = /^([A-Za-z][A-Za-z \/()*]*?)\.{2,}\s*(.*?)\s*$/;
const SUB = /^\s+(.+?)\.{2,}\s*(.*?)\s*$/;
const BARE_KEY = /^([A-Z][A-Za-z\/ ]{2,30})\s*$/;

/** A period body (lines after `.LABEL...`) -> {surf: entries, rip, other}. */
function parseBody(lines, label, inline) {
  const surf = [], other = {}; let rip = null, cur = null;
  const note = (key, sub, value) => {
    if (!sub && !value) return;   // a key line that only introduces indented sub-lines holds nothing itself
    if (/^surf( height)?$/i.test(key)) { surf.push(...parseSurfValue(value, sub)); return; }
    if (/^tides$/i.test(key)) return;
    const k = key.replace(/\*+$/, '').trim();
    if (/rip current/i.test(k)) rip = {...(rip ?? {}), [sub ?? 'all']: value};
    (other[k] ??= []).push(sub ? {label: sub, value} : {value});
  };
  if (inline) {
    const joined = [inline, ...lines].join(' ').replace(/\s+/g, ' '), m = /\bsurf height\s+(.*?)\.(?:\s|$)/i.exec(joined);
    if (m) surf.push(...parseSurfValue(m[1].replace(/\.$/, '') + '.', null).map((e) => (e.kind === 'text' ? e : e)));
    const rm = /\brip current risk\s+(.*?)\.(?:\s|$)/i.exec(joined); if (rm) rip = {all: rm[1]};
    return {surf, rip, other};
  }
  const flush = () => { if (cur) { note(cur.key, cur.sub, cur.value.replace(/\s+/g, ' ').trim()); cur = null; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]; if (!line.trim()) { flush(); continue; }
    const indented = /^\s{2,}/.test(line);
    if (!indented) {
      flush(); let m = KEY.exec(line);
      if (m) { cur = {key: m[1].trim(), sub: null, value: m[2]}; continue; }
      m = BARE_KEY.exec(line); if (m && /^\s{2,}\S/.test(lines[i + 1] ?? '')) { cur = {key: m[1].trim(), sub: null, value: '', bare: true}; }
      continue;
    }
    if (!cur) continue;
    const s = SUB.exec(line);
    if (s && (cur.bare || !cur.value || cur.subs)) { const key = cur.key, bare = cur.bare; flush(); cur = {key, sub: s[1].trim(), value: s[2], subs: true, bare}; continue; }
    if (cur) cur.value += ' ' + line.trim();
  }
  flush();
  return {surf, rip, other};
}

/** The Hawaii (HFO) facing table: rows "North Facing   6-8   8-12   14-18  15-20" under two header lines (period names, then PM/AM halves). Read only when the number of values equals the number of half columns. */
function parseHfoTable(lines) {
  const hi = lines.findIndex((l) => /^\s*Shores\s+Surf/i.test(l)); if (hi < 1) return {periods: [], note: null};
  let ni = hi - 1; while (ni >= 0 && (!lines[ni].trim() || /^_+$/.test(lines[ni].trim()))) ni--; if (ni < 0) return {periods: [], note: 'table header not understood'};
  const names = lines[ni].trim().split(/\s{2,}/).filter(Boolean), halves = (lines[hi + 1] ?? '').trim().split(/\s+/).filter((h) => /^(AM|PM)$/.test(h));
  if (!names.length || halves.length < names.length || halves.length % names.length) return {periods: [], note: 'table header not understood'};
  const per = halves.length / names.length, cols = halves.map((h, i) => ({period: names[Math.floor(i / per)], half: h}));
  const rows = [];
  for (const l of lines.slice(hi + 2)) { const m = /^\s*((?:North|South|East|West)\w* Facing)\s+(.*)$/.exec(l); if (!m) { if (rows.length) break; else continue; } const vals = m[2].trim().split(/\s+/); rows.push({label: m[1], vals}); }
  if (!rows.length || rows.some((r) => r.vals.length !== cols.length)) return {periods: [], note: 'table rows do not match the columns'};
  return {periods: cols.map((c, i) => ({label: c.period, half: c.half, surf: rows.map((r) => { const rg = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(r.vals[i]); return {label: r.label, facing: facingOf(r.label), lo: rg ? +rg[1] : null, hi: rg ? +rg[2] : null, kind: rg ? 'range' : 'text', raw: r.vals[i], then: null, sets: null}; })})), note: null};
}

/** A whole product -> {id, office, issuedAt, zones: [{ugc, expires, name, issued: {date, time, tz, weekday}, alerts, periods: [{label, date, part, half?, surf, rip, other}]}], notes}. */
export function parseSrf(prod) {
  const text = String(prod?.productText ?? '').replace(/\r/g, ''), lines = text.split('\n'), zones = [], notes = [];
  const starts = []; lines.forEach((l, i) => { if (UGC_START.test(l.trim()) && l === l.trimStart()) starts.push(i); });
  starts.forEach((s, bi) => {
    const end = Math.min(starts[bi + 1] ?? lines.length, (() => { const d = lines.findIndex((l, i) => i > s && l.trim() === '$$'); return d < 0 ? lines.length : d; })());
    let i = s, head = ''; while (i < end) { head += lines[i].trim(); i++; if (/-\d{6}-?$/.test(head)) break; }
    const {zones: ugc, expires} = expandUgc(head); let name = [], issued = null; const alerts = [];
    for (; i < end; i++) {
      const l = lines[i], t = TIME_LINE.exec(l);
      if (t) { const mo = MONTHS[t[5]]; issued = {date: mo ? `${t[7]}-${pad(mo)}-${pad(+t[6])}` : null, time: `${t[1]} ${t[2]}`, tz: t[3], weekday: t[4]}; i++; break; }
      if (l.trim()) name.push(l.trim().replace(/-$/, ''));
    }
    const rest = lines.slice(i, end);
    for (const l of rest) { const m = /^\.\.\.(.+?)\.\.\.$/.exec(l.trim()); if (m && !PERIOD.test(l)) alerts.push(m[1]); }
    const periods = []; const idx = []; rest.forEach((l, k) => { const m = PERIOD.exec(l); if (m) idx.push({k, label: m[1].trim(), inline: m[2].trim()}); });
    idx.forEach((p, n) => { const body = rest.slice(p.k + 1, idx[n + 1]?.k ?? rest.length).filter((l) => l.trim() !== '&&' && !/^Rip Current Risk Category/i.test(l)), when = periodWhen(p.label, issued?.date ?? null), b = parseBody(body, p.label, p.inline || null); periods.push({label: p.label, ...when, ...b}); });
    const hfo = parseHfoTable(rest);
    for (const hp of hfo.periods) { const when = periodWhen(hp.label, issued?.date ?? null); periods.push({label: `${hp.label.toUpperCase()} ${hp.half}`, date: when.date, part: when.part ? `${when.part}-${hp.half.toLowerCase()}` : null, surf: hp.surf, rip: null, other: {}}); }
    if (hfo.note) notes.push(`${ugc[0] ?? '?'}: ${hfo.note}`);
    zones.push({ugc, expires, name: name.join(' ').replace(/\s+/g, ' '), issued, alerts, periods});
  });
  if (!zones.length) notes.push('no zone blocks found');
  return {id: prod?.id ?? null, office: prod?.issuingOffice ?? null, issuedAt: prod?.issuanceTime ?? null, zones, notes};
}

export const MAX_FACING_DIFF = 45;
const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
/** Which of a period's entries describes a spot facing `bearing` (degrees, the direction the beach faces the sea)? {entry, diff} or {reason}. One unlabelled entry is zone-wide; several are matched by the nearest facing within
 *  MAX_FACING_DIFF degrees; a tie, a mismatch, no bearing or an unreadable/"or less" range gives a reason, never a guess. */
export function pickEntry(entries, bearing) {
  if (!entries.length || entries.every((e) => e.kind === 'text')) return {reason: 'their period has no readable surf height'};
  let used, diff = null;
  if (entries.length === 1 && !entries[0].facing) used = entries[0];
  else {
    if (!Number.isFinite(bearing)) return {reason: 'no seaward bearing for the spot'};
    const faced = entries.filter((e) => e.facing && e.facing in COMPASS_DEG).map((e) => ({e, d: angDiff(bearing, COMPASS_DEG[e.facing])})).sort((a, b) => a.d - b.d);
    if (!faced.length) return {reason: 'their entries name no facing'};
    if (faced.length > 1 && Math.abs(faced[0].d - faced[1].d) < 1) return {reason: 'two facings equally near the spot (ambiguous)'};
    if (faced[0].d > MAX_FACING_DIFF) return {reason: `spot faces more than ${MAX_FACING_DIFF} degrees from every facing they list`};
    used = faced[0].e; diff = faced[0].d;
  }
  if (used.kind === 'text') return {reason: 'their text for the nearest facing is not a number'};
  if (used.kind === 'or_less') return {reason: 'their range is "or less" (no lower bound)'};
  if (!Number.isFinite(used.lo) || !Number.isFinite(used.hi)) return {reason: 'their range has no numbers'};
  return {entry: used, diff};
}
