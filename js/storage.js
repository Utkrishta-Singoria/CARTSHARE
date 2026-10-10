/*
 * CartShare data layer
 * --------------------
 * All rooms live in localStorage under one key. Each browser tab keeps its own
 * "who am I / which room" in sessionStorage, so two tabs can act as two people.
 * Other tabs hear about changes through the window "storage" event (see room.js).
 */
(function (global) {
  'use strict';

  var ROOMS_KEY = 'cartshare:rooms:v1';
  var PRESENCE_PREFIX = 'cartshare:presence:';
  var SESSION_KEY = 'cartshare:session';
  var LAST_NAME_KEY = 'cartshare:lastName';
  var MAX_LOG = 200;
  var ONLINE_WINDOW_MS = 25000;

  var MEMBER_COLORS = [
    '#0F766E', '#B45309', '#6D28D9', '#BE123C',
    '#1D4ED8', '#4D7C0F', '#A21CAF', '#0E7490'
  ];
  var CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  var CURRENCIES = {
    USD: { locale: 'en-US', label: '$ US dollar' },
    INR: { locale: 'en-IN', label: '\u20B9 Indian rupee' },
    EUR: { locale: 'de-DE', label: '\u20AC Euro' },
    GBP: { locale: 'en-GB', label: '\u00A3 British pound' }
  };

  /* ---------- small helpers ---------- */

  function safeParse(text, fallback) {
    try { return text ? JSON.parse(text) : fallback; } catch (e) { return fallback; }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function cleanName(raw) {
    return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 24);
  }

  function normalizeCode(raw) {
    return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

  /* ---------- money (stored as integer minor units, e.g. cents) ---------- */

  function parseMoney(text) {
    var n = parseFloat(String(text).replace(/,/g, ''));
    if (!isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  }

  function formatMoney(minor, currency) {
    var c = CURRENCIES[currency] || CURRENCIES.USD;
    try {
      return new Intl.NumberFormat(c.locale, { style: 'currency', currency: currency || 'USD' })
        .format(minor / 100);
    } catch (e) {
      return (minor / 100).toFixed(2);
    }
  }

  /* ---------- rooms ---------- */

  function loadRooms() {
    var rooms = safeParse(localStorage.getItem(ROOMS_KEY), {});
    return rooms && typeof rooms === 'object' ? rooms : {};
  }

  function saveRooms(rooms) {
    try {
      localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
      return true;
    } catch (e) {
      return false;
    }
  }

  function getRoom(code) {
    return loadRooms()[normalizeCode(code)] || null;
  }

  function pushLog(room, who, type, text) {
    room.log.push({ id: uid(), t: Date.now(), who: who, type: type, text: text });
    if (room.log.length > MAX_LOG) room.log = room.log.slice(-MAX_LOG);
  }

  function addMember(room, name) {
    if (!room.members[name]) {
      var index = Object.keys(room.members).length;
      room.members[name] = {
        color: MEMBER_COLORS[index % MEMBER_COLORS.length],
        joinedAt: Date.now()
      };
      return true;
    }
    return false;
  }

  function generateCode(rooms) {
    var code;
    do {
      code = '';
      for (var i = 0; i < 6; i++) {
        code += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
      }
    } while (rooms[code]);
    return code;
  }

  function createRoom(opts) {
    var rooms = loadRooms();
    var code = generateCode(rooms);
    var room = {
      code: code,
      currency: CURRENCIES[opts.currency] ? opts.currency : 'USD',
      threshold: opts.threshold,
      createdBy: opts.name,
      createdAt: Date.now(),
      members: {},
      items: [],
      log: []
    };
    addMember(room, opts.name);
    pushLog(room, opts.name, 'join', 'created the room');
    rooms[code] = room;
    return saveRooms(rooms) ? room : null;
  }

  function joinRoom(code, name) {
    var rooms = loadRooms();
    var room = rooms[normalizeCode(code)];
    if (!room) return { ok: false, error: 'No room with that code exists in this browser.' };
    var isNew = addMember(room, name);
    pushLog(room, name, 'join', isNew ? 'joined the room' : 'rejoined the room');
    if (!saveRooms(rooms)) return { ok: false, error: 'Could not save to browser storage.' };
    return { ok: true, room: room };
  }

  // Load, change, save in one step. fn(room) may return false to cancel the save.
  function mutateRoom(code, fn) {
    var rooms = loadRooms();
    var room = rooms[normalizeCode(code)];
    if (!room) return null;
    if (fn(room) === false) return room;
    saveRooms(rooms);
    return room;
  }

  /* ---------- totals ---------- */

  function lineTotal(item) {
    return item.price * item.qty;
  }

  function roomTotal(room) {
    return room.items.reduce(function (sum, it) { return sum + lineTotal(it); }, 0);
  }

  // Returns [{ name, color, total, count }] for every member, biggest first.
  function totalsByMember(room) {
    var map = {};
    Object.keys(room.members).forEach(function (name) {
      map[name] = { name: name, color: room.members[name].color, total: 0, count: 0 };
    });
    room.items.forEach(function (it) {
      if (!map[it.addedBy]) {
        map[it.addedBy] = { name: it.addedBy, color: '#64748B', total: 0, count: 0 };
      }
      map[it.addedBy].total += lineTotal(it);
      map[it.addedBy].count += it.qty;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.total - a.total || a.name.localeCompare(b.name); });
  }

  /* ---------- session (per tab) ---------- */

  function getSession() {
    return safeParse(sessionStorage.getItem(SESSION_KEY), null);
  }

  function setSession(name, code) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ name: name, code: code }));
    try { localStorage.setItem(LAST_NAME_KEY, name); } catch (e) { /* ignore */ }
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function getLastName() {
    try { return localStorage.getItem(LAST_NAME_KEY) || ''; } catch (e) { return ''; }
  }

  /* ---------- presence (who has the room open right now) ---------- */

  function presenceKey(code) { return PRESENCE_PREFIX + code; }

  function touchPresence(code, name) {
    var data = safeParse(localStorage.getItem(presenceKey(code)), {});
    data[name] = Date.now();
    try { localStorage.setItem(presenceKey(code), JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  function dropPresence(code, name) {
    var data = safeParse(localStorage.getItem(presenceKey(code)), {});
    delete data[name];
    try { localStorage.setItem(presenceKey(code), JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  function getOnline(code) {
    var data = safeParse(localStorage.getItem(presenceKey(code)), {});
    var now = Date.now();
    var online = {};
    Object.keys(data).forEach(function (name) {
      if (now - data[name] < ONLINE_WINDOW_MS) online[name] = true;
    });
    return online;
  }

  /* ---------- time ---------- */

  function timeAgo(ts) {
    var s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 10) return 'just now';
    if (s < 60) return s + 's ago';
    var m = Math.round(s / 60);
    if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60);
    if (h < 24) return h + ' h ago';
    return new Date(ts).toLocaleDateString();
  }

  global.CartShare = {
    ROOMS_KEY: ROOMS_KEY,
    PRESENCE_PREFIX: PRESENCE_PREFIX,
    CURRENCIES: CURRENCIES,
    escapeHtml: escapeHtml,
    cleanName: cleanName,
    normalizeCode: normalizeCode,
    parseMoney: parseMoney,
    formatMoney: formatMoney,
    getRoom: getRoom,
    createRoom: createRoom,
    joinRoom: joinRoom,
    mutateRoom: mutateRoom,
    pushLog: pushLog,
    addMember: addMember,
    uid: uid,
    lineTotal: lineTotal,
    roomTotal: roomTotal,
    totalsByMember: totalsByMember,
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    getLastName: getLastName,
    touchPresence: touchPresence,
    dropPresence: dropPresence,
    getOnline: getOnline,
    timeAgo: timeAgo
  };
})(window);
