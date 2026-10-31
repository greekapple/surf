import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AI_CAPTION, captionFor, creditLine, entryProblems, resolveMedia, srcSet, type MediaEntry, type MediaManifest} from '../ui/mediaModel.ts';
const manifest = JSON.parse(readFileSync(new URL('../../public/media/manifest.json', import.meta.url), 'utf8')) as MediaManifest;
const photo: MediaEntry = {kind: 'photo', alt: 'Ocean Beach', sources: [{src: '/photos/a-800.jpg', width: 800}], focal: [50, 50], credit: 'A', licence: 'CC BY 4.0'};
const ai: MediaEntry = {kind: 'ai-illustration', alt: 'Swell lines', sources: [{src: '/media/x.jpg', width: 1200}], focal: [40, 60], credit: 'Higgsfield', licence: 'Generated', caption: AI_CAPTION, fallback: 'p'};

test('every manifest entry is labelled: kind, credit, licence, alt, focal', () => {
  const ids = Object.keys(manifest.entries);
  assert.ok(ids.length >= 13);
  for (const id of ids) assert.deepEqual(entryProblems(id, manifest.entries[id], manifest.entries), [], id);
});

test('no AI entry in the manifest lacks the visible caption (and a fallback photo)', () => {
  for (const [id, e] of Object.entries(manifest.entries)) {
    if (e.kind !== 'ai-illustration') continue;
    assert.equal(e.caption, AI_CAPTION, id); assert.equal(captionFor(e), 'Illustration · AI-generated, not current conditions', id);
    assert.equal(manifest.entries[e.fallback!]?.kind, 'photo', id);
  }
});

test('the check itself fails an AI entry without the caption or fallback', () => {
  assert.deepEqual(entryProblems('ai', ai, {p: photo, ai}), []);
  assert.match(entryProblems('ai', {...ai, caption: undefined}, {p: photo})[0], /caption/);
  assert.match(entryProblems('ai', {...ai, caption: 'AI'}, {p: photo})[0], /caption/);
  assert.ok(entryProblems('ai', {...ai, fallback: undefined}, {}).some((m) => /fallback/.test(m)));
  assert.ok(entryProblems('ai', {...ai, fallback: 'ai'}, {ai}).some((m) => /fallback/.test(m))); // a fallback must be a photo
  assert.ok(entryProblems('p', {...photo, licence: ''}, {}).some((m) => /licence/.test(m)));
  assert.ok(entryProblems('p', {...photo, focal: [120, 0]}, {}).some((m) => /focal/.test(m)));
});

test('captions: AI always, photos never; credit line names the photographer and licence', () => {
  assert.equal(captionFor(ai), AI_CAPTION); assert.equal(captionFor(photo), null); assert.equal(creditLine(photo), 'A · CC BY 4.0');
});

test('fallback: with no manifest the existing CC photos still resolve; unknown ids resolve to nothing', () => {
  const e = resolveMedia('ocean-beach-seal-rocks', null)!;
  assert.equal(e.kind, 'photo'); assert.match(e.credit, /\S/); assert.match(e.licence, /CC/); assert.ok(e.sources.length >= 1);
  assert.equal(resolveMedia('nope', null), undefined); assert.equal(resolveMedia('ocean-beach-seal-rocks', {version: 1, entries: {}})!.kind, 'photo');
  assert.equal(resolveMedia('x', {version: 1, entries: {x: ai}}), ai); // the manifest wins
  assert.equal(srcSet(photo), '/photos/a-800.jpg 800w');
});
