(function (root, factory) {
  'use strict';
  var core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.DrivingExam = core;
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  function validateQuiz(quiz) {
    if (!quiz || typeof quiz.id !== 'string' || !Array.isArray(quiz.questions) || quiz.questions.length !== 40 || quiz.durationMinutes !== 40) return false;
    var ids = new Set();
    var valid = quiz.questions.every(function (q) {
      if (!q || ids.has(q.id) || typeof q.id !== 'string' || typeof q.prompt !== 'string' || typeof q.explanation !== 'string') return false;
      ids.add(q.id);
      if (!Array.isArray(q.choices) || q.choices.length < 4 || q.choices.length > 5 || !Array.isArray(q.correct) || q.correct.length < 1 || q.correct.length > 2) return false;
      if (new Set(q.correct).size !== q.correct.length || q.points !== (q.correct.length === 1 ? 2 : 3)) return false;
      return q.choices.every(function (choice, index) { return choice.number === index + 1 && typeof choice.text === 'string' && choice.text.length > 0; }) &&
        q.correct.every(function (n) { return Number.isInteger(n) && n >= 1 && n <= q.choices.length; });
    });
    return valid && quiz.questions.reduce(function (sum, q) { return sum + q.points; }, 0) === 100;
  }
  function create(quiz, now) {
    if (!validateQuiz(quiz)) throw new Error('문제 구성을 확인해 주세요.');
    return { version: 1, quiz: JSON.parse(JSON.stringify(quiz)), status: 'running', startedAt: now,
      deadline: now + quiz.durationMinutes * 60000, submittedAt: null, submissionReason: null,
      currentIndex: 0, answers: {}, marked: {} };
  }
  function validateAttempt(attempt) {
    if (!attempt || attempt.version !== 1 || !validateQuiz(attempt.quiz) || !['running', 'submitted'].includes(attempt.status)) return false;
    if (!Number.isFinite(attempt.startedAt) || !Number.isFinite(attempt.deadline) || attempt.deadline - attempt.startedAt !== 2400000) return false;
    if (!Number.isInteger(attempt.currentIndex) || attempt.currentIndex < 0 || attempt.currentIndex >= 40 || !attempt.answers || !attempt.marked) return false;
    if (attempt.status === 'submitted' && (!Number.isFinite(attempt.submittedAt) || attempt.submittedAt < attempt.startedAt || attempt.submittedAt > attempt.deadline)) return false;
    return attempt.quiz.questions.every(function (q) {
      var selected = attempt.answers[q.id] || [];
      return Array.isArray(selected) && selected.length <= q.correct.length && new Set(selected).size === selected.length &&
        selected.every(function (n) { return Number.isInteger(n) && n >= 1 && n <= q.choices.length; });
    });
  }
  function remaining(attempt, now) { return Math.min(2400000, Math.max(0, attempt.deadline - now)); }
  function editable(attempt, now) {
    if (attempt.status !== 'running') throw new Error('이미 제출한 시험이에요.');
    if (!remaining(attempt, now)) throw new Error('시험 시간이 끝났어요.');
  }
  function choose(attempt, id, value, now) {
    editable(attempt, now);
    var q = attempt.quiz.questions.find(function (q) { return q.id === id; });
    if (!q || !Number.isInteger(value) || value < 1 || value > q.choices.length) throw new Error('보기를 확인해 주세요.');
    var selected = (attempt.answers[id] || []).slice();
    if (q.correct.length === 1) selected = [value];
    else if (selected.includes(value)) selected = selected.filter(function (n) { return n !== value; });
    else {
      if (selected.length === q.correct.length) throw new Error('정답은 ' + q.correct.length + '개만 선택해요. 다른 답을 고르려면 기존 선택을 해제해 주세요.');
      selected.push(value);
    }
    var answers = Object.assign({}, attempt.answers);
    answers[id] = selected.sort(function (a, b) { return a - b; });
    return Object.assign({}, attempt, { answers: answers });
  }
  function mark(attempt, id, now) {
    editable(attempt, now);
    if (!attempt.quiz.questions.some(function (q) { return q.id === id; })) throw new Error('문항을 확인해 주세요.');
    var marked = Object.assign({}, attempt.marked);
    marked[id] = !marked[id];
    return Object.assign({}, attempt, { marked: marked });
  }
  function move(attempt, index) {
    return Object.assign({}, attempt, { currentIndex: Math.min(39, Math.max(0, Math.trunc(index))) });
  }
  function complete(attempt, q) { return (attempt.answers[q.id] || []).length === q.correct.length; }
  function answeredCount(attempt) { return attempt.quiz.questions.filter(function (q) { return complete(attempt, q); }).length; }
  function submit(attempt, now, reason) {
    if (attempt.status === 'submitted') return attempt;
    var expired = remaining(attempt, now) === 0;
    if (reason === 'timeout' && !expired) return attempt;
    return Object.assign({}, attempt, { status: 'submitted', submittedAt: Math.max(attempt.startedAt, Math.min(now, attempt.deadline)), submissionReason: expired ? 'timeout' : 'manual' });
  }
  function grade(attempt) {
    if (attempt.status !== 'submitted') throw new Error('제출한 뒤 정답을 확인할 수 있어요.');
    var items = attempt.quiz.questions.map(function (q, index) {
      var selected = attempt.answers[q.id] || [];
      var correct = selected.length === q.correct.length && q.correct.every(function (n) { return selected.includes(n); });
      return { question: q, index: index, selected: selected.slice(), correct: correct, incomplete: !complete(attempt, q), marked: !!attempt.marked[q.id] };
    });
    var score = items.reduce(function (sum, item) { return sum + (item.correct ? item.question.points : 0); }, 0);
    return { score: score, correctCount: items.filter(function (item) { return item.correct; }).length,
      incompleteCount: items.filter(function (item) { return item.incomplete; }).length,
      markedCount: items.filter(function (item) { return item.marked; }).length,
      elapsedMs: attempt.submittedAt - attempt.startedAt, items: items };
  }
  return { validateQuiz: validateQuiz, validateAttempt: validateAttempt, create: create, remaining: remaining,
    choose: choose, mark: mark, move: move, complete: complete, answeredCount: answeredCount, submit: submit, grade: grade };
}));
