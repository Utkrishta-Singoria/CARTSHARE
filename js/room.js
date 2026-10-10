(function () {
  'use strict';

  var CS = window.CartShare;
  var esc = CS.escapeHtml;

  /* ---------- guard: this tab must have joined a room ---------- */

  var session = CS.getSession();
  var room = session ? CS.getRoom(session.code) : null;
  if (!session || !room) {
    var back = session && session.code ? 'index.html?room=' + encodeURIComponent(session.code) : 'index.html';
    window.location.replace(back);
    return;
  }

  var me = session.name;
  var code = room.code;

  // Make sure this person is a member (covers a room created before this tab opened)
  CS.mutateRoom(code, function (r) {
    return CS.addMember(r, me) ? undefined : false;
  });

  /* ---------- elements ---------- */

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    roomCode: $('roomCode'),
    copyLinkBtn: $('copyLinkBtn'),
    leaveBtn: $('leaveBtn'),
    meterCard: $('meterCard'),
    meterTitle: $('meterTitle'),
    meterSub: $('meterSub'),
    meterTrack: $('meterTrack'),
    meterGoal: $('meterGoal'),
    meterLegend: $('meterLegend'),
    goalForm: $('goalForm'),
    goalInput: $('goalInput'),
    goalCollapse: $('goalCollapse'),
    addForm: $('addForm'),
    itemName: $('itemName'),
    itemPrice: $('itemPrice'),
    itemQty: $('itemQty'),
    cartList: $('cartList'),
    cartCount: $('cartCount'),
    cartTotal: $('cartTotal'),
    avatars: $('avatars'),
    splitList: $('splitList'),
    activityList: $('activityList')
  };

  els.roomCode.textContent = code;
  document.title = 'Room ' + code + ' | CartShare';

  /* ---------- helpers ---------- */

  function toast(message) {
    $('toastBody').textContent = message;
    if (window.bootstrap) bootstrap.Toast.getOrCreateInstance($('appToast'), { delay: 2600 }).show();
  }

  function money(minor) {
    return CS.formatMoney(minor, currentRoom.currency);
  }

  function memberColor(name) {
    var m = currentRoom.members[name];
    return m ? m.color : '#64748B';
  }

  function initial(name) {
    return esc(name.charAt(0).toUpperCase());
  }

  var currentRoom = CS.getRoom(code);

  /* ---------- rendering ---------- */

  function renderMeter() {
    var total = CS.roomTotal(currentRoom);
    var goal = currentRoom.threshold;
    var unlocked = total >= goal;
    var scale = Math.max(goal, total, 1);
    var perPerson = CS.totalsByMember(currentRoom).filter(function (p) { return p.total > 0; });

    els.meterCard.classList.toggle('unlocked', unlocked);
    els.meterTitle.textContent = unlocked
      ? 'Free delivery unlocked'
      : money(goal - total) + ' to go for free delivery';
    els.meterSub.textContent = 'Cart is ' + money(total) + '. Goal is ' + money(goal) + '.';

    els.meterTrack.innerHTML = perPerson.map(function (p) {
      return '<div class="meter-seg" style="width:' + (p.total / scale * 100).toFixed(2) +
        '%; background:' + p.color + '" title="' + esc(p.name) + ': ' + esc(money(p.total)) + '"></div>';
    }).join('');
    els.meterTrack.setAttribute('aria-label',
      'Cart total ' + money(total) + ' of ' + money(goal) + ' free delivery goal');

    var goalPos = goal / scale * 100;
    els.meterGoal.hidden = false;
    els.meterGoal.style.left = 'calc(' + goalPos.toFixed(2) + '% - 1.5px)';
    els.meterGoal.style.setProperty('--goal-shift', goalPos > 85 ? '100%' : '50%');

    els.meterLegend.innerHTML = perPerson.length
      ? perPerson.map(function (p) {
          return '<span><span class="dot-inline" style="background:' + p.color + '"></span> ' +
            esc(p.name) + ' ' + esc(money(p.total)) + '</span>';
        }).join('')
      : '<span>Nothing in the cart yet. Add the first item below.</span>';
  }

  function renderCart() {
    var items = currentRoom.items;
    var units = items.reduce(function (n, it) { return n + it.qty; }, 0);
    els.cartCount.textContent = items.length
      ? items.length + (items.length === 1 ? ' item' : ' items') + ', ' + units + ' in total'
      : '';
    els.cartTotal.textContent = money(CS.roomTotal(currentRoom));

    if (!items.length) {
      els.cartList.innerHTML =
        '<li class="empty-state"><strong>The cart is empty</strong>Add something above and everyone in the room will see it.</li>';
      return;
    }

    els.cartList.innerHTML = items.map(function (it) {
      return '<li class="cart-item" data-id="' + esc(it.id) + '">' +
        '<div>' +
          '<div class="item-name">' + esc(it.name) + '</div>' +
          '<div class="item-meta"><span class="dot-inline" style="background:' + memberColor(it.addedBy) + '"></span>' +
            'Added by ' + esc(it.addedBy) + ' at ' + esc(money(it.price)) + ' each</div>' +
        '</div>' +
        '<div class="item-controls">' +
          '<div class="qty-stepper" role="group" aria-label="Quantity of ' + esc(it.name) + '">' +
            '<button type="button" data-action="dec" data-id="' + esc(it.id) + '" aria-label="Decrease quantity"' + (it.qty <= 1 ? ' disabled' : '') + '>\u2212</button>' +
            '<output>' + it.qty + '</output>' +
            '<button type="button" data-action="inc" data-id="' + esc(it.id) + '" aria-label="Increase quantity"' + (it.qty >= 99 ? ' disabled' : '') + '>+</button>' +
          '</div>' +
          '<span class="line-total">' + esc(money(CS.lineTotal(it))) + '</span>' +
          '<button type="button" class="btn-remove" data-action="remove" data-id="' + esc(it.id) + '" aria-label="Remove ' + esc(it.name) + '">Remove</button>' +
        '</div>' +
      '</li>';
    }).join('');
  }

  function renderPeople() {
    var online = CS.getOnline(code);
    online[me] = true;
    var names = Object.keys(currentRoom.members);

    els.avatars.innerHTML = names.map(function (name) {
      var isOnline = !!online[name];
      return '<span class="avatar' + (isOnline ? ' online' : '') + '" style="background:' + memberColor(name) +
        '" title="' + esc(name) + (isOnline ? ' (online)' : ' (away)') + '">' + initial(name) +
        '<span class="dot"></span><span class="visually-hidden">' + esc(name) + (isOnline ? ', online' : ', away') + '</span></span>';
    }).join('');

    var totals = CS.totalsByMember(currentRoom);
    els.splitList.innerHTML = totals.map(function (p) {
      return '<div class="split-row"><span class="dot-inline" style="background:' + p.color + '"></span>' +
        '<span>' + esc(p.name) + (p.name === me ? ' (you)' : '') + '</span>' +
        '<span class="amount">' + esc(money(p.total)) + '</span></div>';
    }).join('');
  }

  function renderActivity() {
    var entries = currentRoom.log.slice(-50).reverse();
    els.activityList.innerHTML = entries.map(function (e) {
      return '<li class="activity-item"><span class="dot-inline" style="background:' + memberColor(e.who) + '"></span>' +
        '<div><strong>' + esc(e.who) + '</strong> ' + esc(e.text) +
        '<time datetime="' + new Date(e.t).toISOString() + '">' + esc(CS.timeAgo(e.t)) + '</time></div></li>';
    }).join('');
  }

  function render() {
    var fresh = CS.getRoom(code);
    if (!fresh) {
      // Room was removed (storage cleared in another tab)
      CS.clearSession();
      window.location.replace('index.html');
      return;
    }
    currentRoom = fresh;

    // Keep keyboard focus on the same control after the list is rebuilt
    var active = document.activeElement;
    var focusKey = active && active.dataset && active.dataset.action
      ? { id: active.dataset.id, action: active.dataset.action } : null;

    renderMeter();
    renderCart();
    renderPeople();
    renderActivity();

    if (focusKey) {
      var again = els.cartList.querySelector('[data-id="' + focusKey.id + '"][data-action="' + focusKey.action + '"]');
      if (again && !again.disabled) again.focus();
    }
  }

  /* ---------- actions ---------- */

  function checkSaved(room) {
    if (!room) toast('This room no longer exists.');
  }

  function addItem(name, priceMinor, qty) {
    var logText = '';
    var saved = CS.mutateRoom(code, function (r) {
      var existing = r.items.filter(function (it) {
        return it.addedBy === me && it.price === priceMinor && it.name.toLowerCase() === name.toLowerCase();
      })[0];
      if (existing) {
        existing.qty = Math.min(99, existing.qty + qty);
        logText = 'added ' + qty + ' more of ' + existing.name;
      } else {
        r.items.push({ id: CS.uid(), name: name, price: priceMinor, qty: qty, addedBy: me, addedAt: Date.now() });
        logText = 'added ' + qty + ' \u00D7 ' + name + ' at ' + CS.formatMoney(priceMinor, r.currency) + ' each';
      }
      CS.pushLog(r, me, 'add', logText);
    });
    checkSaved(saved);
  }

  function changeQty(id, delta) {
    CS.mutateRoom(code, function (r) {
      var it = r.items.filter(function (x) { return x.id === id; })[0];
      if (!it) return false;
      var next = it.qty + delta;
      if (next < 1 || next > 99) return false;
      it.qty = next;
      CS.pushLog(r, me, 'qty', 'changed ' + it.name + ' to ' + next);
    });
  }

  function removeItem(id) {
    var removedName = '';
    CS.mutateRoom(code, function (r) {
      var idx = r.items.findIndex(function (x) { return x.id === id; });
      if (idx === -1) return false;
      var it = r.items.splice(idx, 1)[0];
      removedName = it.name;
      var owner = it.addedBy === me ? '' : ' (added by ' + it.addedBy + ')';
      CS.pushLog(r, me, 'remove', 'removed ' + it.name + owner);
    });
    if (removedName) toast('Removed ' + removedName);
  }

  /* ---------- events ---------- */

  els.addForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = els.itemName.value.replace(/\s+/g, ' ').trim();
    var price = CS.parseMoney(els.itemPrice.value);
    var qty = parseInt(els.itemQty.value, 10);

    var nameOk = name.length > 0;
    var priceOk = price !== null;
    var qtyOk = isFinite(qty) && qty >= 1 && qty <= 99;
    els.itemName.classList.toggle('is-invalid', !nameOk);
    els.itemPrice.classList.toggle('is-invalid', !priceOk);
    els.itemQty.classList.toggle('is-invalid', !qtyOk);
    if (!nameOk || !priceOk || !qtyOk) return;

    addItem(name, price, qty);
    els.itemName.value = '';
    els.itemPrice.value = '';
    els.itemQty.value = '1';
    els.itemName.focus();
    render();
  });

  [els.itemName, els.itemPrice, els.itemQty].forEach(function (input) {
    input.addEventListener('input', function () { input.classList.remove('is-invalid'); });
  });

  els.cartList.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;
    var id = btn.dataset.id;
    if (btn.dataset.action === 'inc') changeQty(id, 1);
    if (btn.dataset.action === 'dec') changeQty(id, -1);
    if (btn.dataset.action === 'remove') removeItem(id);
    render();
  });

  els.goalCollapse.addEventListener('show.bs.collapse', function () {
    els.goalInput.value = (currentRoom.threshold / 100).toFixed(2);
  });

  els.goalForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var goal = CS.parseMoney(els.goalInput.value);
    if (goal === null || goal <= 0) {
      els.goalInput.classList.add('is-invalid');
      return;
    }
    els.goalInput.classList.remove('is-invalid');
    CS.mutateRoom(code, function (r) {
      if (r.threshold === goal) return false;
      r.threshold = goal;
      CS.pushLog(r, me, 'goal', 'set the free delivery goal to ' + CS.formatMoney(goal, r.currency));
    });
    if (window.bootstrap) bootstrap.Collapse.getOrCreateInstance(els.goalCollapse).hide();
    render();
    toast('Goal updated');
  });

  els.copyLinkBtn.addEventListener('click', function () {
    var link = new URL('index.html?room=' + code, window.location.href).href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(
        function () { toast('Invite link copied'); },
        function () { window.prompt('Copy this invite link:', link); }
      );
    } else {
      window.prompt('Copy this invite link:', link);
    }
  });

  els.leaveBtn.addEventListener('click', function () {
    CS.mutateRoom(code, function (r) { CS.pushLog(r, me, 'leave', 'left the room'); });
    CS.dropPresence(code, me);
    CS.clearSession();
    window.location.href = 'index.html';
  });

  /* ---------- live sync between tabs ---------- */

  // The "storage" event fires in every OTHER tab when localStorage changes.
  window.addEventListener('storage', function (e) {
    if (e.key === null || e.key === CS.ROOMS_KEY || e.key === CS.PRESENCE_PREFIX + code) {
      render();
    }
  });

  /* ---------- presence ---------- */

  function beat() { CS.touchPresence(code, me); }
  beat();
  setInterval(beat, 10000);
  // Re-draw now and then so "2 min ago" and online dots stay fresh
  setInterval(render, 20000);

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { beat(); render(); }
  });
  window.addEventListener('pagehide', function () { CS.dropPresence(code, me); });

  render();
})();
