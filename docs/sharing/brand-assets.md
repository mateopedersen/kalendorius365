# Sosyal platform marka varlıkları

Bu dosyalar resmi platform kaynaklarından alındı ve yerel olarak sunulur. Kaynak dosyanın ve temizlenmiş dosyanın SHA-256 değerleri [manifestte](../../site/assets/sharing/brand-assets.json) bulunur. Geometriyi, oranları ve sağlanan renkleri değiştiren marka benzetimleri kullanılmaz.

| Platform | Resmi kaynak | Yerel dosya | Alınma tarihi ve dönüşüm |
|---|---|---|---|
| x | [x resmi kaynağı](https://about.x.com/ja/who-we-are/brand-toolkit) | `/assets/sharing/brands/x-f09303b62d7f.svg` | 2026-10-20 · none |
| telegram | [telegram resmi kaynağı](https://telegram.org/tour/screenshots) | `/assets/sharing/brands/telegram-5766b4c98dc4.svg` | 2026-10-20 · SVG sanitized and whitespace normalized; supplied geometry and colors unchanged. |
| instagram | [instagram resmi kaynağı](https://www.meta.com/brand/resources/instagram/instagram-brand/) | `/assets/sharing/brands/instagram-ef47b4cb1bc3.svg` | 2026-10-20 · SVG sanitized and whitespace normalized; supplied geometry and colors unchanged. |
| whatsapp | [whatsapp resmi kaynağı](https://www.meta.com/brand/resources/whatsapp/whatsapp-brand/) | `/assets/sharing/brands/whatsapp-c9229fd352cc.svg` | 2026-10-20 · none |
| threads | [threads resmi kaynağı](https://www.meta.com/brand/resources/threads/) | `/assets/sharing/brands/threads-5e0e73e2cfff.svg` | 2026-10-20 · SVG sanitized and whitespace normalized; supplied geometry and colors unchanged. |
| facebook | [facebook resmi kaynağı](https://www.meta.com/brand/resources/facebook/logo/) | `/assets/sharing/brands/facebook-19edf70ede10.svg` | 2026-10-20 · PDF-compatible original Adobe Illustrator artboard → SVG using PyMuPDF 1.26.5; no raster tracing or geometry edits |
| tumblr | [tumblr resmi kaynağı](https://www.tumblr.com/logo) | `/assets/sharing/brands/tumblr-3c5b8151ef86.svg` | 2026-10-20 · PDF-compatible original Adobe Illustrator artboard → SVG using PyMuPDF 1.26.5; no raster tracing or geometry edits |
| bluesky | [bluesky resmi kaynağı](https://bsky.social/about/blog/press-faq) | `/assets/sharing/brands/bluesky-7eabc55693d9.svg` | 2026-10-20 · none |
| mastodon | [mastodon resmi kaynağı](https://joinmastodon.org/branding) | `/assets/sharing/brands/mastodon-66c0e4e393be.svg` | 2026-10-20 · none |
| reddit | [reddit resmi kaynağı](https://redditinc.com/brand) | `/assets/sharing/brands/reddit-90c3c5e0af7d.svg` | 2026-10-20 · none |
| pinterest | [pinterest resmi kaynağı](https://business.pinterest.com/brand-guidelines/) | `/assets/sharing/brands/pinterest-106a39d9dea2.png` | 2026-10-20 · Lossless RGBA PNG conversion from the official brand-page WebP response; geometry not traced or redrawn. |
| linkedin | [linkedin resmi kaynağı](https://brand.linkedin.com/) | `Metin fallback` | 2026-10-20 · none |

Instagram için resmi kitin saf vektör siyah glifi kullanılır. Resmi gradient SVG dosyası 10 MB gömülü raster içerdiğinden hızlı arayüz için uygun değildi; özgün siyah SVG geometri ve renkleriyle korunur. Pinterest’in resmi WebP kaynağı kayıpsız PNG’ye dönüştürüldü; SVG olduğu iddia edilmez. LinkedIn’in resmi paylaşım düğmesi logosu, API istemci kimliği ve izin şartı nedeniyle açık platform adıyla sunulur. Mastodon işaretinin çevresinde en az 36 CSS piksel boşluk korunur.

Sınırlama ve kullanım notları manifestteki `usageNote` alanlarında kayıtlıdır. Marka hakları ilgili platformlara aittir. Çalışma sırasında sosyal hesaplarla oturum açılmaz ve gönderi yayımlanmaz.

`node --test test/social-sharing.test.js` dosya hash’lerini ve SVG güvenliğini kontrol eder. Tarayıcı testi Instagram işaretinin gerçekten piksel çizdiğini de doğrular. Runtime, JSON manifestle aynı veriden üretilmiş `brand-assets.js` dosyasını kullanır.
