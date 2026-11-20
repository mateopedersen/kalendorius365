import fs from 'node:fs/promises';
import path from 'node:path';
import c from '../data/shopping-guides.json' with {type:'json'};
import {dates,nextDay,render,writeCalendars} from './shopping-guides/render.mjs';
const root=path.resolve(import.meta.dirname,'..');
await writeCalendars(c,path.join(root,'site/assets/shopping'));
for (const [i, page] of c.pages.entries()) {
  const target = path.join(root, 'site', c.paths[i], 'index.html');
  await fs.mkdir(path.dirname(target), { recursive: true });
  const event_calendar_occurrences = Array.from({ length: 5 }, (_, index) => {
    const year = 2026 + index, start = dates(year)[page.kind];
    return { start, end_exclusive: nextDay(start), ics: c.asset + page.slug + '-' + year + '.ics' };
  });
  const metadata = {
    title: page.title, description: page.description, preserve_source: true, shopping_guide: true,
    shopping_css: c.css, shopping_script: c.script, og_image: c.asset + page.slug + '-og.png',
    og_image_alt: page.name + ' 2026: ' + c.labels.heroLine.toLocaleLowerCase(c.locale),
    og_image_width: 1200, og_image_height: 630, event_calendar_occurrences, event_calendar_title: page.name,
  };
  const calendarPanel = '{% include event-calendar-links.html occurrences=page.event_calendar_occurrences event_title=page.event_calendar_title %}';
  await fs.writeFile(target, '---\n' + Object.entries(metadata).map(([key,value]) => key + ': ' + JSON.stringify(value)).join('\n') + '\n---\n' + render(c, page, { calendarPanel }));
}
