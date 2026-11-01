(function () {
  'use strict';
  var core = window.DrivingExam;
  var studyExplanations = window.DrivingExamExplanations;
  var panel = document.getElementById('topic-mock-exam');
  if (!panel || !core) return;
  var storageKey = 'driving-notes:mock-exam:v1';
  var historyKey = 'driving-notes:mock-exam-history:v1';
  var attempt = null;
  var bank = null;
  var reviewFilter = 'wrong';
  var announcedFiveMinutes = false;
  var imageFocus = null;
  var savedOverflow = '';
  var viewingHistory = false;
  function el(id) { return document.getElementById(id); }
  function esc(value) { return String(value).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function message(text) { el('exam-status').textContent = text; }
  function clock(ms) {
    var seconds = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }
  function save() {
    if (viewingHistory) return;
    try { if (attempt) localStorage.setItem(storageKey, JSON.stringify(attempt)); }
    catch (_) { message('이 브라우저에서 자동 저장을 사용할 수 없어요. 창을 닫거나 새로고침하면 답안이 사라질 수 있어요.'); }
  }
  function readAttempt() {
    try {
      var raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (core.validateAttempt(parsed)) return parsed;
      localStorage.setItem(storageKey + ':unreadable', raw);
      message('이전에 저장된 시험을 읽지 못했어요. 원래 기록은 별도로 보관했어요.');
    } catch (_) { message('저장된 시험을 불러오지 못했어요. 새 시험을 시작할 수 있어요.'); }
    return null;
  }
  function setView(name) {
    ['ready', 'running', 'results'].forEach(function (view) { el('exam-' + view).hidden = view !== name; });
  }
  function focusQuestion() { var title = el('exam-question-title'); if (title) title.focus({ preventScroll: true }); }
  function scrollPanel() { panel.scrollIntoView({ block: 'start' }); }
  function expired() {
    if (!viewingHistory && attempt && attempt.status === 'running' && !core.remaining(attempt, Date.now())) { finish('timeout'); return true; }
    return false;
  }
  function updateTimer() {
    if (!attempt || attempt.status !== 'running' || viewingHistory || expired()) return;
    var left = core.remaining(attempt, Date.now());
    el('exam-time').textContent = clock(left);
    el('exam-timer').classList.toggle('is-urgent', left <= 300000);
    if (left <= 300000 && !announcedFiveMinutes) { announcedFiveMinutes = true; message('시험 시간이 5분 이하 남았어요.'); }
  }
  function progress() {
    var count = core.answeredCount(attempt);
    el('exam-progress-text').textContent = count + ' / 40문제 선택 완료';
    el('exam-progress').value = count;
    el('exam-position').textContent = (attempt.currentIndex + 1) + ' / 40';
    el('exam-map-summary').textContent = '문항 목록 · 미완료 ' + (40 - count) + '개';
    el('exam-question-map').innerHTML = attempt.quiz.questions.map(function (q, index) {
      var complete = core.complete(attempt, q);
      var marked = !!attempt.marked[q.id];
      return '<button type="button" data-exam-index="' + index + '" class="exam-map-item' + (complete ? ' is-answered' : '') + (marked ? ' is-marked' : '') + '"' + (index === attempt.currentIndex ? ' aria-current="step"' : '') + ' aria-label="' + (index + 1) + '번, ' + (complete ? '선택 완료' : '미완료') + (marked ? ', 헷갈림 표시' : '') + '">' + (index + 1) + (marked ? '<span aria-hidden="true">★</span>' : '') + '</button>';
    }).join('');
    el('exam-prev').disabled = attempt.currentIndex === 0;
    el('exam-next').textContent = attempt.currentIndex === 39 ? '답안 제출' : '다음 →';
  }
  function picture(q) {
    if (!q.image) return '';
    return '<figure class="exam-figure ' + (q.kind === 'sign' ? 'exam-sign-figure' : '') + '"><button type="button" class="exam-image-button" data-exam-image="' + esc(q.id) + '" aria-label="문제 그림 확대"><img src="' + esc(q.image) + '" alt="문제은행 ' + q.sourceNumber + '번의 ' + (q.kind === 'sign' ? '원본 표지' : '도로 상황 원본') + '"></button><figcaption>그림을 누르면 확대할 수 있어요.</figcaption></figure>';
  }
  function context(q) {
    return q.context && q.context.length ? '<ul class="exam-context">' + q.context.map(function (line) { return '<li>' + esc(line) + '</li>'; }).join('') + '</ul>' : '';
  }
  function renderQuestion() {
    var q = attempt.quiz.questions[attempt.currentIndex];
    var selected = attempt.answers[q.id] || [];
    el('exam-question-meta').textContent = (q.kind === 'text' ? '문장형' : q.kind === 'sign' ? '표지형' : '그림형') + ' · ' + q.points + '점 · 문제은행 ' + q.sourceNumber + '번';
    el('exam-question').innerHTML = '<h2 id="exam-question-title" tabindex="-1">' + (attempt.currentIndex + 1) + '. ' + esc(q.prompt) + '</h2>' + picture(q) + context(q) +
      '<fieldset class="exam-choices"><legend>정답 ' + q.correct.length + '개를 선택하세요.</legend>' + q.choices.map(function (choice) {
        var checked = selected.includes(choice.number);
        return '<label class="exam-choice' + (checked ? ' is-selected' : '') + '" for="exam-choice-' + choice.number + '"><input id="exam-choice-' + choice.number + '" name="exam-answer" type="' + (q.correct.length === 1 ? 'radio' : 'checkbox') + '" value="' + choice.number + '"' + (checked ? ' checked' : '') + '><span class="exam-choice-number">' + choice.number + '</span><span>' + esc(choice.text) + '</span></label>';
      }).join('') + '</fieldset><p id="exam-choice-count" class="exam-choice-count">' + selected.length + ' / ' + q.correct.length + '개 선택</p>';
    el('exam-mark').setAttribute('aria-pressed', String(!!attempt.marked[q.id]));
    el('exam-mark').textContent = attempt.marked[q.id] ? '★ 헷갈림 표시됨' : '☆ 헷갈림·찍은 문제';
    el('exam-submit-confirm').hidden = true;
    el('exam-choice-status').textContent = '';
    progress();
  }
  function renderRunning() { setView('running'); renderQuestion(); updateTimer(); }
  function choose(event) {
    var input = event.target;
    if (!input.matches('input[name="exam-answer"]') || expired()) return;
    var q = attempt.quiz.questions[attempt.currentIndex];
    try { attempt = core.choose(attempt, q.id, Number(input.value), Date.now()); save(); el('exam-choice-status').textContent = ''; }
    catch (error) { input.checked = (attempt.answers[q.id] || []).includes(Number(input.value)); el('exam-choice-status').textContent = error.message; }
    var selected = attempt.answers[q.id] || [];
    Array.from(el('exam-question').querySelectorAll('input')).forEach(function (control) { control.checked = selected.includes(Number(control.value)); control.closest('label').classList.toggle('is-selected', control.checked); });
    el('exam-choice-count').textContent = selected.length + ' / ' + q.correct.length + '개 선택';
    el('exam-submit-confirm').hidden = true;
    progress();
  }
  function move(index) {
    if (expired() || !attempt || attempt.status !== 'running') return;
    attempt = core.move(attempt, index); save(); renderQuestion(); scrollPanel(); focusQuestion();
  }
  function requestSubmit() {
    if (expired()) return;
    var missing = 40 - core.answeredCount(attempt);
    if (!missing) { finish('manual'); return; }
    el('exam-submit-warning').textContent = '선택을 마치지 않은 문제가 ' + missing + '개 있어요. 그대로 제출하면 정답이 아닌 문항은 0점으로 채점해요.';
    el('exam-submit-confirm').hidden = false;
    el('exam-submit-confirm').scrollIntoView({ block: 'center' });
  }
  function finish(reason) {
    if (!attempt || attempt.status !== 'running') return;
    attempt = core.submit(attempt, Date.now(), reason);
    if (attempt.status !== 'submitted') return;
    save(); closeImage(); reviewFilter = 'wrong'; renderResults(); scrollPanel(); el('exam-result-title').focus({ preventScroll: true });
    message(reason === 'timeout' ? '40분이 지나 답안이 자동 제출되었어요.' : '채점이 끝났어요. 오답과 헷갈린 문제를 확인하세요.');
  }
  function noteLinks(q) {
    var study = studyExplanations && studyExplanations.forQuestion(q);
    var related = (q.related || []).concat(study ? study.related : []).filter(function (id, index, ids) { return ids.indexOf(id) === index; });
    return related.map(function (id) {
      var link = document.querySelector('.topic-link[data-topic="' + id + '"]');
      return link ? '<a href="#' + esc(id) + '">' + esc(link.childNodes[0].textContent.trim()) + ' ↗</a>' : '';
    }).filter(Boolean).join(' · ');
  }
  function renderReviews(result) {
    var items = result.items.filter(function (item) { return reviewFilter === 'all' || (reviewFilter === 'wrong' && !item.correct) || (reviewFilter === 'marked' && item.marked); });
    Array.from(el('exam-filter').querySelectorAll('button')).forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.examFilter === reviewFilter)); });
    el('exam-review-list').innerHTML = items.length ? items.map(function (item, visibleIndex) {
      var q = item.question, links = noteLinks(q);
      return '<details class="exam-review-item"' + (visibleIndex === 0 ? ' open' : '') + '><summary><span class="exam-review-status ' + (item.correct ? 'is-correct' : 'is-wrong') + '">' + (item.correct ? '정답' : item.incomplete ? '미완료' : '오답') + '</span><span>' + (item.index + 1) + '. ' + esc(q.prompt) + (item.marked ? ' ★' : '') + '</span></summary><div class="exam-review-body">' + picture(q) + context(q) + '<div class="exam-answer-summary"><span>내 선택 <b>' + (item.selected.length ? item.selected.join(', ') + '번' : '없음') + '</b></span><span>정답 <b>' + q.correct.join(', ') + '번</b></span></div><ol class="exam-review-choices">' + q.choices.map(function (choice) {
        var correct = q.correct.includes(choice.number), chosen = item.selected.includes(choice.number);
        return '<li class="' + (correct ? 'is-correct' : chosen ? 'is-wrong' : '') + '"><span class="exam-choice-number">' + choice.number + '</span><span>' + esc(choice.text) + (correct ? ' <b class="exam-inline-tag">정답</b>' : chosen ? ' <b class="exam-inline-tag">내 선택</b>' : '') + '</span></li>';
      }).join('') + '</ol><div class="exam-explanation"><b>PDF 해설</b><p>' + esc(q.explanation) + '</p></div>' + (studyExplanations ? studyExplanations.render(q) : '') + (links ? '<p class="exam-related"><b>같이 볼 노트</b><br>' + links + '</p>' : '') + '<small class="sub">제공한 PDF · 문제은행 ' + q.sourceNumber + '번 · ' + q.page + '쪽</small></div></details>';
    }).join('') : '<p class="exam-empty">' + (reviewFilter === 'wrong' ? '틀린 문제가 없어요.' : '헷갈림 표시를 한 문제가 없어요.') + '</p>';
  }
  function history() {
    try { var items = JSON.parse(localStorage.getItem(historyKey) || '[]'); return Array.isArray(items) ? items.filter(function (item) { return core.validateAttempt(item) && item.status === 'submitted'; }) : []; } catch (_) { return []; }
  }
  function renderHistory() {
    var items = history();
    el('exam-history').hidden = !items.length;
    el('exam-history-list').innerHTML = items.map(function (old, index) { var result = core.grade(old); return '<button type="button" class="exam-secondary" data-exam-history="' + index + '">' + new Date(old.startedAt).toLocaleDateString('ko-KR') + ' · ' + result.score + '점 보기</button>'; }).join('');
  }
  function renderResults() {
    setView('results');
    var result = core.grade(attempt);
    el('exam-result-title').textContent = result.score + '점 · ' + result.correctCount + ' / 40문제 정답';
    el('exam-result-title').classList.toggle('is-pass', result.score >= 60);
    el('exam-result-description').textContent = '연습 기준 ' + (result.score >= 60 ? '60점 이상' : '60점 미만') + ' · 소요 ' + clock(result.elapsedMs) + (attempt.submissionReason === 'timeout' ? ' · 시간 종료로 자동 제출' : ' · 직접 제출');
    el('exam-filter-wrong').textContent = '오답 ' + (40 - result.correctCount);
    el('exam-filter-marked').textContent = '찍은·헷갈림 ' + result.markedCount;
    el('exam-filter-all').textContent = '전체 40';
    el('exam-new-attempt').hidden = viewingHistory;
    el('exam-return-latest').hidden = !viewingHistory;
    el('exam-retry-confirm').hidden = true;
    renderReviews(result); renderHistory();
  }
  function start() {
    if (!bank) return;
    viewingHistory = false;
    attempt = core.create(bank, Date.now()); announcedFiveMinutes = false; save(); message(''); renderRunning(); scrollPanel(); focusQuestion();
  }
  function repeat() {
    if (!attempt || attempt.status !== 'submitted' || !bank) return;
    try { var items = history(); items.unshift(attempt); localStorage.setItem(historyKey, JSON.stringify(items.slice(0, 3))); }
    catch (_) { message('이전 결과를 저장하지 못해 다시 풀기를 시작하지 않았어요.'); return; }
    start();
  }
  function openImage(id, trigger) {
    if (!attempt) return;
    var q = attempt.quiz.questions.find(function (q) { return q.id === id; });
    if (!q || !q.image) return;
    imageFocus = trigger; savedOverflow = document.body.style.overflow;
    el('exam-image-title').textContent = '문제은행 ' + q.sourceNumber + '번 그림';
    el('exam-zoom-image').src = q.image; el('exam-zoom-image').alt = '문제은행 ' + q.sourceNumber + '번의 원본 그림';
    el('exam-image-stage').classList.remove('is-native'); el('exam-image-size').textContent = '원본 크기';
    el('exam-image-size').setAttribute('aria-pressed', 'false');
    el('exam-image-dialog').hidden = false; document.body.style.overflow = 'hidden'; el('exam-image-close').focus();
  }
  function closeImage() {
    if (el('exam-image-dialog').hidden) return;
    el('exam-image-dialog').hidden = true; document.body.style.overflow = savedOverflow;
    if (imageFocus && document.contains(imageFocus)) imageFocus.focus();
  }
  function exportReview() {
    var result = core.grade(attempt);
    return ['문제은행 모의고사 1회: ' + result.score + '점, ' + result.correctCount + '/40 정답, ' + clock(result.elapsedMs), '오답 또는 헷갈림 표시한 문제', ''].concat(result.items.filter(function (item) { return !item.correct || item.marked; }).map(function (item) {
      var q = item.question;
      return (item.index + 1) + '. [PDF ' + q.sourceNumber + '번 · ' + q.page + '쪽' + (item.marked ? ' · 헷갈림' : '') + '] ' + q.prompt + '\n' + q.choices.map(function (choice) { return choice.number + '. ' + choice.text; }).join('\n') + '\n내 선택: ' + (item.selected.join(', ') || '없음') + ' / 정답: ' + q.correct.join(', ');
    })).join('\n\n');
  }
  function copyReview() {
    var text = exportReview();
    function fallback() {
      el('exam-copy-fallback').hidden = false; el('exam-copy-text').value = text; el('exam-copy-text').select();
      try { if (document.execCommand('copy')) { el('exam-copy-fallback').hidden = true; message('오답과 헷갈린 문제를 복사했어요. 대화에 붙여넣어 주세요.'); return; } } catch (_) {}
      message('아래 내용을 선택해서 복사해 주세요.');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { message('오답과 헷갈린 문제를 복사했어요. 대화에 붙여넣어 주세요.'); }, fallback);
    else fallback();
  }
  panel.addEventListener('change', choose);
  panel.addEventListener('click', function (event) {
    var jump = event.target.closest('[data-exam-index]'); if (jump) { move(Number(jump.dataset.examIndex)); return; }
    var image = event.target.closest('[data-exam-image]'); if (image) { openImage(image.dataset.examImage, image); return; }
    var filter = event.target.closest('[data-exam-filter]'); if (filter) { reviewFilter = filter.dataset.examFilter; renderReviews(core.grade(attempt)); return; }
    var old = event.target.closest('[data-exam-history]'); if (old) { var record = history()[Number(old.dataset.examHistory)]; if (record) { viewingHistory = true; attempt = record; reviewFilter = 'wrong'; renderResults(); scrollPanel(); } }
  });
  el('exam-start').addEventListener('click', start);
  el('exam-prev').addEventListener('click', function () { move(attempt.currentIndex - 1); });
  el('exam-next').addEventListener('click', function () { if (attempt.currentIndex === 39) requestSubmit(); else move(attempt.currentIndex + 1); });
  el('exam-submit').addEventListener('click', requestSubmit);
  el('exam-submit-anyway').addEventListener('click', function () { finish('manual'); });
  el('exam-find-missing').addEventListener('click', function () { move(attempt.quiz.questions.findIndex(function (q) { return !core.complete(attempt, q); })); });
  el('exam-mark').addEventListener('click', function () { if (expired()) return; attempt = core.mark(attempt, attempt.quiz.questions[attempt.currentIndex].id, Date.now()); save(); renderQuestion(); });
  el('exam-new-attempt').addEventListener('click', function () { el('exam-retry-confirm').hidden = false; });
  el('exam-retry-start').addEventListener('click', repeat);
  el('exam-retry-cancel').addEventListener('click', function () { el('exam-retry-confirm').hidden = true; });
  el('exam-return-latest').addEventListener('click', function () { viewingHistory = false; attempt = readAttempt(); if (attempt && attempt.status === 'submitted') renderResults(); else if (attempt) renderRunning(); else setView('ready'); scrollPanel(); });
  el('exam-copy').addEventListener('click', copyReview);
  el('exam-image-close').addEventListener('click', closeImage);
  el('exam-image-dialog').addEventListener('click', function (event) { if (event.target === el('exam-image-dialog')) closeImage(); });
  el('exam-image-size').addEventListener('click', function () { var native = el('exam-image-stage').classList.toggle('is-native'); this.textContent = native ? '화면에 맞추기' : '원본 크기'; this.setAttribute('aria-pressed', String(native)); });
  document.addEventListener('keydown', function (event) {
    if (el('exam-image-dialog').hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeImage(); }
    if (event.key === 'Tab') { event.preventDefault(); (document.activeElement === el('exam-image-close') ? el('exam-image-size') : el('exam-image-close')).focus(); }
  });
  document.addEventListener('visibilitychange', updateTimer);
  window.addEventListener('beforeunload', save);
  window.addEventListener('storage', function (event) {
    if (event.key !== storageKey || viewingHistory) return;
    var updated = readAttempt();
    if (updated) { attempt = updated; if (attempt.status === 'running') renderRunning(); else renderResults(); }
  });
  setInterval(updateTimer, 1000);
  attempt = readAttempt();
  if (attempt) { bank = attempt.quiz; if (attempt.status === 'running') renderRunning(); else renderResults(); }
  function loadBank() {
    el('exam-start').disabled = true; el('exam-load-status').textContent = '문제와 그림을 준비하고 있어요…';
    fetch('mock-exam-data.json').then(function (response) { if (!response.ok) throw new Error('문제 파일을 읽지 못했어요.'); return response.json(); }).then(function (data) {
      if (!core.validateQuiz(data)) throw new Error('문제 구성을 확인하지 못했어요.');
      bank = data;
      return Promise.all(data.questions.filter(function (q) { return !!q.image; }).map(function (q) { return new Promise(function (resolve, reject) { var image = new Image(); image.onload = resolve; image.onerror = function () { reject(new Error('그림을 불러오지 못했어요. 다시 불러오기를 눌러 주세요.')); }; image.src = q.image; }); }));
    }).then(function () { el('exam-start').disabled = false; el('exam-load-status').textContent = '40문제와 그림 15개 준비 완료'; el('exam-reload').hidden = true; }).catch(function (error) { el('exam-load-status').textContent = error.message; el('exam-reload').hidden = false; });
  }
  el('exam-reload').addEventListener('click', loadBank);
  loadBank();
}());
