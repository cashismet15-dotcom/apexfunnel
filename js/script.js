// Click-to-play video cards (avoids loading all videos upfront)
document.querySelectorAll('.video-card').forEach(function (card) {
  card.addEventListener('click', function () {
    if (card.classList.contains('playing')) return;
    var src = card.getAttribute('data-src');
    var video = document.createElement('video');
    video.src = src;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    card.appendChild(video);
    card.classList.add('playing');
  });
});

// Lead form -> WhatsApp
var leadForm = document.getElementById('leadForm');
if (leadForm) {
  leadForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var adSoyad = document.getElementById('adSoyad').value.trim();
    var firma = document.getElementById('firma').value.trim();
    var telefon = document.getElementById('telefon').value.trim();
    var sehir = document.getElementById('sehir').value.trim();
    var ekip = document.getElementById('ekip').value;
    var arac = document.getElementById('arac').value;

    var message =
      'Merhaba Apex360, ücretsiz ön görüşme için başvuruyorum.\n\n' +
      'Ad Soyad: ' + adSoyad + '\n' +
      'Firma: ' + firma + '\n' +
      'Telefon: ' + telefon + '\n' +
      'Şehir/İlçe: ' + sehir + '\n' +
      'Ekip Sayısı: ' + ekip + '\n' +
      'Servis Aracı: ' + arac + '\n\n' +
      'Ekibim ve aracım var, yeni müşteri kaldırabilecek kapasiteye sahibim.';

    var whatsappUrl = 'https://wa.me/908508407245?text=' + encodeURIComponent(message);
    window.open(whatsappUrl, '_blank', 'noopener');
  });
}
