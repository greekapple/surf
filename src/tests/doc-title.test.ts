import {test} from 'node:test';
import assert from 'node:assert/strict';
import {docTitle} from '../app/titles.ts';

test('audit R20: every route has its own document title, with no em dash', () => {
  const routes: [string, string][] = [['home', ''], ['forecast', ''], ['forecast', 'wave-scale'], ['explore', ''], ['explore', 'compare'], ['explore', 'discover'],
    ['quiver', ''], ['quiver', 'showroom'], ['quiver', 'match'], ['quiver', 'compare'], ['personal', ''], ['personal', 'spots'], ['personal', 'privacy'], ['personal', 'terms']];
  const titles = routes.map(([a, s]) => docTitle(a, s, {spotName: 'Ocean Beach'}));
  assert.equal(new Set(titles).size, titles.length, 'titles are distinct');
  for (const t of titles) { assert.doesNotMatch(t, /—/); assert.match(t, /Swello/); }
  assert.equal(docTitle('forecast', '', {spotName: 'Ocean Beach'}), 'Ocean Beach surf forecast · Swello');
  assert.equal(docTitle('quiver', 'match'), 'Board Match · Swello');
  assert.equal(docTitle('personal', 'nope'), 'Personal · Swello');
  assert.equal(docTitle('forecast', '', {notFound: 'spot'}), 'Spot not found · Swello');
  assert.equal(docTitle('home', '', {notFound: 'page'}), 'Page not found · Swello');
});
