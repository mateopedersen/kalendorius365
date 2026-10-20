# Kalendorius365 paylaşım paneli ve paylaşım sistemi — QA raporu

**Çalışma durumu:** Kaynak kodu, üretim derlemesi ve yerel doğrulamalar hazır. GitHub PR kontrolü ve canlı alan adı doğrulaması henüz tamamlanmadı; bu iki adım bitmeden yayına alındığı söylenmeyecek.

## Panel tasarımı

Panel, sitenin koyu lacivert metinlerini, yeşil vurgu rengini, açık yüzeylerini ve yazı ailesini kullanıyor. Masaüstünde geniş, iki sütunlu bir pencere açılıyor: solda gerçek sayfanın sosyal önizlemesi veya hazırlanmış takvim kartı, sağda paylaşım seçenekleri ve üretim kontrolleri yer alıyor. Bu düzen, seçenekleri basit kutucuklara bölmek yerine editoryal bir önizleme alanı ve yalın logo bağlantılarıyla sunuyor. Telefonda panel alt kenardan açılan, güvenli ekran boşluğunu gözeten ve kendi içinde kaydırılan tek sütunlu bir görünüme geçiyor.

Görsel modunda 5 çıktı oranı, PNG/JPEG, üç renk teması ve horoskopta paylaşılacak bölüm seçilebiliyor. Hazırlanan dosyanın kendisi panel içinde görünür. Temalar sayfanın orijinal sosyal önizlemesini değiştirmez. Instagram eylemi otomatik paylaşım gibi sunulmaz; kullanıcı görseli hazırlar, indirir veya cihazın paylaşım menüsünü kullanır. Görsel QA sırasında Instagram’ın resmi SVG paketinde çizilmeyen boş bir görüntü yer tutucusu bulundu. Kitin saf vektör siyah glifi geometri ve renkleriyle korundu. Yeniden çizilmiş bir marka işareti kullanılmadı; tarayıcı testi glifin gerçekten piksel çizdiğini doğruluyor.

[Panelin masaüstü bağlantı görünümü](evidence/dialog-desktop-link.png) · [masaüstü görsel hazırlama görünümü](evidence/dialog-desktop-image.png) · [390 piksel mobil görünüm](evidence/dialog-mobile-image.png) · [Instagram işareti](evidence/instagram-mark.png)

## İçerik ve paylaşım davranışı

- Site, sayfa, yıl, ay, her yazdırılabilir tasarım ve 5/6 satır boş takvim seçenekleri doğru kalıcı URL ile paylaşılır. Takvim tasarımlarının herkese açık HTML önizlemesi, PDF ve WebP indirmeleri bulunur.
- Burç paylaşımı Vilnius saat dilimindeki yayın tarihini, imzalı içerik sürümünü ve o yayına ait görseli kullanır. Önceki sürümün adresi saklanır; eski tarihler için geriye dönük metin üretilmez.
- Facebook, X, Instagram hazırlama, Bluesky, Reddit, WhatsApp, Telegram, Threads, LinkedIn, Pinterest, Mastodon, Tumblr, e-posta, panoya kopyalama ve cihaz paylaşımı tek platform kaydından sunulur. Platform açılması, oturum açılması veya gönderinin yayımlanması garanti edilmez. Hiçbir hesaba otomatik gönderi yapılmaz.
- Paylaşım verisi yalnızca herkese açık içerikten kurulur. Kişisel takvim, notlar, görevler, ICS içeriği, doğum bilgisi ve localStorage gönderilmez veya silinmez. Paylaşım kaydı kullanıcı tarafından yazılmış bilinmeyen alanları kabul etmez.
- JavaScript olmadan da Open Graph başlığı, canonical adresi, görseli ve HTML paylaşım bağlantıları kullanılabilir. Paylaşım arşivleri indeks dışı kalır ve arama dizinine karışmaz.

## Üretim ve cache

Son yerel üretim derlemesi `ff0b1b6660919d460802` sürüm kimliğini oluşturdu: 620 HTML sayfası, 191 sitemap adresi, 390 takvim görseli ve 6.968 statik dosya. Sürümlü JavaScript/CSS ve hash’li görseller uzun süreli immutable cache alır; doğrudan güncellenebilen dosyalar yeniden doğrulanır. HTML’de yeni sürüm URL’leri yer alır. Cloudflare panelinden ayrıca purge çalıştırılmadı ve çalıştırılmış gibi raporlanmıyor.

