# Altyapı ve kurtarma notları








## Servis sahipliği








- Domain kaydı ve yenilemesi Hostinger'da kalır; alan adı Cloudflare'a aktarılmadı.
- Kaynak kodu özel GitHub deposunda: https://github.com/mateopedersen/kalendorius365, üretim dalı main.
- Barındırma ve CDN: Cloudflare Pages projesi kalendorius365, Free plan.
- Yetkili DNS: Cloudflare zone kalendorius365.lt; Hostinger'da Cloudflare'ın atadığı nameserver'lar kullanılıyor.








## Doğrulanmış durum — 2026-10-16








- GitHub deposu private ve main dalı mevcut. Cloudflare Workers and Pages GitHub App erişimi yalnızca bu depoyla sınırlı.
- Pages, mateopedersen/kalendorius365 deposuna yerleşik Git entegrasyonuyla bağlı. Üretim dalı main, framework ayarı None, build komutu boş, çıktı klasörü public; otomatik dağıtımlar etkin.
- Pages projesi `kalendorius365` üretim sitesini sunuyor. 2026-10-16 tarihinde `d78d343` commit’i `main` dalından başarıyla dağıtıldı; Cloudflare dağıtım kimliği `5ae04511-1992-4372-884c-ad1fa0948d9b`, dağıtım adresi https://5ae04511.kalendorius365.pages.dev/ ve Pages panelinde yeşil başarı işareti görüldü.
- 15 Ekim'de daha önce kontrol edilen başarılı dağıtımlar 5006ba035430525307d34e8815588aa95def7abe (12 saniye), bcb25cc ve c9e2887 commit'leridir. Önceki altyapı belgesi commit'i cca7a1355bed3aa788b5fc0cd656b3dfd15503f2 de Cloudflare Pages deployment b15b8e27-9cf1-4618-b040-85f6707412d9 olarak 17 saniyede başarıyla tamamlandı. main dalına yapılan push'lar otomatik üretim dağıtımını başlatır; en son commit'in sonucunu Cloudflare Pages → Deployments bölümünden doğrulayın.
- Hostinger nameserver'ları önceden cosmos.dns-parking.com ve nova.dns-parking.com idi; 2026-10-15'te devin.ns.cloudflare.com ve rosa.ns.cloudflare.com olarak değiştirildi. Hostinger kaydı başarıyla kaydetti; alan adı Hostinger'da kalıyor.
- Cloudflare zone artık etkin ve trafiği Cloudflare üzerinden geçiriyor. Plan Free.
- Hostinger DNSSEC ekranındaki Key Tag, Algorithm, Digest Type ve Digest alanları boş. VeriSign DNSSEC Debugger kontrolü kalendorius365.lt için .lt üst bölgesinde DS kaydı ve alan adı için DNSKEY göstermedi; devin.ns.cloudflare.com ile rosa.ns.cloudflare.com yetkili nameserver olarak görünüyor. Domain DNSSEC etkin değil; stale DS kaydı saptanmadı.
- Nameserver değişiminden önce Hostinger DNS tablosunda yalnızca kök A kaydı 2.57.91.91 (TTL 50) ve www CNAME kalendorius365.lt (TTL 300) görüldü. MX, TXT, AAAA veya CAA görünmedi. Kök A kaydı amacı doğrulanmadığı ve park kaydı gibi göründüğü için taşınmadı.
- Cloudflare DNS'de şu anda iki proxied CNAME ve Auto TTL bulunuyor:








  | İsim | Hedef | Proxy | TTL |
  | --- | --- | --- | --- |
  | kalendorius365.lt | kalendorius365.pages.dev | Proxied | Auto |
  | www.kalendorius365.lt | kalendorius365.pages.dev | Proxied | Auto |








