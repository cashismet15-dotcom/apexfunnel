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

// ---------- BOOKING CALENDAR ----------
var SLOT_START_MIN = 9 * 60; // 09:00
var SLOT_END_MIN = 18 * 60 + 30; // last bookable start time 18:30
var SLOT_STEP_MIN = 30;
var MAX_MONTHS_AHEAD = 2; // bugünün ayı + 2 ay ileri

function buildDaySlots() {
  var slots = [];
  for (var m = SLOT_START_MIN; m <= SLOT_END_MIN; m += SLOT_STEP_MIN) {
    var h = Math.floor(m / 60), mm = m % 60;
    slots.push((h < 10 ? '0' : '') + h + ':' + (mm === 0 ? '00' : mm));
  }
  return slots;
}
var ALL_SLOTS = buildDaySlots();

function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function toDateStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

function getMonthGridDates(year, month) {
  var firstOfMonth = new Date(year, month, 1);
  var startOffset = (firstOfMonth.getDay() + 6) % 7; // Pazartesi = 0
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  var dates = [];
  for (var i = 0; i < totalCells; i++) {
    dates.push(new Date(year, month, 1 - startOffset + i));
  }
  return dates;
}

var calEl = document.getElementById('bookingCalendar');
if (calEl && supabaseClient) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var calState = {
    year: today.getFullYear(),
    month: today.getMonth(),
    bookings: {},
    selectedDate: null,
    selectedTime: null
  };

  var calDaysEl = document.getElementById('calDays');
  var calMonthLabelEl = document.getElementById('calMonthLabel');
  var calPrevBtn = document.getElementById('calPrev');
  var calNextBtn = document.getElementById('calNext');
  var timeSlotsEl = document.getElementById('timeSlots');
  var slotGridEl = document.getElementById('slotGrid');
  var selectedDateLabelEl = document.getElementById('selectedDateLabel');
  var tarihField = document.getElementById('tarih');
  var saatField = document.getElementById('saat');
  var calendarErrorEl = document.getElementById('calendarError');

  var MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  function loadBookingsForRange(startStr, endStr) {
    return supabaseClient
      .from('site_basvurulari')
      .select('gorusme_tarihi,gorusme_saati')
      .gte('gorusme_tarihi', startStr)
      .lte('gorusme_tarihi', endStr)
      .then(function (res) {
        var map = {};
        (res.data || []).forEach(function (row) {
          if (!row.gorusme_tarihi || !row.gorusme_saati) return;
          if (!map[row.gorusme_tarihi]) map[row.gorusme_tarihi] = {};
          map[row.gorusme_tarihi][row.gorusme_saati] = true;
        });
        return map;
      })
      .catch(function () { return {}; });
  }

  function renderSlots(dateStr) {
    var taken = calState.bookings[dateStr] || {};
    slotGridEl.innerHTML = '';
    ALL_SLOTS.forEach(function (t) {
      var isTaken = !!taken[t];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot-btn' + (calState.selectedTime === t ? ' is-selected' : '');
      btn.textContent = t;
      btn.disabled = isTaken;
      if (!isTaken) {
        btn.addEventListener('click', function () {
          calState.selectedTime = t;
          tarihField.value = dateStr;
          saatField.value = t;
          calendarErrorEl.hidden = true;
          renderSlots(dateStr);
        });
      }
      slotGridEl.appendChild(btn);
    });
    timeSlotsEl.hidden = false;
    var labelDate = new Date(dateStr + 'T00:00:00');
    selectedDateLabelEl.textContent = labelDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
  }

  function renderCalendarGrid() {
    var dates = getMonthGridDates(calState.year, calState.month);
    calMonthLabelEl.textContent = MONTH_NAMES[calState.month] + ' ' + calState.year;
    calDaysEl.innerHTML = '';

    dates.forEach(function (d) {
      var isOtherMonth = d.getMonth() !== calState.month;
      var isPast = d < today;
      var dStr = toDateStr(d);
      var takenCount = calState.bookings[dStr] ? Object.keys(calState.bookings[dStr]).length : 0;
      var isFull = takenCount >= ALL_SLOTS.length;
      var isSelected = calState.selectedDate === dStr && !isOtherMonth;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = d.getDate();
      var cls = 'cal-day';
      if (isOtherMonth) cls += ' is-other-month';
      else if (isPast) cls += ' is-past';
      else if (isFull) cls += ' is-full';
      else if (isSelected) cls += ' is-selected';
      btn.className = cls;
      btn.disabled = isOtherMonth || isPast || isFull;

      if (!btn.disabled) {
        btn.addEventListener('click', function () {
          calState.selectedDate = dStr;
          calState.selectedTime = null;
          saatField.value = '';
          renderCalendarGrid();
          renderSlots(dStr);
        });
      }
      calDaysEl.appendChild(btn);
    });

    var isCurrentMonth = calState.year === today.getFullYear() && calState.month === today.getMonth();
    calPrevBtn.disabled = isCurrentMonth;
    var monthsAhead = (calState.year - today.getFullYear()) * 12 + (calState.month - today.getMonth());
    calNextBtn.disabled = monthsAhead >= MAX_MONTHS_AHEAD;
  }

  function refreshMonth() {
    var dates = getMonthGridDates(calState.year, calState.month);
    var startStr = toDateStr(dates[0]);
    var endStr = toDateStr(dates[dates.length - 1]);
    return loadBookingsForRange(startStr, endStr).then(function (map) {
      calState.bookings = map;
      renderCalendarGrid();
    });
  }

  calPrevBtn.addEventListener('click', function () {
    if (calPrevBtn.disabled) return;
    calState.month -= 1;
    if (calState.month < 0) { calState.month = 11; calState.year -= 1; }
    calState.selectedDate = null;
    calState.selectedTime = null;
    tarihField.value = '';
    saatField.value = '';
    timeSlotsEl.hidden = true;
    refreshMonth();
  });
  calNextBtn.addEventListener('click', function () {
    if (calNextBtn.disabled) return;
    calState.month += 1;
    if (calState.month > 11) { calState.month = 0; calState.year += 1; }
    calState.selectedDate = null;
    calState.selectedTime = null;
    tarihField.value = '';
    saatField.value = '';
    timeSlotsEl.hidden = true;
    refreshMonth();
  });

  refreshMonth();
}