## Gerçekten çalıştırılan kontroller

| Kontrol | Sonuç |
|---|---|
| Tam Node.js paketi | 421/421 geçti |
| Sosyal paylaşım tarayıcı turu | 37 geçti, 3 planlı atlama; Chromium, WebKit, Android Chromium Pixel 5 profili ve iPhone 13 WebKit profili |
| CSS/route/sabit dosya testleri | 24 test geçti: Ruby CSS küçültücü 2, Python route CSS 17, statik varlık URL’leri 5 |
| Üretim sayfa denetimi | 620/620 erişilebilir, 0 yetim; 621 HTML dosyasında 50.774 yerel bağlantı hedefi, 0 bozuk; 191 sitemap adresi ve 390 takvim görseli |
| Burç sürüm kalıcılığı | Aynı gün metin revizyonu ve ertesi gün yayını: önceki JSON, HTML, kalıcı paylaşım kaydı ve özgün görseller değişmeden kaldı; 12 burcun yeni yayına eşleşmesi geçti |
| Takvim sayfaları | 36 aylık ve 3 yıllık tasarım sayfası denetimi geçti |
| Takvim çıktıları | 1.096 tarih, 390 A3 takvimi, 416 gömülü fontlu PDF ve paket/önizleme/eski dosya hash’leri geçti |
| iPhone/Android fiziksel cihazı | Kullanılmadı; tarayıcı cihaz profilleri gerçek cihaz veya işletim sistemi paylaşım menüsünün aynısı değildir |
| Yerel Firefox | Çalıştırılamadı. macOS Playwright Nightly süreci `sandbox_extension_issue_file_to_process` ve grafik başlatma hatası verdi; 15 saniyede açılmadı. Linux CI Firefox sonucu bekleniyor ve tamamlanmadan başarılı sayılmayacak. |

Üç atlama, beş oran ve tema kombinasyonlarını tekrar etmeyen Chromium’a özgü görsel çıktı matrisi kontrolüdür. PNG/JPEG üretimi ve indirme Chromium’da doğrulandı; paylaşım penceresinin temel açılması, önizleme, mahremiyet, kopyalama yedeği, klavye odağı ve iptal davranışı dört yerel tarayıcı projesinde çalıştırıldı.

## Mimari, yayınlama ve yapılandırma

Mevcut Jekyll/Ruby üretimi korunur. Ortak giriş `site/_includes/sharing.html`, başlangıç yükleyicisi `site/assets/sharing/loader.js`; dialog, metin/URL doğrulaması, platform registry, yerelleştirme ve canvas renderer aynı dizindeki ayrı modüllerdir. `scripts/sharing/prepare.py`, mevcut takvim manifestinden 416 tasarım önizlemesini, ilk HTML metadata’sını ve kalıcı burç kayıtlarını üretir. Günlük yayın workflow’u snapshot verisini ve üretilen paylaşım varlıklarını sürümler. Arşivdeki sayfalar, metinler ve görseller silinmez veya güncel yoruma yönlendirilmez.

Ek üyelik, sosyal giriş, veritabanı, OAuth token’ı, sosyal SDK, takip pikseli veya ücretli servis gerekmez. Mevcut Ruby/Node/Python derleme ortamı, npm lock dosyası ve baskı validator bağımlılıkları kullanılır; özgün burç SVG’lerinin raster kopyası build sırasında `@resvg/resvg-js` ile oluşturulur. Üretim komutu mevcut `K365_RELEASE=1 bundle exec ruby scripts/build.rb` komutudur. Kullanıcı verisi migration’ı veya storage temizliği yoktur. Sitede etkin bir uygulama analytics sağlayıcısı bulunmadığından yeni izleme sistemi eklenmedi.

Facebook Share Dialog için App ID yapılandırılmadığından standart sharer kullanılır. LinkedIn paylaşım URL’si çalışır; resmi düğme logosunun API istemci kimliği/izin koşulu nedeniyle açık platform adı sunulur. [Resmi marka kaydı](brand-assets.md) her dosyanın kaynağını, hash’ini ve dönüşümünü belgeler. QR eklenmedi; çıktıların tamamında doğru alan adı ve HTML indirme sayfası bulunur.

## Platform yetenekleri ve gerçekten gözlenen dış akış

