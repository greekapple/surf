import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {defaultProfile} from '../data/demo.ts';
import {ageAnswer, deletedProfile, guardProfile, PERSONAL_KEYS, showSetupFlow, showSetupReminder} from '../services/profileFields.ts';
import {freshState, loadState, saveState, storageKey, validateState} from '../utils/storage.ts';
import type {UserProfile} from '../models/index.ts';

/** first-run: the setup is a full-screen flow before Home; skipping leaves one dismissible reminder; finishing leaves nothing. */
const read = (f: string) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const memory = () => { const m = new Map<string, string>(); return {getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m}; };
/** What the app shows for a stored profile (App.tsx and HomeView.tsx use the same two functions). Launch build by default. */
const screen = (p: UserProfile, owner = false) => showSetupFlow(p, owner) ? 'flow' : showSetupReminder(p, owner) ? 'home+reminder' : 'home';
/** One change, saved, then the browser reloaded: the same path as useAppData (guardProfile → saveState → loadState). */
const apply = (st: ReturnType<typeof memory>, patch: Partial<UserProfile>) => {
  const cur = loadState(st).state; saveState(st, {...cur, profile: guardProfile(cur.profile, patch)}); return loadState(st).state.profile;
};
// The two things the flow buttons set (ProfileSetup.tsx): Skip for now, and Done.
const SKIP = {setupState: 'skipped', onboarded: true} as const, DONE = {setupState: 'done', onboarded: true} as const;

test('migration: onboarded true -> done; an existing profile with onboarded false -> new; the field is validated', () => {
  const old = (onboarded: boolean) => {const {setupState: _s, ...rest} = {...defaultProfile, onboarded}; return {...freshState(), profile: rest}};
  assert.equal(validateState(old(true)).profile.setupState, 'done');
  assert.equal(validateState(old(false)).profile.setupState, 'new');
  assert.equal(validateState({...freshState(), profile: {...defaultProfile, onboarded: true, setupState: 'skipped'}}).profile.setupState, 'skipped');
  assert.throws(() => validateState({...freshState(), profile: {...defaultProfile, setupState: 'later'}}), /setup state/);
  assert.throws(() => validateState({...freshState(), profile: {...defaultProfile, setupReminderDismissed: 'yes'}}), /reminder/);
  assert.equal(validateState({...freshState(), profile: {...defaultProfile, setupState: 'skipped', onboarded: false}}).profile.onboarded, true, 'onboarded follows setupState');
  assert.equal(validateState({...freshState(), profile: {...defaultProfile, setupState: 'new', onboarded: true}}).profile.setupState, 'done', 'onboarded: true set by hand (QA scripts) wins over new');
});

test('a script that only sets onboarded: true (the toolkit journeys) skips the flow', () => {
  const st = memory(); st.setItem(storageKey, JSON.stringify({...freshState(), profile: {...defaultProfile, setupState: undefined, onboarded: true}}));
  assert.equal(screen(loadState(st).state.profile), 'home');
});

test('first run shows the flow, not Home', () => {
  const st = memory();
  assert.equal(screen(loadState(st).state.profile), 'flow');
  assert.equal(freshState().profile.setupState, 'new');
});

test('skip -> Home with the reminder; dismiss -> gone after a reload; the flow does not come back', () => {
  const st = memory();
  assert.equal(screen(apply(st, SKIP)), 'home+reminder');
  assert.equal(screen(apply(st, {setupReminderDismissed: true})), 'home');
  assert.equal(screen(loadState(st).state.profile), 'home', 'still gone on the next visit');
});

test('"Finish" in the reminder reopens the flow; finishing it leaves no reminder', () => {
  const st = memory(); apply(st, SKIP);
  assert.equal(screen(apply(st, {setupState: 'new', onboarded: false})), 'flow');
  assert.equal(screen(apply(st, DONE)), 'home');
});

test('done -> no reminder, never the flow again', () => {
  const st = memory(); apply(st, DONE);
  for (let i = 0; i < 2; i++) assert.equal(screen(loadState(st).state.profile), 'home');
  assert.equal(deletedProfile().setupState, 'done', 'delete my profile does not bring the flow back');
});

test('under 13: nothing personal is saved, and setup still ends as done', () => {
  const st = memory();
  apply(st, {displayName: 'Kai', heightIn: 70});
  let p = apply(st, ageAnswer('under-13'));
  p = apply(st, DONE);
  for (const k of PERSONAL_KEYS) assert.equal(k in p, false, `${k} not saved`);
  assert.equal(p.personalData, false); assert.equal(screen(p), 'home');
  assert.equal(JSON.stringify(JSON.parse(st.m.get(storageKey)!).profile).includes('Kai'), false);
});

test('owner build (VITE_OWNER_TOOLS=true): never an automatic flow, never a reminder; the preview opens it without changing state', () => {
  const st = memory();
  const fresh = loadState(st).state.profile;
  assert.equal(screen(fresh, true), 'home', 'new is treated like skipped');
  assert.equal(screen({...fresh, setupState: 'skipped'}, true), 'home', 'no reminder either');
  assert.equal(showSetupFlow(fresh, true, true), true, 'the preview opens the flow');
  const before = JSON.stringify(fresh); showSetupFlow(fresh, true, true);
  assert.equal(JSON.stringify(fresh), before); assert.equal(fresh.setupState, 'new', 'stored state is unchanged');
  assert.equal(screen(fresh, false), 'flow', 'flag off: the launch behaviour');
  assert.equal(screen({...fresh, setupState: 'skipped'}, false), 'home+reminder');
  const app = read('../app/App.tsx'), own = read('../features/personal/OwnerTools.tsx');
  assert.match(app, /if \('setupState' in v\) setPreview\(false\)/, 'in a preview Skip/Done only close it');
  assert.match(own, /if \(!OWNER_TOOLS\) return null/); assert.match(own, /Preview the first-run setup/);
  assert.match(read('../features/personal/PersonalView.tsx'), /<OwnerTools \/>/);
});

test('the flow: welcome copy, Start and Skip, an account slot with a pointer to the launch gate, and no email field', () => {
  const setup = read('../features/personal/ProfileSetup.tsx'), app = read('../app/App.tsx'), home = read('../features/home/HomeView.tsx');
  assert.match(setup, /Set up your surf profile/); assert.match(setup, /About 30 seconds/); assert.match(setup, /stay on this device/);
  assert.match(setup, /Start<\/button>/); assert.match(setup, /export const STEPS/); assert.match(setup, /LAUNCH-GATE\.md/);
  assert.doesNotMatch(setup, /type="email"|e-?mail address|password/i, 'no email is collected yet');
  assert.equal((setup.match(/\{skip\}/g) ?? []).length, 3);
  assert.match(setup, /skipSetup = \(\) => set\(\{setupState: 'skipped'/); assert.match(setup, /finish = \(\) => set\(\{setupState: 'done'/);
  assert.match(app, /showSetupFlow\(data\.state\.profile, OWNER_TOOLS\)/);
  assert.match(home, /showSetupReminder\(profile, OWNER_TOOLS\)/); assert.doesNotMatch(home, /<ProfileSetup/);
  assert.match(read('../../docs/specs/LAUNCH-GATE.md'), /Accounts:\*\* email sign-up becomes the first setup step/);
});