// Randevu formu -> CRM (Supabase)
var leadForm = document.getElementById('leadForm');
var formSuccessEl = document.getElementById('formSuccess');
var submitBtnEl = document.getElementById('submitBtn');

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

    var calendarErrorEl = document.getElementById('calendarError');
    if (!tarih || !saat) {
      calendarErrorEl.hidden = false;
      document.getElementById('bookingCalendar').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    calendarErrorEl.hidden = true;

    if (!supabaseClient) return;

    submitBtnEl.disabled = true;
    submitBtnEl.textContent = 'Gönderiliyor...';

    supabaseClient.from('site_basvurulari').insert({
      hizmet: hizmet,
      ad_soyad: adSoyad,
      firma: firma,
      telefon: telefon,
      sehir: sehir,
      gorusme_tarihi: tarih,
      gorusme_saati: saat,
      ekip_sayisi: ekip,
      servis_araci: arac
    }).then(function (res) {
      if (res.error) {
        console.error('CRM kayıt hatası:', res.error);
        submitBtnEl.disabled = false;
        submitBtnEl.textContent = 'Randevu Talebimi Gönder';
        alert('Bir sorun oluştu, lütfen tekrar deneyin ya da WhatsApp\'tan yazın: 0850 840 72 45');
        return;
      }
      var labelDate = new Date(tarih + 'T00:00:00');
      document.getElementById('successDate').textContent =
        labelDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }) + ' — ' + saat;
      leadForm.hidden = true;
      formSuccessEl.hidden = false;
      formSuccessEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
}
