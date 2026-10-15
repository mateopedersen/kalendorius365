# Kalendorius365.lt — ürün kalite denetimi

Denetim tarihi: 15 Ekim 2026. Çalışma dalı: `audit/quality-2026-10-15`; yerel `main` dalındaki `a78a578` revizyonundan açıldı. Bu çalışma üretim dalını veya Cloudflare hesabını değiştirmedi. Önceki üretim sürümüne dönüş bilgileri `docs/product-checkpoint.md` içindedir.

## A — Litvanca dil ve terimler

**KISMEN DOĞRULANDI.** 41 kanonik sayfa ve 404 sayfasının tümü gözden geçirildi. 42 HTML dosyasında 7.415 görünür metin/erişilebilirlik özniteliği parçası ve 1.034 ayrı, normalleştirilmiş ifade sayıldı. Sayı yinelenen takvim hücrelerini, tarihleri ve öznitelikleri içerir; JavaScript ile sonradan gösterilen durum metinleri bu envantere dahil değildir. Yapısal taramada arayüzde görünen “Save”, “Settings”, “Download” veya “Today” etiketine rastlanmadı; eşleşmeler teknik kimlik ve ikon adlarıydı. Ayların yalın ve iyelik biçimleri, hafta günü kısaltmaları ve kategori adları `data/calendar.json` içinde merkezi tutuluyor. Sık kullanılan arayüz terimleri için bir sözlük eklendi. VLKK Terminų bankas resmi terim kaynağı olarak incelendi, ancak her ifadenin ayrı ayrı dilbilgisi denetimi yapılmadı.

**DÜZELTİLDİ.** Gizlilik açıklaması yerel saklama, JSON yedeği, ICS dışa aktarım kapsamı ve kişisel kayıtları silme davranışını daha açık anlatıyor. Çalışma saati yöntem metni 1 Kasım 2026'da yürürlüğe girecek İş Kanunu değişikliğini ve hesaplayıcının sınırlarını açıklıyor.

