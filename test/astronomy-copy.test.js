import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('solar comparisons refer to the selected date and neighbouring days', () => {
  const js = read('site/assets/sunrise.js');
  assert.match(js, /Palyginti su ankstesne diena/);
  assert.match(js, /kitą dieną jis \$\{tomorrowChange\}/);
  assert.doesNotMatch(js, /Palyginti su vakarykšte diena, šiandien/);
  assert.doesNotMatch(js, /Beveik tiek pat šviesos kaip vakar/);
});

test('the illustrated final hour is not labelled as calculated golden-hour boundaries', () => {
  const js = read('site/assets/sunrise.js');
  assert.match(js, /golden: "Prieš saulėlydį"/);
  assert.doesNotMatch(js, /golden: "Auksinė valanda"/);
  assert.match(js, /Paleisti animaciją/);
  assert.match(js, /Sustabdyti animaciją/);
});

test('the lunar phase reference has its own cited educational explanation', () => {
  const source = read('scripts/lunar/pages.py');
  assert.match(source, /def phase_explanation\(\):/);
  assert.match(source, /Kodėl per priešpilnį matyti pusė disko\?/);
  assert.match(source, /Kuo fazė skiriasi nuo užtemimo\?/);
  assert.match(source, /https:\/\/spaceplace\.nasa\.gov\/moon-phases\/en\//);
  const phasePage = read('site/menulio-fazes/index.html');
  const calendarPage = read('site/menulio-kalendorius/index.html');
  assert.match(phasePage, /id="lunar-phase-cause"/);
  assert.doesNotMatch(calendarPage, /id="lunar-phase-cause"/);
});

test('lunar export buttons state that an ICS file will be downloaded', () => {
  const source = read('scripts/lunar/pages.py');
  assert.match(source, /Atsisiųsti fazes \(ICS\)/);
  assert.match(source, /aria-label="Atsisiųsti ICS:/);
  assert.doesNotMatch(source, /Pridėti visas fazes/);
});
