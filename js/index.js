(function () {
  'use strict';

  var CS = window.CartShare;

  var createForm = document.getElementById('createForm');
  var joinForm = document.getElementById('joinForm');
  var createName = document.getElementById('createName');
  var createCurrency = document.getElementById('createCurrency');
  var createGoal = document.getElementById('createGoal');
  var joinName = document.getElementById('joinName');
  var joinCode = document.getElementById('joinCode');
  var joinCodeError = document.getElementById('joinCodeError');

  // Currency options
  Object.keys(CS.CURRENCIES).forEach(function (code) {
    var opt = document.createElement('option');
    opt.value = code;
    opt.textContent = CS.CURRENCIES[code].label;
    createCurrency.appendChild(opt);
  });

  // Remember the last name used in this browser
  var last = CS.getLastName();
  if (last) {
    createName.value = last;
    joinName.value = last;
  }

  // "Continue" banner if this tab already has an active room
  var session = CS.getSession();
  if (session && CS.getRoom(session.code)) {
    document.getElementById('resumeText').textContent =
      'You are in room ' + session.code + ' as ' + session.name + '.';
    document.getElementById('resumeBanner').classList.remove('d-none');
  }

  // Opened from a shared link (index.html?room=ABC123): jump to the join tab
  var params = new URLSearchParams(window.location.search);
  var sharedCode = CS.normalizeCode(params.get('room'));
  if (sharedCode) {
    joinCode.value = sharedCode;
    var joinTab = document.getElementById('tab-join');
    if (joinTab && window.bootstrap) new bootstrap.Tab(joinTab).show();
    (last ? joinCode : joinName).focus();
  }

  joinCode.addEventListener('input', function () {
    joinCode.value = CS.normalizeCode(joinCode.value);
  });

  function markValidity(input, ok) {
    input.classList.toggle('is-invalid', !ok);
    input.classList.toggle('is-valid', false);
    return ok;
  }

  function enterRoom(name, code) {
    CS.setSession(name, code);
    window.location.href = 'room.html';
  }

  createForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = CS.cleanName(createName.value);
    var goal = CS.parseMoney(createGoal.value);

    var nameOk = markValidity(createName, name.length > 0);
    var goalOk = markValidity(createGoal, goal !== null && goal > 0);
    if (!nameOk || !goalOk) return;

    var room = CS.createRoom({ name: name, currency: createCurrency.value, threshold: goal });
    if (!room) {
      alert('Your browser blocked saving data. Turn off private mode or allow site storage, then try again.');
      return;
    }
    enterRoom(name, room.code);
  });

  joinForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = CS.cleanName(joinName.value);
    var code = CS.normalizeCode(joinCode.value);

    var nameOk = markValidity(joinName, name.length > 0);
    var codeOk = markValidity(joinCode, code.length === 6);
    joinCodeError.textContent = 'Enter the 6-character room code.';
    if (!nameOk || !codeOk) return;

    var result = CS.joinRoom(code, name);
    if (!result.ok) {
      joinCodeError.textContent = result.error;
      markValidity(joinCode, false);
      return;
    }
    enterRoom(name, result.room.code);
  });

  [createName, createGoal, joinName].forEach(function (input) {
    input.addEventListener('input', function () { input.classList.remove('is-invalid'); });
  });
  joinCode.addEventListener('input', function () { joinCode.classList.remove('is-invalid'); });
})();
