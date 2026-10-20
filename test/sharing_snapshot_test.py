"""Exercise persisted horoscope publications across real generator reruns."""
import contextlib
import copy
import datetime
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1]


class SharingSnapshotTest(unittest.TestCase):
    def test_same_day_revision_and_next_day_keep_old_publications_identical(self):
        spec = importlib.util.spec_from_file_location('sharing_prepare', SOURCE / 'scripts/sharing/prepare.py')
        generator = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(generator)
        with tempfile.TemporaryDirectory(prefix='k365-share-history-') as tmp:
            root = Path(tmp)
            site = root / 'site'
            (site / '_data').mkdir(parents=True)
            (site / 'assets/data').mkdir(parents=True)
            (site / 'assets/visuals').mkdir(parents=True)
            (site / 'assets/fonts').symlink_to(SOURCE / 'site/assets/fonts', target_is_directory=True)
            (site / 'assets/visuals/zodiac').symlink_to(SOURCE / 'site/assets/visuals/zodiac', target_is_directory=True)
            (root / 'scripts').symlink_to(SOURCE / 'scripts', target_is_directory=True)
            (site / 'assets/data/manifest.json').write_text('{"assets":[]}')
            (site / 'assets/data/years.json').write_text('[]')
            (site / 'index.html').write_text('---\ntitle: "Kalendorius365"\ndescription: "Viešas kalendorius"\n---\n<h1>Kalendorius365</h1>\n')
            signs = json.loads((SOURCE / 'site/_data/horoscope_signs.json').read_text())
            (site / '_data/horoscope_signs.json').write_text(json.dumps(signs))
            current = json.loads((SOURCE / 'site/_data/horoscope_current.json').read_text())
            generator.ROOT, generator.SITE, generator.ASSETS = root, site, site / 'assets/sharing'

            def publish(value):
                (site / '_data/horoscope_current.json').write_text(json.dumps(value))
                with contextlib.redirect_stdout(io.StringIO()):
                    generator.prepare()
                return json.loads((site / 'assets/sharing/records/horoscope-avinas.json').read_text())

            first = publish(current)
            snapshot = root / 'data/horoscope-snapshots' / first['contentDate'] / (first['contentVersion'] + '.json')
            original = snapshot.read_bytes()
            permanent_record = site / 'assets/sharing/records' / (first['contentId'] + '.json')
            original_record = permanent_record.read_bytes()
            original_art = {p: hashlib.sha256((site / p.lstrip('/')).read_bytes()).hexdigest()
                            for p in json.loads(original)['artwork'].values()}
            archive = site / first['shareUrl'].split('https://kalendorius365.lt/')[1] / 'index.html'
            original_html = archive.read_bytes()

            revised = copy.deepcopy(current)
            revised['forecasts'][0]['lead'] += ' Testo leidimo pataisa.'
            fields = ['sign_key', 'editorial_heading', 'lead', 'overview', 'relationships', 'work', 'reflection', 'tip']
            canonical = '\1'.join('\0'.join(f[k] for k in fields)
                                  for f in sorted(revised['forecasts'], key=lambda f: f['sign_key']))
            revised['content_checksum'] = hashlib.sha256(canonical.encode()).hexdigest()
            second = publish(revised)
            self.assertNotEqual(first['shareUrl'], second['shareUrl'])
            self.assertEqual(snapshot.read_bytes(), original)
            self.assertEqual(archive.read_bytes(), original_html)
            self.assertEqual(permanent_record.read_bytes(), original_record)

            tomorrow = copy.deepcopy(revised)
            tomorrow['local_date'] = (datetime.date.fromisoformat(revised['local_date']) + datetime.timedelta(days=1)).isoformat()
            third = publish(tomorrow)
            self.assertEqual(third['contentDate'], tomorrow['local_date'])
            self.assertNotEqual(second['shareUrl'], third['shareUrl'])
            self.assertEqual(snapshot.read_bytes(), original)
            self.assertEqual(archive.read_bytes(), original_html)
            self.assertEqual(len(list((root / 'data/horoscope-snapshots').glob('*/*.json'))), 3)
            for path, expected in original_art.items():
                self.assertEqual(hashlib.sha256((site / path.lstrip('/')).read_bytes()).hexdigest(), expected)
            for sign in signs:
                record = json.loads((site / f'assets/sharing/records/horoscope-{sign["key"]}.json').read_text())
                self.assertEqual(record['contentDate'], tomorrow['local_date'])
                self.assertEqual(record['signSlug'], sign['key'])
                self.assertIn('/v-' + third['contentVersion'] + '/', record['shareUrl'])
                self.assertEqual(record['sections'].keys(), {'lead', 'relationships', 'work'})


if __name__ == '__main__':
    unittest.main()
