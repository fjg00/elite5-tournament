/* ===== Elite 5 — registration wizard + urgency tracker ===== */
(function () {
  'use strict';

  var MIN_PLAYERS = 5;
  var MAX_PLAYERS = 8;
  var TOTAL_SPOTS = 8;
  var WAITLIST_MAX = 3;
  var HARD_CAP = TOTAL_SPOTS + WAITLIST_MAX; // 11: 8 spots + 3 waitlist
  var STORAGE_KEY = 'elite5_registrations';
  var SETTINGS_KEY = 'elite5_settings';

  // Supabase (cloud mode). Falls back to this-browser-only storage when
  // supabase-config.js is not filled in yet.
  var sb = null;
  try {
    if (window.ELITE5_SUPABASE_URL && window.ELITE5_SUPABASE_ANON_KEY && window.supabase) {
      // persistSession:false — the public page must always act as an anonymous
      // visitor, even if the organizer is logged in to admin.html in this browser
      sb = window.supabase.createClient(window.ELITE5_SUPABASE_URL, window.ELITE5_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } });
    }
  } catch (e) { sb = null; }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Footer year
  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile nav
  var toggle = $('#nav-toggle');
  var links = $('#nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () { links.classList.toggle('open'); });
    $$('a', links).forEach(function (a) { a.addEventListener('click', function () { links.classList.remove('open'); }); });
  }

  /* ---------- Shared state (from cloud or local fallback) ---------- */
  var teamCount = 0;
  var takenList = [];
  var registrationOpen = true;

  function localRegs() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; } }
  function localSettings() { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (e) { return {}; } }

  function updateTrackerUI() {
    var count = Math.min(teamCount, TOTAL_SPOTS);
    var left = TOTAL_SPOTS - count;
    var countEl = $('#tracker-count');
    var fillEl = $('#tracker-fill');
    var noteEl = $('#tracker-note');
    if (countEl) countEl.textContent = count;
    if (fillEl) fillEl.style.width = (count / TOTAL_SPOTS * 100) + '%';
    if (noteEl) {
      var wlLeft = HARD_CAP - Math.min(teamCount, HARD_CAP);
      if (!registrationOpen) { noteEl.textContent = 'Registration is currently closed.'; noteEl.classList.add('hot'); }
      else if (teamCount >= HARD_CAP) { noteEl.textContent = 'All spots and the waitlist are full.'; noteEl.classList.add('hot'); }
      else if (teamCount >= TOTAL_SPOTS) { noteEl.textContent = 'Main spots full — ' + wlLeft + ' waitlist spot' + (wlLeft === 1 ? '' : 's') + ' left.'; noteEl.classList.add('hot'); }
      else if (left <= 3) { noteEl.textContent = 'Only ' + left + ' spot' + (left === 1 ? '' : 's') + ' left. Going fast.'; noteEl.classList.add('hot'); }
      else { noteEl.textContent = left + ' of ' + TOTAL_SPOTS + ' spots still open.'; noteEl.classList.remove('hot'); }
    }
  }

  function applyOpenState() {
    var regForm = $('#registration-form');
    if (!regForm) return;
    var full = teamCount >= HARD_CAP;              // spots AND waitlist full
    var onWaitlist = teamCount >= TOTAL_SPOTS && !full;
    var blocked = !registrationOpen || full;
    var panel = $('#reg-closed');

    if (blocked) {
      regForm.style.display = 'none';
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'reg-closed';
        panel.className = 'reg-form reg-closed';
        regForm.parentElement.appendChild(panel);
      }
      panel.innerHTML =
        '<h3 class="step-title">' + (full ? 'Registration is full' : 'Registration is closed') + '</h3>' +
        '<p class="step-hint">' + (full ? 'All 8 spots and the 3 waitlist places are taken. Follow us for the next edition.' : 'Check back soon — registration will reopen.') + '</p>';
    } else {
      regForm.style.display = '';
      if (panel) panel.remove();
    }

    updateJerseyField(onWaitlist);

    // Waitlist notice above the form
    var wl = $('#waitlist-banner');
    if (onWaitlist && !blocked) {
      if (!wl) {
        wl = document.createElement('div');
        wl.id = 'waitlist-banner';
        wl.className = 'waitlist-note';
        regForm.parentElement.insertBefore(wl, regForm);
      }
      var wlLeft = HARD_CAP - teamCount;
      wl.innerHTML = '<strong>The 8 main spots are full.</strong> You can still register to join the <strong>waitlist</strong> — ' +
        wlLeft + ' of ' + WAITLIST_MAX + ' places left. If a spot opens up, waitlisted teams get called first.';
    } else if (wl) {
      wl.remove();
    }
  }

  function refreshRemote() {
    if (sb) {
      return Promise.all([
        sb.rpc('team_count'),
        sb.rpc('taken_colors'),
        sb.from('settings').select('registration_open').eq('id', 1).single()
      ]).then(function (r) {
        if (typeof r[0].data === 'number') teamCount = r[0].data;
        if (r[1].data) takenList = r[1].data;
        if (r[2].data) registrationOpen = !!r[2].data.registration_open;
        updateTrackerUI(); buildColors(); applyOpenState();
      }).catch(function () { updateTrackerUI(); buildColors(); applyOpenState(); });
    }
    // local fallback
    var regs = localRegs();
    teamCount = regs.length;
    takenList = regs.map(function (r) { return r.team && r.team.jerseyColor; }).filter(Boolean);
    registrationOpen = localSettings().registration_open !== false;
    updateTrackerUI(); buildColors(); applyOpenState();
    return Promise.resolve();
  }

  /* ---------- Jersey color (first come, first served) ---------- */
  var JERSEY_COLORS = [
    { n: 'Red', h: '#e11d2a' }, { n: 'Blue', h: '#1e5cff' }, { n: 'Green', h: '#16a34a' },
    { n: 'Yellow', h: '#f5c518' }, { n: 'Orange', h: '#f97316' }, { n: 'Purple', h: '#7c3aed' },
    { n: 'Black', h: '#111111' }, { n: 'White', h: '#ffffff' }
  ];
  var picker = $('#color-picker');
  var jerseyInput = $('#jerseyColor');
  var jerseyWaitlist = false; // set true when the 8 colors are gone (waitlist mode)

  function updateJerseyField(onWaitlist) {
    jerseyWaitlist = !!onWaitlist;
    if (!picker) return;
    var field = picker.parentElement;
    var req = field.querySelector('label .req');
    var hint = field.querySelector('.field-hint');
    var note = field.querySelector('#jersey-wl-note');
    if (onWaitlist) {
      if (req) req.style.display = 'none';
      if (hint) hint.style.display = 'none';
      jerseyInput.value = '';
      picker.classList.remove('invalid');
      if (!note) {
        note = document.createElement('p');
        note.id = 'jersey-wl-note';
        note.className = 'field-hint';
        field.insertBefore(note, jerseyInput);
      }
      note.textContent = 'All colors are taken by the 8 main teams. Waitlist teams get a color assigned if a spot opens — just continue.';
    } else {
      if (req) req.style.display = '';
      if (hint) hint.style.display = '';
      if (note) note.remove();
    }
  }

  function buildColors() {
    if (!picker) return;
    picker.innerHTML = '';
    JERSEY_COLORS.forEach(function (c) {
      var isTaken = takenList.indexOf(c.n) !== -1;
      var opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'color-opt' + (isTaken ? ' taken' : '') + (jerseyInput.value === c.n && !isTaken ? ' selected' : '');
      opt.setAttribute('aria-label', c.n + (isTaken ? ' (taken)' : ''));
      opt.innerHTML = '<span class="swatch" style="background:' + c.h + '"></span><span class="cname">' + c.n + '</span>';
      if (isTaken) { opt.disabled = true; if (jerseyInput.value === c.n) jerseyInput.value = ''; }
      else opt.addEventListener('click', function () {
        $$('.color-opt', picker).forEach(function (o) { o.classList.remove('selected'); });
        opt.classList.add('selected');
        jerseyInput.value = c.n;
        picker.classList.remove('invalid');
      });
      picker.appendChild(opt);
    });
  }

  /* ---------- Photo helpers (shrink for fast mobile uploads) ---------- */
  function readAndShrink(file, cb) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var max = 800, w = img.width, h = img.height;
        var s = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * s));
        c.height = Math.max(1, Math.round(h * s));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { cb(e.target.result); };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
  function dataURLtoBlob(durl) {
    var arr = durl.split(','), mime = arr[0].match(/:(.*?);/)[1];
    var bstr = atob(arr[1]), n = bstr.length, u8 = new Uint8Array(n);
    while (n--) u8[n] = bstr.charCodeAt(n);
    return new Blob([u8], { type: mime });
  }

  /* ---------- Squad: add players one at a time ---------- */
  var roster = [];
  var rosterEl = $('#roster');
  var rosterCountEl = $('#roster-count');
  var addCard = $('#add-card');
  var addToRosterBtn = $('#add-to-roster');
  var addStatus = $('#add-status');
  var npName = $('.np-name'), npDob = $('.np-dob'), npIg = $('.np-instagram');
  var npPhotoInput = $('.np-photo'), npPreview = $('.np-preview');
  var npPlaceholder = addCard ? $('.photo-placeholder', addCard) : null;
  var pendingPhoto = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function setAddStatus(msg, type) { if (!addStatus) return; addStatus.textContent = msg || ''; addStatus.className = 'form-status' + (type ? ' ' + type : ''); }

  if (npPhotoInput) npPhotoInput.addEventListener('change', function () {
    var file = npPhotoInput.files[0]; if (!file) return;
    readAndShrink(file, function (durl) {
      pendingPhoto = durl;
      npPreview.src = durl; npPreview.hidden = false;
      if (npPlaceholder) npPlaceholder.style.display = 'none';
    });
  });

  function renderRoster() {
    if (!rosterEl) return;
    rosterEl.innerHTML = '';
    roster.forEach(function (p, idx) {
      var row = document.createElement('div');
      row.className = 'roster-row' + (p.isCaptain ? ' is-captain' : '');
      row.innerHTML =
        (p.photo ? '<img class="roster-photo" src="' + p.photo + '" alt="">' : '<span class="roster-photo roster-nophoto">?</span>') +
        '<div class="roster-info"><div class="roster-name">' + esc(p.name) + (p.isCaptain ? ' <span class="cap-tag">Captain</span>' : '') + '</div>' +
        '<div class="roster-sub">' + esc(p.dob) + (p.instagram ? ' · ' + esc(p.instagram) : '') + '</div></div>' +
        '<button type="button" class="roster-cap" title="Set as captain" aria-label="Set as captain"><svg class="ico ico-sm ico-fill"><use href="#i-star"/></svg></button>' +
        '<button type="button" class="roster-del" title="Remove player" aria-label="Remove player"><svg class="ico ico-sm" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
      row.querySelector('.roster-cap').addEventListener('click', function () { setCaptain(idx); });
      row.querySelector('.roster-del').addEventListener('click', function () { removeFromRoster(idx); });
      rosterEl.appendChild(row);
    });
    if (rosterCountEl) rosterCountEl.textContent = roster.length;
    if (addToRosterBtn) {
      var full = roster.length >= MAX_PLAYERS;
      addToRosterBtn.disabled = full;
      addToRosterBtn.textContent = full ? 'Squad full (8 max)' : '+ Add player to squad';
      if (addCard) addCard.classList.toggle('hidden', full);
    }
  }
  function setCaptain(idx) { roster.forEach(function (p, i) { p.isCaptain = (i === idx); }); renderRoster(); }
  function removeFromRoster(idx) { var wasCap = roster[idx].isCaptain; roster.splice(idx, 1); if (wasCap && roster.length) roster[0].isCaptain = true; renderRoster(); }
  function clearAddForm() {
    npName.value = ''; npDob.value = ''; npIg.value = ''; pendingPhoto = null;
    npPreview.hidden = true; npPreview.removeAttribute('src'); if (npPlaceholder) npPlaceholder.style.display = '';
    npPhotoInput.value = ''; npName.classList.remove('invalid'); npDob.classList.remove('invalid');
  }
  if (addToRosterBtn) addToRosterBtn.addEventListener('click', function () {
    if (roster.length >= MAX_PLAYERS) return;
    var name = npName.value.trim(), dob = npDob.value;
    var nameBad = !name, dobBad = !dobInRange(dob);
    npName.classList.toggle('invalid', nameBad);
    npDob.classList.toggle('invalid', dobBad);
    if (nameBad || dobBad) {
      setAddStatus(nameBad ? 'Enter the player\'s name.' : 'Date of birth must be 2009–2011.', 'error');
      return;
    }
    roster.push({ name: name, dob: dob, instagram: npIg.value.trim(), photo: pendingPhoto, isCaptain: roster.length === 0 });
    clearAddForm();
    setAddStatus('');
    renderRoster();
    npName.focus();
  });
  renderRoster();

  /* ---------- Wizard ---------- */
  var form = $('#registration-form');
  var statusEl = $('#form-status');
  var steps = $$('.form-step', form);
  var dots = $$('.step-dot');
  var progressFill = $('#steps-progress-fill');
  var current = 1;
  var TOTAL_STEPS = 4;

  function setStatus(msg, type) { if (!statusEl) return; statusEl.textContent = msg || ''; statusEl.className = 'form-status' + (type ? ' ' + type : ''); }
  function markInvalid(el, bad) { if (el) el.classList.toggle('invalid', !!bad); }
  function dobInRange(v) { if (!v) return false; var y = new Date(v).getFullYear(); return y >= 2009 && y <= 2011; }

  function showStep(n) {
    current = n;
    steps.forEach(function (s) { s.classList.toggle('active', +s.dataset.step === n); });
    dots.forEach(function (d) {
      var dn = +d.dataset.dot;
      d.classList.toggle('active', dn === n);
      d.classList.toggle('done', dn < n);
    });
    if (progressFill) progressFill.style.width = ((n - 1) / (TOTAL_STEPS - 1) * 100) + '%';
    setStatus('');
    var top = $('#register');
    if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function validateStep(n) {
    setStatus('');
    if (n === 1) {
      var ok = true;
      var tn = $('#teamName'); var tnBad = !tn.value.trim(); markInvalid(tn, tnBad); if (tnBad) ok = false;
      if (!jerseyWaitlist) {
        if (!jerseyInput.value) { ok = false; if (picker) picker.classList.add('invalid'); } else if (picker) picker.classList.remove('invalid');
      } else if (picker) { picker.classList.remove('invalid'); }
      if (!ok) setStatus(tnBad ? 'Enter your team name.' : 'Pick a jersey color.', 'error');
      return ok;
    }
    if (n === 2) {
      var ok2 = true;
      ['captainName', 'captainPhone', 'captainEmail'].forEach(function (id) { var el = $('#' + id); var bad = !el.value.trim(); markInvalid(el, bad); if (bad) ok2 = false; });
      var email = $('#captainEmail');
      if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) { markInvalid(email, true); ok2 = false; setStatus('Enter a valid email address.', 'error'); return ok2; }
      if (!ok2) setStatus('Fill in the captain name, phone and email.', 'error');
      return ok2;
    }
    if (n === 3) return validateSquad().ok;
    return true;
  }

  function validateSquad() {
    var ok = true, firstErr = '';
    if (roster.length < MIN_PLAYERS) { ok = false; firstErr = 'Add at least ' + MIN_PLAYERS + ' players (you have ' + roster.length + ').'; }
    else if (!roster.some(function (p) { return p.isCaptain; })) { ok = false; firstErr = 'Tap a star to choose your captain.'; }
    if (!$('#agree').checked) { ok = false; if (!firstErr) firstErr = 'Please confirm the eligibility statement.'; }
    if (!ok) setStatus(firstErr, 'error');
    return { ok: ok, players: roster };
  }

  $$('.next-step', form).forEach(function (b) { b.addEventListener('click', function () { if (validateStep(current)) showStep(current + 1); }); });
  $$('.prev-step', form).forEach(function (b) { b.addEventListener('click', function () { showStep(current - 1); }); });

  /* ---------- Submit ---------- */
  function submitCloud(reg) {
    var players = [];
    var chain = Promise.resolve();
    reg.players.forEach(function (p, i) {
      chain = chain.then(function () {
        var entry = { name: p.name, dob: p.dob, instagram: p.instagram, is_captain: p.isCaptain, photo_path: null };
        players.push(entry);
        if (!p.photo) return;
        var path = reg.id + '/' + (i + 1) + '.jpg';
        return sb.storage.from('player-photos')
          .upload(path, dataURLtoBlob(p.photo), { contentType: 'image/jpeg' })
          .then(function (up) {
            if (up.error) throw up.error;
            entry.photo_path = path;
          });
      });
    });
    return chain.then(function () {
      return sb.from('registrations').insert({
        id: reg.id,
        team_name: reg.team.name,
        jersey_color: reg.team.jerseyColor,
        captain_name: reg.captainContact.name,
        captain_phone: reg.captainContact.phone,
        captain_email: reg.captainContact.email,
        players: players
      });
    }).then(function (ins) { if (ins.error) throw ins.error; });
  }

  function afterSubmit(reg) {
    var myNumber = teamCount + 1;          // this team's overall position
    teamCount = myNumber;
    if (reg.team.jerseyColor) takenList.push(reg.team.jerseyColor);
    updateTrackerUI();
    applyOpenState();
    renderSuccess(reg, myNumber);
    showStep(4);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var res = validateSquad();
    if (!res.ok) return;

    var reg = {
      id: 'E5-' + Date.now(),
      submittedAt: new Date().toISOString(),
      team: { name: $('#teamName').value.trim(), jerseyColor: jerseyInput.value },
      captainContact: { name: $('#captainName').value.trim(), phone: $('#captainPhone').value.trim(), email: $('#captainEmail').value.trim() },
      players: res.players.map(function (p) { return { name: p.name, dob: p.dob, instagram: p.instagram, isCaptain: p.isCaptain, photo: p.photo }; })
    };

    if (sb) {
      var btn = form.querySelector('.btn-submit');
      btn.disabled = true;
      setStatus('Submitting your team…');
      submitCloud(reg).then(function () {
        btn.disabled = false;
        setStatus('');
        afterSubmit(reg);
      }).catch(function (err) {
        btn.disabled = false;
        var m = String((err && (err.message || err.error_description)) || err || '');
        if (/uniq_jersey|duplicate key/i.test(m)) {
          setStatus('That jersey color was just taken by another team. Please pick a new one.', 'error');
          jerseyInput.value = '';
          refreshRemote().then(function () { showStep(1); });
        } else if (/Registration full/i.test(m)) {
          setStatus('Sorry — registration and the waitlist are both full now.', 'error');
          refreshRemote();
        } else if (/Registration closed/i.test(m)) {
          setStatus('Registration is currently closed.', 'error');
          refreshRemote();
        } else if (/row-level security/i.test(m)) {
          console.error('Submit failed:', err);
          setStatus('Could not submit: the server rejected the request. (Organizer: make sure supabase-setup.sql has been run.)', 'error');
        } else {
          console.error('Submit failed:', err);
          setStatus('Could not submit: ' + (m || 'connection error') + ' — please try again.', 'error');
        }
      });
    } else {
      try {
        var all = localRegs();
        all.push(reg);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      } catch (err) { console.warn('Local save failed:', err); }
      afterSubmit(reg);
    }
  });

  function renderSuccess(reg, myNumber) {
    var panel = $('#success-panel');
    var isWaitlist = myNumber > TOTAL_SPOTS;
    var wlPos = myNumber - TOTAL_SPOTS;
    var heading = isWaitlist ? 'You\'re on the waitlist, ' + esc(reg.team.name) + '!' : 'You\'re in, ' + esc(reg.team.name) + '!';
    var lead = isWaitlist
      ? 'The 8 main spots were full, so you\'ve joined the <strong>waitlist at position ' + wlPos + ' of ' + WAITLIST_MAX + '</strong>. If a spot opens up we\'ll call <strong style="color:#0b1024">' + esc(reg.captainContact.name) + '</strong> at ' + esc(reg.captainContact.phone) + '.'
      : 'Registration received. We\'ll contact <strong style="color:#0b1024">' + esc(reg.captainContact.name) + '</strong> at ' + esc(reg.captainContact.phone) + ' to confirm your spot.';
    panel.innerHTML =
      '<div class="reg-success">' +
      '<div class="tick"><svg class="ico"><use href="#i-check"/></svg></div>' +
      '<h3>' + heading + '</h3>' +
      '<p>' + lead + '</p>' +
      '<p>Jersey color: <span class="rid">' + (reg.team.jerseyColor ? esc(reg.team.jerseyColor) : 'assigned if you get a spot') + '</span></p>' +
      '<p>Registration ID: <span class="rid">' + reg.id + '</span></p>' +
      '<button type="button" class="btn btn-line btn-sm" id="dl-json" style="margin-top:16px">Download entry (backup)</button>' +
      '</div>';
    var dl = $('#dl-json');
    if (dl) dl.addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(reg, null, 2)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = reg.team.name.replace(/\s+/g, '_') + '_Elite5.json'; a.click(); URL.revokeObjectURL(a.href);
    });
  }

  /* ---------- Init ---------- */
  refreshRemote();
})();
