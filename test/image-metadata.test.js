import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const roots = ['site', 'public'];
const additionalPhotos = JSON.parse(await readFile(new URL('../data/holiday-guide-photos.json', import.meta.url), 'utf8'));

async function holidayImageObjects(root) {
  const pages = [];
  const directories = await readdir(path.join(root, 'sventes'), {withFileTypes: true});
  for (const entry of directories) {
    if (!entry.isDirectory()) continue;
    const file = path.join(root, 'sventes', entry.name, 'index.html');
    let html;
    try { html = await readFile(file, 'utf8'); }
    catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const schema = JSON.parse(match[1]);
      if (schema['@type'] === 'Article' && schema.image?.['@type'] === 'ImageObject') {
        pages.push({route: `/sventes/${entry.name}/`, image: schema.image});
      }
    }
  }
  return pages;
}

test('holiday image metadata is complete in source and generated public pages', async () => {
  for (const root of roots) {
    const pages = await holidayImageObjects(root);
    const additions = new Set(Object.keys(additionalPhotos));
    assert.equal(pages.length, 31 + additions.size, `${root}: expected the original and additional guide images`);
    for (const {route, image} of pages) {
      const label = `${root}${route}`;
      assert.ok(image.contentUrl, `${label}: contentUrl`);
      assert.equal(image.contentUrl, image.url, `${label}: explicit URL identifies the same image`);
      assert.ok(image.license, `${label}: license`);
      assert.ok(image.acquireLicensePage, `${label}: acquireLicensePage`);
      assert.ok(image.creditText, `${label}: visible source credit`);
      assert.ok(image.copyrightNotice?.includes(image.creditText), `${label}: source-based copyright notice`);
      const slug = route.split('/')[2];
      const photo = additionalPhotos[slug];
      if (photo) {
        assert.ok(additions.delete(slug), `${label}: unique additional guide image`);
        assert.equal(image.contentUrl, 'https://kalendorius365.lt' + photo.src, label);
        assert.equal(image.creditText, photo.author, label);
        assert.equal(image.caption, photo.caption, label);
        assert.equal(image.license, photo.license_url, label);
        assert.equal(image.acquireLicensePage, photo.commons_url, label);
        assert.deepEqual([image.width, image.height], [photo.width, photo.height], label);
        continue;
      }
      const creators = Array.isArray(image.creator) ? image.creator : [image.creator];
      assert.ok(creators.length, `${label}: creator`);
      for (const creator of creators) {
        assert.ok(['Person', 'Organization'].includes(creator?.['@type']), `${label}: valid creator type`);
        assert.ok(creator.name && image.creditText.includes(creator.name), `${label}: creator matches visible attribution`);
      }
    }
    assert.equal(additions.size, 0, `${root}: missing image metadata for ${[...additions].join(', ')}`);
  }
});
