var WHATSAPP_NUMBER = '905537721145';

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
var SLOT_STEP_MIN = 30;
var MAX_MONTHS_AHEAD = 2; // bugünün ayı + 2 ay ileri
// Müsaitlik ayarları (booking_availability) henüz yoksa veya çekilemezse kullanılan varsayılan.
var DEFAULT_AVAILABILITY = { is_open: true, start_time: '09:00:00', end_time: '19:00:00' };

function timeToMinutes(t) {
  var parts = t.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function buildDaySlotsForRange(startTime, endTime) {
  var startMin = timeToMinutes(startTime);
  var endMin = timeToMinutes(endTime);
  var slots = [];
  for (var m = startMin; m + SLOT_STEP_MIN <= endMin; m += SLOT_STEP_MIN) {
    var h = Math.floor(m / 60), mm = m % 60;
    slots.push((h < 10 ? '0' : '') + h + ':' + (mm === 0 ? '00' : mm));
  }
  return slots;
}

function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function toDateStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

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
    availability: {},
    blockedDates: {},
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

  // meeting_at UTC olarak saklanıyor; İstanbul yerel tarih/saatine çeviriyoruz.
  function isoToIstanbulDateTime(iso) {
    var d = new Date(iso);
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(d);
    var map = {};
    parts.forEach(function (p) { map[p.type] = p.value; });
    return { date: map.year + '-' + map.month + '-' + map.day, time: map.hour + ':' + map.minute };
  }

  function loadAvailability() {
    return supabaseClient.from('booking_availability').select('*')
      .then(function (res) {
        var map = {};
        (res.data || []).forEach(function (row) { map[row.weekday] = row; });
        for (var w = 0; w <= 6; w++) {
          if (!map[w]) map[w] = DEFAULT_AVAILABILITY;
        }
        return map;
      })
      .catch(function () {
        var map = {};
        for (var w = 0; w <= 6; w++) map[w] = DEFAULT_AVAILABILITY;
        return map;
      });
  }

  function loadBlockedDates() {
    return supabaseClient.from('booking_blocked_dates').select('blocked_date')
      .then(function (res) {
        var map = {};
        (res.data || []).forEach(function (row) { map[row.blocked_date] = true; });
        return map;
      })
      .catch(function () { return {}; });
  }

  function daySlotsForWeekday(weekday) {
    var rule = calState.availability[weekday] || DEFAULT_AVAILABILITY;
    if (!rule.is_open) return [];
    return buildDaySlotsForRange(rule.start_time, rule.end_time);
  }

  function loadBookingsForRange(startStr, endStr) {
    // UTC/İstanbul gün sınırı kayabileceği için sorgu aralığını bir gün geniş tutuyoruz.
    var queryStart = new Date(startStr + 'T00:00:00+03:00');
    queryStart.setUTCDate(queryStart.getUTCDate() - 1);
    var queryEnd = new Date(endStr + 'T23:59:59+03:00');
    queryEnd.setUTCDate(queryEnd.getUTCDate() + 1);

    return supabaseClient
      .from('panel_meetings')
      .select('meeting_at')
      .gte('meeting_at', queryStart.toISOString())
      .lte('meeting_at', queryEnd.toISOString())
      .then(function (res) {
        var map = {};
        (res.data || []).forEach(function (row) {
          if (!row.meeting_at) return;
          var parts = isoToIstanbulDateTime(row.meeting_at);
          if (!map[parts.date]) map[parts.date] = {};
          map[parts.date][parts.time] = true;
        });
        return map;
      })
      .catch(function () { return {}; });
  }

  function renderSlots(dateStr) {
    var weekday = new Date(dateStr + 'T00:00:00').getDay();
    var daySlots = daySlotsForWeekday(weekday);
    var taken = calState.bookings[dateStr] || {};
    slotGridEl.innerHTML = '';
    daySlots.forEach(function (t) {
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
      var daySlots = daySlotsForWeekday(d.getDay());
      var isClosed = daySlots.length === 0 || !!calState.blockedDates[dStr];
      var takenCount = calState.bookings[dStr] ? Object.keys(calState.bookings[dStr]).length : 0;
      var isFull = !isClosed && takenCount >= daySlots.length;
      var isSelected = calState.selectedDate === dStr && !isOtherMonth;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = d.getDate();
      var cls = 'cal-day';
      if (isOtherMonth) cls += ' is-other-month';
      else if (isPast) cls += ' is-past';
      else if (isClosed) cls += ' is-closed';
      else if (isFull) cls += ' is-full';
      else if (isSelected) cls += ' is-selected';
      btn.className = cls;
      btn.disabled = isOtherMonth || isPast || isClosed || isFull;

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

  Promise.all([loadAvailability(), loadBlockedDates()]).then(function (results) {
    calState.availability = results[0];
    calState.blockedDates = results[1];
    refreshMonth();
  });
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

    submitBtnEl.disabled = true;
    submitBtnEl.textContent = 'Gönderiliyor...';

    // CRM kaydı en iyi çaba (best-effort) — Supabase yüklenemese/başarısız olsa
    // bile ziyaretçi WhatsApp'a ulaşmalı, bu yüzden hiçbir hata burayı durdurmaz.
    function syncToCrm() {
      if (!supabaseClient) {
        console.error('CRM kayıt atlandı: Supabase istemcisi yüklenemedi.');
        return;
      }
      try {
        var meetingNote =
          'Firma: ' + firma + '\n' +
          'Telefon: ' + telefon + '\n' +
          'Şehir/İlçe: ' + sehir + '\n' +
          (isBayilik
            ? 'Apex360 ile iş birliği yaparak bayilik almak istiyor.'
            : 'Ekip: ' + ekip + ' · Araç: ' + arac);

        var meetingAtIso = new Date(tarih + 'T' + saat + ':00+03:00').toISOString();

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
          if (res.error) console.error('site_basvurulari kayıt hatası:', res.error);
        }).catch(function (err) {
          console.error('site_basvurulari istek hatası:', err);
        });

        supabaseClient.from('panel_meetings').insert({
          title: adSoyad + ' — ' + hizmet,
          meeting_at: meetingAtIso,
          note: meetingNote,
          participants: ['owner', 'huseyin', 'batuhan'],
          created_by: 'owner'
        }).then(function (res) {
          if (res.error) console.error('panel_meetings kayıt hatası:', res.error);
        }).catch(function (err) {
          console.error('panel_meetings istek hatası:', err);
        });
      } catch (err) {
        console.error('CRM kayıt beklenmeyen hata:', err);
      }
    }

    syncToCrm();

    (function proceedToWhatsapp() {
      var labelDate = new Date(tarih + 'T00:00:00');
      var labelStr = labelDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });

      var message =
        'Merhaba Apex360, "' + hizmet + '" için randevu talep ediyorum.\n\n' +
        'Ad Soyad: ' + adSoyad + '\n' +
        'Firma: ' + firma + '\n' +
        'Telefon: ' + telefon + '\n' +
        'Şehir/İlçe: ' + sehir + '\n' +
        'Görüşme Tarihi: ' + labelStr + '\n' +
        'Görüşme Saati: ' + saat + '\n';

      if (isBayilik) {
        message += '\nApex360 ile iş birliği yaparak bayilik almak istiyorum.';
      } else {
        message +=
          'Ekip Sayısı: ' + ekip + '\n' +
          'Servis Aracı: ' + arac + '\n\n' +
          'Ekibim ve aracım var, yeni müşteri kaldırabilecek kapasiteye sahibim.';
      }

      document.getElementById('successDate').textContent = labelStr + ' — ' + saat;
      leadForm.hidden = true;
      formSuccessEl.hidden = false;
      formSuccessEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(message), '_blank', 'noopener');
    })();
  });
}