- Alan adının DNS'inde MX kaydı yok ve bağımsız sorguda mail sunucusu bulunmadı. Bu domain adreslerine e-posta alınması şu anda yapılandırılmış değil. E-posta gerekiyorsa önce posta sağlayıcısını belirleyin ve yalnızca onun verdiği MX/SPF/DKIM/DMARC kayıtlarını ekleyin; kayıt tahmin etmeyin.
- Pages Custom Domains ekranında kalendorius365.lt ve www.kalendorius365.lt artık Active ve SSL enabled. Cloudflare'ın [Pages sorun giderme yönergesi](https://developers.cloudflare.com/pages/configuration/debugging-pages/) HTTP doğrulamasını yönlendirme kurallarının engelleyebileceğini belirtiyor. www yönlendirmesi `/.well-known/acme-challenge/*` yolunu dışarıda bırakacak şekilde düzeltildikten ve DNS doğrulaması yeniden başlatıldıktan sonra www durumu Active oldu. DNS CNAME hedefi www → kalendorius365.pages.dev olarak doğru.
- Cloudflare Always Use HTTPS açık. HSTS ve HSTS preload açılmadı. Normal www → kök 301 yönlendirmesi yolu ve sorgu parametrelerini koruyor; `/.well-known/acme-challenge/*` yolunu Pages doğrulaması için yönlendirme dışında bırakıyor.
- 2026-10-16 üretim kontrolleri: tüm 71 canonical HTML sayfası doğrudan GET ile 200; her sayfada `lang=lt`, tek self-canonical, `index, follow`, tek başlık ve H1 doğrulandı. Sitemap 200 ve 71 sayfa URL’siyle eşleşiyor; sitemap ayrıca 360 görsel konumu içeriyor. `robots.txt` 200, kök dizine izin veriyor ve sitemap’i bildiriyor. Üretimdeki 832 PDF/WebP dosyasının tamamı GET ile indirildi ve her birinin boyutu ile SHA-256 değeri yerel çıktı ile aynı bulundu (416 PDF + 416 WebP; 91.500.372 bayt). Temsilî HTML/CSS/JS yanıtlarında CSP bulundu; bilinmeyen URL 404 döndü. HTTP→HTTPS ve www→kök alan adı örnekleri 301 ile doğru HTTPS canonical URL’ye yöneldi ve 200 ile tamamlandı. Ayrıntı: `docs/phase-5-6-8/LIVE-VERIFICATION.json`.
- Güncel üretim HTTP yanıtlarında `X-Robots-Tag: noindex` yok; 71 canonical sayfanın tümünde HTML `robots` meta etiketi `index, follow`. Bu, sitenin teknik olarak taranabilir olduğunu doğrular; arama motorlarının sayfaları kabul ettiğini veya dizine eklediğini kanıtlamaz.
- Mobil görünüm, canlı HTTPS adresinde tarayıcı cihaz emülasyonuyla 280×700, 320×568, 375×667 ve 390×844 portre boyutlarında; ayrıca 844×390 yatay boyutunda doğrulandı. Her boyutta documentElement ve body genişliği viewport ile eşleşti, yatay taşma olmadı. 280 px sınırındaki kart taşması c322050 commitinde düzeltildi; Cloudflare Pages üretim dağıtımı 37404b32-a414-4b36-a358-e8f415c42fd9 başarılı oldu ve alan adı üzerinde bu boyutlarda tekrar test edildi.

## Performans ayarları — 2026-10-16

