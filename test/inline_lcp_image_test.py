import unittest,sys,re,base64
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from inline_lcp_image import inline_image

class InlineImageTests(unittest.TestCase):
 def test_exact_bytes_are_embedded_without_changing_the_fallback(self):
  source='<picture><source type="image/avif" srcset="/assets/visuals/weather-640.avif?v=abc 640w"><img src="/assets/visuals/weather-640.webp?v=abc" width="640" height="360"></picture>'
  result=inline_image(source,b'AVIF-test-bytes')
  self.assertIn('data:image/avif;base64,'+base64.b64encode(b'AVIF-test-bytes').decode(),result)
  self.assertIn('<img src="/assets/visuals/weather-640.webp?v=abc" width="640" height="360">',result)
 def test_missing_or_duplicate_critical_sources_fail_the_build(self):
  source='<source type="image/avif" srcset="/assets/visuals/weather-640.avif">'
  for document in ['',source+source]:
   with self.assertRaises(ValueError):inline_image(document,b'x')
 def test_built_homepage_embeds_the_original_vilnius_avif_and_keeps_its_webp_fallback(self):
  document=(ROOT/'public/index.html').read_text()
  picture=re.search(r'<picture class="clock-photo__frame">.*?</picture>',document,re.S)
  self.assertIsNotNone(picture)
  picture=picture[0]
  encoded=re.search(r'<source type="image/avif" srcset="data:image/avif;base64,([^"]+)"',picture)
  self.assertIsNotNone(encoded)
  self.assertEqual(base64.b64decode(encoded[1]),(ROOT/'site/assets/visuals/weather-city-vilnius-day-640.avif').read_bytes())
  self.assertIn('/assets/visuals/weather-city-vilnius-day.webp?',picture)
  self.assertIn('width="1200" height="675"',picture)
  self.assertIn('alt="Vilniaus katedra ir varpinė dieną"',picture)
  self.assertFalse(re.search(r'<link\b(?=[^>]*\brel="preload")(?=[^>]*\bas="image")(?=[^>]*weather-)[^>]*>',document),'The embedded image must not also trigger an external image preload')
if __name__=='__main__':unittest.main()
