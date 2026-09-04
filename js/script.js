// CRM'e (apexreklam Supabase projesi, site_basvurulari tablosu) kayıt
var SUPABASE_URL = 'https://eibxqlupbrhanfllzqeb.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpYnhxbHVwYnJoYW5mbGx6cWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMTM0MDMsImV4cCI6MjA5OTg4OTQwM30.0ZIaF47FMCGLlAy7n8lmyilgeV8BNwRxu4A096L4sHw';
var supabaseClient = (window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

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

// Prevent picking a past date for the meeting
var tarihInput = document.getElementById('tarih');
if (tarihInput) {
  tarihInput.min = new Date().toISOString().split('T')[0];
}

// Service CTA cards -> preselect hizmet type in the form
var hizmetSelect = document.getElementById('hizmet');
var qualifyFields = document.querySelectorAll('.qualify-fields');
var bayilikFields = document.querySelectorAll('.bayilik-fields');

function toggleHizmetFields() {
  if (!hizmetSelect) return;
  var isBayilik = hizmetSelect.value === 'Bayilik';
  qualifyFields.forEach(function (el) { el.hidden = isBayilik; });
  bayilikFields.forEach(function (el) { el.hidden = !isBayilik; });
  var uygunOnay = document.getElementById('uygunOnay');
  var bayilikOnay = document.getElementById('bayilikOnay');
  if (uygunOnay) uygunOnay.required = !isBayilik;
  if (bayilikOnay) bayilikOnay.required = isBayilik;
}

document.querySelectorAll('.service-cta-card').forEach(function (card) {
  card.addEventListener('click', function () {
    if (!hizmetSelect) return;
    hizmetSelect.value = card.getAttribute('data-hizmet');
    toggleHizmetFields();
  });
});

if (hizmetSelect) {
  hizmetSelect.addEventListener('change', toggleHizmetFields);
  toggleHizmetFields();
}

// Lead form -> WhatsApp
var leadForm = document.getElementById('leadForm');
if (leadForm) {
  leadForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var hizmet = hizmetSelect.value;
    var adSoyad = document.getElementById('adSoyad').value.trim();
    var firma = document.getElementById('firma').value.trim();
    var telefon = document.getElementById('telefon').value.trim();
    var sehir = document.getElementById('sehir').value.trim();
    var tarih = document.getElementById('tarih').value;
    var saat = document.getElementById('saat').value;
    var isBayilik = hizmet === 'Bayilik';
    var ekip = isBayilik ? null : document.getElementById('ekip').value;
    var arac = isBayilik ? null : document.getElementById('arac').value;

    var message =
      'Merhaba Apex360, "' + hizmet + '" için görüşme talep ediyorum.\n\n' +
      'Ad Soyad: ' + adSoyad + '\n' +
      'Firma: ' + firma + '\n' +
      'Telefon: ' + telefon + '\n' +
      'Şehir/İlçe: ' + sehir + '\n' +
      'Görüşme Tarihi: ' + tarih + '\n' +
      'Görüşme Saati: ' + saat + '\n';

    if (isBayilik) {
      message += '\nApex360 ile iş birliği yaparak bayilik almak istiyorum.';
    } else {
      message +=
        'Ekip Sayısı: ' + ekip + '\n' +
        'Servis Aracı: ' + arac + '\n\n' +
        'Ekibim ve aracım var, yeni müşteri kaldırabilecek kapasiteye sahibim.';
    }

    if (supabaseClient) {
      supabaseClient.from('site_basvurulari').insert({
        hizmet: hizmet,
        ad_soyad: adSoyad,
        firma: firma,
        telefon: telefon,
        sehir: sehir,
        gorusme_tarihi: tarih || null,
        gorusme_saati: saat || null,
        ekip_sayisi: ekip,
        servis_araci: arac
      }).then(function (res) {
        if (res.error) console.error('CRM kayıt hatası:', res.error);
      });
    }

    var whatsappUrl = 'https://wa.me/908508407245?text=' + encodeURIComponent(message);
    window.open(whatsappUrl, '_blank', 'noopener');
  });
}