| Hedef | Payload / yöntem | Anonim Chromium kontrolü ve fallback |
|---|---|---|
| Facebook | URL / sharer | HTTP 200, giriş yapılmadığı ekranı; metin ayrıca kopyalanır |
| X | Kısa metin + tek URL / intent | HTTP 200, giriş akışına yönlendi; kopyalama yedeği |
| Instagram | Gerçek PNG/JPEG + açıklama hazırlama | Yerel üretim ve indirme geçti; uygulamada Story yayımlama denenmedi |
| Bluesky | En fazla 300 Unicode grafem, tek URL | HTTP 200, anonim kullanıcı için giriş/hesap ekranı; kopyalama yedeği |
| Reddit | URL + başlık / submit | Bu test ortamında ağ güvenliği engeli; payload birim testi geçti, gönderim doğrulanmadı |
| WhatsApp | Metin + URL | HTTP 200, doğru metinle uygulama açma sayfası; kopyalama yedeği |
| Telegram | Ayrı URL ve metin | HTTP 200, doğru URL/metin görülen paylaşım sayfası; son gönderim denenmedi |
| Threads | Metin + tek URL | HTTP 200, giriş ekranına yönlendi; kopyalama yedeği |
| LinkedIn | URL | HTTP 200, giriş ekranına yönlendi; metin kopyalama ayrı |
| Pinterest | URL + anonim HTTPS görsel + açıklama | HTTP 200, Pin Builder/giriş ekranı; dosya blob URL’si kullanılmaz |
| Mastodon | Metin + URL / resmi sunucu seçme aracı | HTTP 200, metin ve sunucu seçimi görüldü; belirli bir sunucu zorlanmaz |
| Tumblr | Başlık, açıklama ve canonical URL | HTTP 200, giriş ekranına yönlendi; kopyalama yedeği |
| E-posta | Subject + body / mailto | URL üretimi test edildi; yerel e-posta uygulamasında gönderim denenmedi |
| Cihaz paylaşımı | Hazır metin/URL veya `canShare({files})` onaylı File | API iptali otomatik testte doğrulandı; gerçek iOS/Android sistem menüsü denenmedi |

[Anonim tarayıcı kontrol kaydı](evidence/platform-composer-checks.json), görülen yönlendirmeleri ve sonuçları içerir. HTTP 200 yanıtı gönderi yayımlama başarısı olarak sayılmadı. Hiçbir hesaba giriş yapılmadı, gönderi yayımlanmadı.

[Telegram paylaşım belgesi](https://core.telegram.org/widgets/share), [X Web Intents](https://docs.x.com/x-for-websites/web-intents/overview), [Bluesky Intent bağlantısı](https://bsky.network/docs/intent-links/), [Pinterest geliştirici belgesi](https://developers.pinterest.com/docs/web-features/buttons/), [Tumblr paylaşım belgesi](https://help.tumblr.com/knowledge-base/share-button-documentation/) ve [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) incelendi. Meta Share Dialog ve Threads geliştirici sayfaları bu ortamda doğrudan okunamadı; WhatsApp yardım sayfası gövdesi de okunabilir dönmedi. Bunlar doğrulanmış gibi gösterilmiyor.

## Manuel cihaz kontrol listesi ve sınırlar

Fiziksel iPhone Safari, Android Chrome, VoiceOver/TalkBack oturumu ve sosyal uygulamalarda gerçek dosya devri bu çalışma ortamında doğrulanmadı. Bu cihazlarda paneli açma/kapatma, büyük metin, sistem paylaşımını iptal etme, dosyayı Instagram’a aktarma, link sticker’ını kullanıcı olarak ekleme ve yerel e-posta uygulamasına geçiş ayrıca elle denenebilir. Otomatik testler klavye odağını, Escape’i, ARIA başlıklarını, 320 pikseli, yüzde 200 yazıyı, veri sızıntısı olmamasını ve dosya çıktısını kontrol etti. Platformların önizleme cache’inin anında yenileneceği garanti edilmez.

## Yayın ve kalan doğrulama

Henüz PR/CI ve canlı site kontrolü tamamlanmadığı için bu sürümün canlıya alındığı iddia edilmiyor. PR denetimleri yeşil olduğunda ana dala birleştirilecek; ardından `kalendorius365.lt` üzerinden yeni sürüm işareti, HTML canonical/OG metadata, PNG türü, panelin canlıda açılması ve cache başlıkları doğrulanacak. PR/CI başarısız olursa hata düzeltilip aynı kontroller tekrar çalıştırılacak.