Litvanca ana dili konuşan bir editör incelemesi yapılmadı. Sözlük merkezî bir terim başvuru kaynağıdır; statik sayfalardaki tüm yazılar henüz çalışma anında bu sözlükten üretilmiyor. Bu nedenle terminoloji mimarisi kısmen tamamlandı. VLKK kaynakları: [Terminų bankas](https://duomenys-terminai.vlkk.lt/) ve [arama açıklamaları](https://duomenys-terminai.vlkk.lt/paaiskinimai).

| Önceki ifade / eksik | Yeni ifade veya davranış | Gerekçe ve etkilenen sayfalar |
|---|---|---|
| “Pagal DK 112 straipsnio 6 dalį ... trumpinama viena valanda. Trumpinimas netaikomas ... sutrumpinta darbo laiko norma.” | “Nuo 2026-11-01 ... darbo užmokestis paliekamas; kai atlygis priklauso nuo darbo normų ... vidutinis darbo užmokestis ... kai ... trumpinti neįmanoma – kaip už viršvalandinį darbą.” | XV-1058 pakeitė 112(6) straipsnio formuluotę. Atnaujinti `scripts/pages.rb` ir vieši 2027/2028 darbo laiko puslapiai; dabar aiškiai nurodoma, kad skaičiuoklė neapskaičiuoja asmeninių darbo užmokesčio išimčių. |
| Gizlilik sayfası yerel saklama ve yedekten söz ediyordu; tüm kişisel kayıtları silecek bir kontrol sunmuyordu. | “Ištrinti asmeninius įrašus” başlıklı onay adımı eklendi; gizlilik sayfasında neyin silindiği ve hangi tercihlerin kaldığı açıklandı. | Kişisel veriler üzerinde kullanıcı kontrolü. Ana sayfa ve gizlilik sayfası etkilendi. |

## B — Tarih ve takvim doğruluğu

**DOĞRULANDI.** Otomatik testler 2027–2028 yıllarındaki 731 tarihi Ruby/Gregoryen ve ISO verileriyle karşılaştırıyor. Test kapsamı artık yıl, 2028 Şubat, pazartesi başlangıçlı haftalar, ISO hafta/yıl sınırları, ay ve yıl geçişleri, iş günü sayımı, Vilnius saat dilimindeki gün devri ve yaz saati geçişlerini içeriyor. Bu denetimde değişen `today()` işlevi, `Intl.DateTimeFormat` tarih alanlarını ayrı okuyup `Europe/Vilnius` gününü kuruyor.

## C — Resmî tatiller ve mevzuat

**KISMEN DOĞRULANDI.** Tatil tanımları ve Paskalya hesapları mevcut resmî kaynaklara ve gerileme testlerine bağlı. Beş günlük örnek (Pzt–Cum, günde 8 saat) ve altı günlük örnek (Pzt–Cum 7 saat, Cmt 5 saat) açıkça belirtiliyor. Hafta sonuna gelen tatil pazartesiye taşınmıyor. DK 123'ün güncel konsolide tam metni bu çalışma ortamında indirilemedi; erişim sınırlaması `docs/sources-and-assumptions.md` içinde kayıtlı. 2027–2028 okul tatili tarihleri doğrulanmadığı için beklemede gösteriliyor.

**DÜZELTİLDİ.** Seimas'ın XV-1058 sayılı ve 1 Kasım 2026'da yürürlüğe girecek değişikliği, İş Kanunu 112(6)'da arife günündeki bir saatlik kısaltmayı koruyor; kısaltılmış çalışma normuna ilişkin istisnayı, ücretin korunmasını, iş normuna bağlı ücrette ortalama ücret hesabını ve kısaltma mümkün değilse fazla mesai ücretini açıklıyor. Standart 5/6 günlük örneklerin aritmetiği değişmiyor. Sayfalar kişiye özel ücret/iş hukuku sonucu vermediğini belirtiyor. Resmî [e-TAR mevzuat kaydı](https://www.e-tar.lt/portal/lt/legalAct/f74d61f0738e11f1b53dfa020e517810).

## D — Güvenlik ve gizlilik

**DÜZELTİLDİ.** Ana sayfaya kişisel olayları, notları ve görevleri silmek için açıklamalı, onay isteyen bir kontrol eklendi. Normal durumda şehir ve görünüm tercihleri korunuyor. Bozuk veri normal biçimde üzerine yazılamazsa güvenli yedek yol tüm site veri kaydını siliyor; bu istisnai durumda tercihler de silinir ve arayüz bunu bildirir. Başarısız silme işlemi artık başarı gibi gösterilmez.

**DOĞRULANDI / SINIRLI KAPSAM.** Kayıt doğrulama, boyut ve dosya sınırları, ICS/JSON şema kontrolleri, takvimde kullanıcı metninin `textContent` ile gösterilmesi ve üretilen SVG metin kaçışları incelendi. Kişisel etkinlik/not/görev içeriği hava durumu isteğine eklenmiyor. Hava servisi yalnız izin verilen şehir kimliklerini kabul ediyor. Bu kod incelemesi sızma testi veya güvenlik sertifikası değildir.

**YEREL YAPIDA HAZIR; ÖNİZLEME ONAYI BEKLİYOR.** CSP, Jekyll derleyicisinin ürettiği Cloudflare Pages `_headers` dosyasına eklendi. Betik, tema başlatıcısının gerçek içeriğinden SHA-256 iznini kendisi hesaplıyor; dış kaynaklı komut dosyalarına izin verilmiyor. `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'` ve same-origin bağlantı izinleri var. Stil yönergesindeki `unsafe-inline`, indirilebilir WebP üreten SVG içindeki gerekli biçimlendirme içindir. Gerçek tarayıcı/Cloudflare önizlemesinde uygulama, yazdırma ve CSP konsolu kontrol edilmeden başlık canlıya alınmış sayılmayacak.

## E — Hava durumu

**DOĞRULANDI, KAPSAM SINIRLI.** Entegrasyonda beş şehir tanımlı: Vilnius, Kaunas, Klaipėda, Šiauliai ve Panevėžys. LHMT/Meteo LT gözlemleri ve tahmini ayrı gösteriliyor; zaman damgası var, eski veri eski olarak işaretleniyor, veri yoksa uydurma sıcaklık gösterilmiyor. Testler geçersiz şehir, kısmi/tam servis kesintisi ve önbellek hatasını kapsıyor. Son kod düzeltmesi beklenmeyen önbellek okuma hatasını `503` ve `no-store` yanıtına çeviriyor. API'nin tüm ek yerleşimleri bu turda denenmedi. Lisans/önbellek sınırları `docs/sources-and-assumptions.md` içinde.

## F — PDF ve WebP

**OTOMATİK PREFLIGHT İLE DOĞRULANDI.** Bu denetimde 276 PDF ve 276 WebP geçti. Denetim A4 MediaBox/TrimBox, gömülü font ve Litvanca glifler, tarih yerleşimleri, vektör metin/çizgi, marka işareti ve WebP'nin 600 PPI A4-eşdeğer piksel ölçülerini kontrol etti. PDF'lerde gömülü raster bulunmadığından raster PPI uygulanmaz; vektör içerik ölçeklenebilir. Bu çalıştırmada yeni görsel onay kapısı çalıştırılmadı; `visualReviewed=false`. Önceki örnek görsel kontrolleri `docs/sample-preflight.json` içindedir. Fiziksel yazıcıda baskı yapılmadı. Bağımsız `fontTools` varlık denetimi, mevcut Python ortamında `fontTools` modülü bulunmadığı için çalışmadı.

## G — Erişilebilirlik, mobil ve performans

**ÖNCEKİ SÜRÜM KANITLARINA GÖRE KISMEN DOĞRULANDI.** `docs/product-checkpoint.md` daha önceki sürüm için altı ekran genişliği, mobil taşma, axe-core, klavye dolaşımı ve yerel laboratuvar performans ölçümlerini kaydediyor. axe-core otomatik taramasında sıfır bulgu vardı ancak 1–2 kontrol tamamlanmamıştı; bu, sertifikasyon değildir. Bu denetimdeki yeni silme iletişim kutusu değişikliği gerçek tarayıcıda görsel olarak denenemedi; yerel önizleme sunucusunu başlatmak ortam izinleri tarafından engellendi. Fiziksel telefon, Safari/Firefox/Edge çapraz taraması, yardımcı teknoloji, 200% yakınlaştırma tekrarı, kısıtlı mobil ağ testi veya saha performansı ölçümü yapılmadı.

## H — Kod kalitesi, testler ve yayın güvenliği

**DOĞRULANDI.** `audit/quality-2026-10-15` dalı temiz `main` revizyonu `a78a578` üzerinden açıldı. `node --test`: 16/16 geçti. Statik site denetimi: 42 HTML, 41 kanonik sayfa, 3.720 yerel bağlantı hedefi, sıfır bozuk bağlantı. Print preflight: 276 PDF geçti. `git diff --check` ve `ruby -c scripts/pages.rb` geçti.

**YAYIN KAPISI KAPALI / DOĞRULANMADI.** Tam Ruby/Jekyll derlemesi çalışmadı: makinede Ruby 2.6 var, kilitli Bundler 2.6.9 yok. Python `fontTools` denetimi de eksik modül nedeniyle çalışmadı. Bu nedenle değişiklikler GitHub'a gönderilmedi, Cloudflare önizlemesine alınmadı ve üretime yayınlanmadı. Yeni değişiklikler yalnız yerel denetim dalında. Önizleme ve üretim duman testleri geçmeden yayınlanmamalı.

## Düzeltme özeti

| Alan | Değişiklik | Kanıt |
|---|---|---|
| Tarih | `Europe/Vilnius` bugünkü tarihini yerel ayarın metin biçimine bağlı olmadan kurma | Mevcut 15 testin içinde saat dilimi testleri |
| Gizlilik | Tüm kişisel yerel kayıtları silme, onay ve bozuk kayıt için yedek silme yolu | Normal ve bozuk depolama için iki regresyon testi |
| Hava durumu | Cache okuma hatasında kontrollü, önbelleğe alınmayan yanıt | Cache arızası gerileme testi |
| Çalışma saati | 2026-11-01 mevzuat değişikliğini ve hesaplama sınırını açıklama | Resmî e-TAR metni ve güncellenen kaynak/görünür sayfa metni |

## Sonraki adımlar

1. Proje içindeki Ruby 3.4.11/Bundler 2.6.9 ve Python `fontTools` araç zinciriyle tüm baskı dosyalarını yeni kaynak parmak izinde yeniden üretip doğrulamayı tamamlayın.
2. Değişiklikleri Cloudflare Pages dal önizlemesine gönderin; tarayıcıda CSP ihlallerini, ana/ay/araç sayfalarını, dar mobil görünümü, kişisel kayıt silmeyi, hava durumu işlevini ve PDF/WebP indirmelerini doğrulayın.
3. Önizleme ve otomatik kontroller geçerse yayın derlemesini üretin, mevcut `main` dalına bir PR üzerinden birleştirin ve canlı URL/başlık/işlev/indirme kontrollerini yapın.
4. Fiziksel yazıcıda prova ve Litvanca ana dili konuşan editör incelemesi yapılmadı; bu denetimde bunları yapılmış gibi göstermeyin.
