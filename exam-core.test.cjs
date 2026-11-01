const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('./exam-core.js');
const quiz = require('./mock-exam-data.json');
const at = 1800000000000;

assert(core.validateQuiz(quiz), '40문항·40분·100점 구성이어야 한다');
assert.equal(quiz.questions.filter(q => q.correct.length === 2).length, 20);
assert.equal(quiz.questions.filter(q => q.image).length, 15);
const initial = core.create(quiz, at);
assert.equal(core.answeredCount(initial), 0);
assert.throws(() => core.grade(initial), '제출 전에 채점하지 않는다');
let answered = initial;
for (const q of quiz.questions) {
  for (const answer of q.correct) answered = core.choose(answered, q.id, answer, at + 1000);
}
answered = core.mark(answered, quiz.questions[0].id, at + 2000);
assert.equal(core.answeredCount(answered), 40);

// Reloading restores the original deadline, answers, question and review marker.
answered = core.move(answered, 32);
const resumed = JSON.parse(JSON.stringify(answered));
assert(core.validateAttempt(resumed));
assert.equal(resumed.currentIndex, 32);
assert.equal(core.remaining(resumed, at + 600000), 1800000);
const submitted = core.submit(resumed, at + 600000, 'manual');
assert.equal(core.grade(submitted).score, 100);
assert.equal(core.grade(submitted).markedCount, 1);
assert.throws(() => core.choose(submitted, quiz.questions[0].id, 1, at + 601000));
assert.equal(core.submit(submitted, at + 700000, 'manual'), submitted);

// A file update must not replace the questions or key in an active attempt.
const changedBank = JSON.parse(JSON.stringify(quiz));
const frozen = core.create(changedBank, at);
changedBank.questions[0].prompt = '수정된 질문';
changedBank.questions[0].correct = [5];
assert.deepEqual(frozen.quiz.questions[0], quiz.questions[0]);

// A late callback or reopening the browser cannot extend the forty minutes.
assert.equal(core.remaining(initial, at + 2400000), 0);
assert.throws(() => core.choose(initial, quiz.questions[0].id, 1, at + 2400000));
const timed = core.submit(initial, at + 2500000, 'timeout');
assert.equal(timed.submittedAt, initial.deadline);
assert.equal(timed.submissionReason, 'timeout');
assert.equal(core.grade(timed).score, 0);
assert.equal(core.grade(timed).incompleteCount, 40);
assert.equal(core.submit(initial, at + 1000, 'timeout').status, 'running');

// Multiple-answer questions award no partial credit, nor credit for extra choices.
const multiple = quiz.questions.find(q => q.correct.length === 2);
const incorrect = multiple.choices.find(c => !multiple.correct.includes(c.number)).number;
let partial = core.choose(initial, multiple.id, multiple.correct[0], at + 1000);
assert.equal(core.grade(core.submit(partial, at + 2000, 'manual')).score, 0);
partial = core.choose(partial, multiple.id, multiple.correct[1], at + 1000);
assert.equal(core.grade(core.submit(partial, at + 2000, 'manual')).score, 3);
assert.throws(() => core.choose(partial, multiple.id, incorrect, at + 1000));
partial = core.choose(partial, multiple.id, multiple.correct[0], at + 1000);
partial = core.choose(partial, multiple.id, incorrect, at + 1000);
assert.equal(core.grade(core.submit(partial, at + 2000, 'manual')).score, 0);

const html = fs.readFileSync(path.join(__dirname, '오답노트.html'), 'utf8');
const ids = [...html.replace(/<svg\b[\s\S]*?<\/svg>/g, '').matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(new Set(ids).size, ids.length, '페이지의 HTML id는 중복되지 않는다');
const client = fs.readFileSync(path.join(__dirname, 'mock-exam.js'), 'utf8');
const generatedIds = new Set(['exam-question-title', 'exam-choice-count']);
for (const m of client.matchAll(/el\('([^']+)'\)/g)) {
  assert(ids.includes(m[1]) || generatedIds.has(m[1]), '필수 화면 요소: ' + m[1]);
}
for (const q of quiz.questions) {
  if (q.image) {
    const bytes = fs.readFileSync(path.join(__dirname, q.image));
    assert(bytes.length > 1000 && bytes.subarray(1, 4).toString() === 'PNG', q.image);
  }
  for (const id of q.related || []) assert(ids.includes('topic-' + id), '연관 노트: ' + id);
}
console.log('PASS: 40문항·100점, 저장·복원, 40분 종료, 제출 잠금, 복수정답, 그림·화면 연결');