- Cloudflare Speed Brain, Early Hints ve 0-RTT Connection Resumption etkin. Speed Brain tarayıcı destekliyorsa olası sonraki sayfayı önceden getirebilir; ilk açılışı değiştirmez. Early Hints sayfanın CSS kaynaklarını HTML yanıtı tamamlanmadan tarayıcıya bildirebilir. 0-RTT yalnızca güvenli GET/HEAD/OPTIONS isteklerinde etkilidir; bu sitenin Pages Functions uçları salt okunur GET istekleridir.
- HTTP/2, HTTP/3, HTTP/2 to Origin, Always Use HTTPS ve TLS 1.3 etkin kalıyor. Rocket Loader kapalı; site yerel ES modüllerine ve sıralı başlangıç koduna dayanıyor. Polish ücretsiz planda kullanılamıyor; ücretli özellik gerekmeden mevcut yerel görseller kullanılmaya devam ediyor.
- Pages build cache kapalı. Sürüm URL'si üretilen CSS, JavaScript modülleri ve Lato yazı tipleri için `_headers` bir yıllık `immutable` önbellek kullanıyor; bu adresler değişiklikte yeni sürüm alıyor. JSON verileri bir saat ve `stale-while-revalidate` ile; görseller ve indirmeler bir gün önbellekleniyor. Üst üste eşleşen Cache-Control kuralları yerine sürümlü dosyalarda kesin yollar kullanılıyor.
- Yayımlanan `public/` çıktısından 5.54 MB'lık kullanılmayan baskı manifesti, yıl haritası ve eski tasarım kataloğu çıkarıldı. Ana sayfanın tarayıcıya indirdiği tatil indeksi 109,626 bayttan 1,257 bayta düşürüldü; tasarım seçici artık ayrı katalog dosyası indirmiyor. Yerel `.build-cache/` ve `.jekyll-cache/` klasörleri de temizlendi. Pages build cache kapalı olduğu için Cloudflare tarafında temizlenecek eski bir derleme önbelleği yok; eski sürüm URL'leri yeni HTML'den çıkarıldığından tüm site önbelleğini boşaltmak gerekmedi.
- Cloudflare Observatory tek seferlik ölçümü iki sürümde de aynı Hamina, Finlandiya bölgesinde çalıştırıldı (2026-10-16; önceki run `06f96f7f-2d8f-4f2b-a682-1c45e77d7200`, canlı run `63c60d84-16ed-49a1-b1f8-b76eb3c1280e`). Masaüstünde LCP 552→501 ms (51 ms daha kısa), FCP 372→361 ms (11 ms daha kısa), TTFB 37→50 ms (13 ms daha uzun), TTI 575→581 ms (6 ms daha uzun), TBT 13→4 ms, Speed Index 864→859 ms; CLS 0.12 ve puan 96 kaldı. Mobilde LCP 2,438→2,417 ms (21 ms daha kısa), FCP 1,538→1,517 ms (21 ms daha kısa), TTFB 51→50 ms, TTI 2,605→2,619 ms (14 ms daha uzun), TBT 109→83 ms, Speed Index 2,251→1,965 ms (286 ms daha kısa); CLS 0.02 ve puan 97 kaldı. Her sürüm tek sentetik çalışmayla ölçüldüğünden küçük farklar ölçüm oynaklığı içinde olabilir; Speed Brain'in sayfalar arası etkisi ana sayfa Lighthouse testiyle ölçülmedi ve sonraki gerçek kullanıcı ölçümleriyle değerlendirilmelidir. Cloudflare Observatory ayrıca varlık URL’lerini tek tek belirtmeyen genel bir "Use efficient cache lifetimes" önerisi göstermeye devam etti; `_headers` yanıt kuralları Cloudflare derlemesinde 36 geçerli kural olarak ayrıştırıldı, ancak bu tek laboratuvar raporu önerinin tamamen kalktığını kanıtlamaz.








## Dağıtım ve geri alma








main dalına her push Cloudflare Pages üretim dağıtımı başlatır. Cloudflare Pages → Deployments bölümünde commit ve durumu kontrol edin; Build log içindeki hata mesajlarını inceleyin. Sorun giderirken son başarılı dağıtımı belirleyin, kaynağı düzeltip yeni commit gönderin veya Pages içinden bilinen başarılı dağıtıma geri alın. İşlemden sonra canlı sayfayı ve yanıt başlıklarını yeniden kontrol edin. Kimlik bilgilerini kaynak koduna veya build loglarına koymayın.








## DNS kurtarma








1. Hostinger'da kayıtlı nameserver'ların devin.ns.cloudflare.com ve rosa.ns.cloudflare.com olduğunu doğrulayın.
2. Cloudflare Overview'da zone'un etkin olduğunu kontrol edin. DNS değişikliklerinden sonra herkese yayılım zaman alabilir.
3. DNSSEC sorunu görülürse Hostinger DNSSEC alanları ve .lt registry DS bilgisi yeniden kontrol edilmeli; mevcut veride DS yok.
