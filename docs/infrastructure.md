# Altyapı ve kurtarma notları


## Servis sahipliği


- Domain kaydı ve yenilemesi Hostinger'da kalır; alan adı Cloudflare'a aktarılmadı.
- Kaynak kodu özel GitHub deposunda: https://github.com/mateopedersen/kalendorius365, üretim dalı main.
- Barındırma ve CDN: Cloudflare Pages projesi kalendorius365, Free plan.
- Yetkili DNS: Cloudflare zone kalendorius365.lt; Hostinger'da Cloudflare'ın atadığı nameserver'lar kullanılıyor.


## Doğrulanmış durum — 2026-10-15


- GitHub deposu private ve main dalı mevcut. Cloudflare Workers and Pages GitHub App erişimi yalnızca bu depoyla sınırlı.
- Pages, mateopedersen/kalendorius365 deposuna yerleşik Git entegrasyonuyla bağlı. Üretim dalı main, framework ayarı None, build komutu boş, çıktı klasörü public; otomatik dağıtımlar etkin.
- Pages projesi: https://kalendorius365.pages.dev/ . Geçici sayfa HTTPS üzerinden 200 dönüyor ve “Kalendorius365 / Svetainė ruošiama.” metnini gösteriyor.
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
- Pages Custom Domains ekranında kalendorius365.lt Active ve SSL enabled. www.kalendorius365.lt en son kontrolde Verifying görünüyordu; DNS doğrulaması yeniden başlatıldı. Canlı testte HTTP ve HTTPS www adresleri kök HTTPS adresine 301 ile yönlendi; www TLS yanıtı da başarılıydı.
- Cloudflare Always Use HTTPS açık. HSTS ve HSTS preload açılmadı. Aktif WWW-to-root 301 kuralı yolu ve sorgu parametrelerini koruyor.
- Canlı kontroller: https://kalendorius365.lt/ 200; http://kalendorius365.lt/ 301 → HTTPS; http://www.kalendorius365.lt/redirect-check?verify=1 ve https://www.kalendorius365.lt/redirect-check?verify=1 301 → https://kalendorius365.lt/redirect-check?verify=1 ve son yanıt 200.
- Canlı HTTP yanıtlarında hem kök alan adı hem de pages.dev için X-Robots-Tag: noindex doğrulandı. Geçici siteyi arama motorlarına göndermeyin. Gerçek site yayımlanmaya hazır olduğunda bu kuralı kaldırıp canlı başlığı yeniden kontrol edin.
- Geçici HTML sayfasında mobil viewport meta etiketi, esnek genişlik ve clamp() tabanlı boyutlar bulunuyor. Ayrı bir cihaz emülasyonu testi yapılmadı; gerçek site geliştirilirken mobil görünümü ayrıca doğrulayın.


## Dağıtım ve geri alma


main dalına her push Cloudflare Pages üretim dağıtımı başlatır. Cloudflare Pages → Deployments bölümünde commit ve durumu kontrol edin; Build log içindeki hata mesajlarını inceleyin. Sorun giderirken son başarılı dağıtımı belirleyin, kaynağı düzeltip yeni commit gönderin veya Pages içinden bilinen başarılı dağıtıma geri alın. İşlemden sonra canlı sayfayı ve yanıt başlıklarını yeniden kontrol edin. Kimlik bilgilerini kaynak koduna veya build loglarına koymayın.


## DNS kurtarma


1. Hostinger'da kayıtlı nameserver'ların devin.ns.cloudflare.com ve rosa.ns.cloudflare.com olduğunu doğrulayın.
2. Cloudflare Overview'da zone'un etkin olduğunu kontrol edin. DNS değişikliklerinden sonra herkese yayılım zaman alabilir.
3. DNSSEC sorunu görülürse Hostinger DNSSEC alanları ve .lt registry DS bilgisi yeniden kontrol edilmeli; mevcut veride DS yok.
4. Cloudflare DNS'de kök CNAME kalendorius365.pages.dev, www CNAME kalendorius365.pages.dev olmalı ve ikisi proxied kalmalı. Eski park A kaydını geri eklemeyin.
5. E-posta için MX veya kimlik doğrulama kayıtlarını yalnızca seçilen posta sağlayıcısının yönergelerinden alın.
6. Pages Custom Domains ekranında her iki alan adının durumunu ve SSL durumunu kontrol edin. www doğrulaması tamamlanmazsa sayfadaki DNS yönergeleriyle CNAME www → kalendorius365.pages.dev kaydını karşılaştırın.


## Ruby/Jekyll geçişi


Aynı GitHub deposunu ve Pages projesini kullanın. Jekyll kaynaklarını ve bağımlılıklarını ekledikten sonra desteklenen Jekyll build komutunu ve çıktı klasörü olarak _site ayarlayın. Üretime geçmeden önce preview dağıtımını, Litvanca UTF-8 metni, varlıkları, indirme bağlantılarını ve yanıt başlıklarını kontrol edin. Statik Jekyll sitesi için veritabanı veya ücretli hosting gerekmez.


## Genel yayına çıkış listesi


- [ ] Gerçek site hazır olduğunda noindex kuralını kaldırın; kök alan adı ve pages.dev için canlı başlığı kontrol edin.
- [ ] www alan adının Pages doğrulamasının tamamlandığını ve SSL durumunun etkin olduğunu doğrulayın.
- [ ] Üretim sayfalarında 200, HTTP → HTTPS ve www → kök 301 davranışını; yol ve sorgu korumasıyla tekrar kontrol edin.
- [ ] Gerçek site hazır olduğunda mobil görünümü ayrıca test edin.
- [ ] E-posta kullanılacaksa posta sağlayıcısının DNS kayıtlarını kurun ve e-posta alım/gönderimini sınayın.
- [ ] Üretim dağıtımı, commit ve geri alma notlarını güncel tutun.

