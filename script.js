/* ===== Elite 5 — registration wizard + urgency tracker ===== */
(function () {
  'use strict';

  // --- Config the organizer can tweak ---
  var MIN_PLAYERS = 5;
  var MAX_PLAYERS = 8;
  var TOTAL_SPOTS = 8;
  var TEAMS_ALREADY_REGISTERED = 0; // extra teams already confirmed offline; the tracker adds live registrations on top
  var STORAGE_KEY = 'elite5_registrations';

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

  /* ---------- Urgency tracker ---------- */
  function localCount() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').length; } catch (e) { return 0; }
  }
  function updateTracker() {
    var count = Math.min(TEAMS_ALREADY_REGISTERED + localCount(), TOTAL_SPOTS);
    var left = TOTAL_SPOTS - count;
    var countEl = $('#tracker-count');
    var fillEl = $('#tracker-fill');
    var noteEl = $('#tracker-note');
    if (countEl) countEl.textContent = count;
    if (fillEl) fillEl.style.width = (count / TOTAL_SPOTS * 100) + '%';
    if (noteEl) {
      if (left <= 0) { noteEl.textContent = 'All spots claimed. Registration full.'; noteEl.classList.add('hot'); }
      else if (left <= 3) { noteEl.textContent = 'Only ' + left + ' spot' + (left === 1 ? '' : 's') + ' left. Going fast.'; noteEl.classList.add('hot'); }
      else { noteEl.textContent = left + ' of ' + TOTAL_SPOTS + ' spots still open.'; noteEl.classList.remove('hot'); }
    }
  }
  updateTracker();

  /* ---------- Jersey color (first come, first served) ---------- */
  var JERSEY_COLORS = [
    { n: 'Red', h: '#e11d2a' }, { n: 'Blue', h: '#1e5cff' }, { n: 'Green', h: '#16a34a' },
    { n: 'Yellow', h: '#f5c518' }, { n: 'Orange', h: '#f97316' }, { n: 'Purple', h: '#7c3aed' },
    { n: 'Black', h: '#111111' }, { n: 'White', h: '#ffffff' }
  ];
  var picker = $('#color-picker');
  var jerseyInput = $('#jerseyColor');
  function takenColors() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').map(function (r) { return r.team && r.team.jerseyColor; }).filter(Boolean); }
    catch (e) { return []; }
  }
  function buildColors() {
    if (!picker) return;
    var taken = takenColors();
    picker.innerHTML = '';
    JERSEY_COLORS.forEach(function (c) {
      var isTaken = taken.indexOf(c.n) !== -1;
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
  buildColors();

  /* ---------- Player rows ---------- */
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

  function esc2(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function setAddStatus(msg, type) { if (!addStatus) return; addStatus.textContent = msg || ''; addStatus.className = 'form-status' + (type ? ' ' + type : ''); }

  if (npPhotoInput) npPhotoInput.addEventListener('change', function () {
    var file = npPhotoInput.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) { pendingPhoto = e.target.result; npPreview.src = pendingPhoto; npPreview.hidden = false; if (npPlaceholder) npPlaceholder.style.display = 'none'; };
    reader.readAsDataURL(file);
  });

  function renderRoster() {
    if (!rosterEl) return;
    rosterEl.innerHTML = '';
    roster.forEach(function (p, idx) {
      var row = document.createElement('div');
      row.className = 'roster-row' + (p.isCaptain ? ' is-captain' : '');
      row.innerHTML =
        '<img class="roster-photo" src="' + p.photo + '" alt="">' +
        '<div class="roster-info"><div class="roster-name">' + esc2(p.name) + (p.isCaptain ? ' <span class="cap-tag">Captain</span>' : '') + '</div>' +
        '<div class="roster-sub">' + esc2(p.dob) + (p.instagram ? ' · ' + esc2(p.instagram) : '') + '</div></div>' +
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
    var nameBad = !name, dobBad = !dobInRange(dob), photoBad = !pendingPhoto;
    npName.classList.toggle('invalid', nameBad);
    npDob.classList.toggle('invalid', dobBad);
    if (nameBad || dobBad || photoBad) {
      setAddStatus(photoBad ? 'Add a photo for this player.' : (dobBad ? 'Date of birth must be 2009–2011.' : 'Enter the player\'s name.'), 'error');
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
      if (!jerseyInput.value) { ok = false; if (picker) picker.classList.add('invalid'); } else if (picker) picker.classList.remove('invalid');
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
    try {
      var all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      all.push(reg); localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (err) { console.warn('Local save failed:', err); }

    updateTracker();
    buildColors();
    renderSuccess(reg);
    showStep(4);
  });

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function renderSuccess(reg) {
    var panel = $('#success-panel');
    var spotsLeft = Math.max(TOTAL_SPOTS - Math.min(TEAMS_ALREADY_REGISTERED + localCount(), TOTAL_SPOTS), 0);
    panel.innerHTML =
      '<div class="reg-success">' +
      '<div class="tick"><svg class="ico"><use href="#i-check"/></svg></div>' +
      '<h3>You\'re in, ' + esc(reg.team.name) + '!</h3>' +
      '<p>Registration received. We\'ll contact <strong style="color:#0b1024">' + esc(reg.captainContact.name) + '</strong> at ' + esc(reg.captainContact.phone) + ' to confirm your spot.</p>' +
      '<p>Jersey color locked in: <span class="rid">' + esc(reg.team.jerseyColor) + '</span></p>' +
      '<p>Registration ID: <span class="rid">' + reg.id + '</span></p>' +
      '<p>' + (spotsLeft > 0 ? spotsLeft + ' spot' + (spotsLeft === 1 ? '' : 's') + ' left.' : 'That may have been the last spot!') + '</p>' +
      '<button type="button" class="btn btn-line btn-sm" id="dl-json" style="margin-top:16px">Download entry (backup)</button>' +
      '</div>';
    var dl = $('#dl-json');
    if (dl) dl.addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(reg, null, 2)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = reg.team.name.replace(/\s+/g, '_') + '_Elite5.json'; a.click(); URL.revokeObjectURL(a.href);
    });
  }
})();
