const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('./exam-core.js');
const explanations = require('./exam-explanations.js');
const quiz = require('./mock-exam-data.json');

// Already submitted attempts have the old question snapshot and no new fields.
const startedAt = 1800000000000;
let attempt = core.create(quiz, startedAt);
attempt = core.choose(attempt, quiz.questions[0].id, 1, startedAt + 1000);
attempt = core.mark(attempt, quiz.questions[16].id, startedAt + 1000);
const saved = JSON.stringify(core.submit(attempt, startedAt + 600000, 'manual'));
const oldResult = JSON.parse(saved);
const resultBefore = core.grade(oldResult);
const html = fs.readFileSync(path.join(__dirname, '오답노트.html'), 'utf8');
let reviewedChoices = 0;
for (const q of oldResult.quiz.questions) {
  const record = explanations.forQuestion(q);
  assert(record, '저장된 시험에도 해설이 있어야 한다: ' + q.id);
  assert(record.focus && record.answer && record.memory);
  assert.deepEqual(record.choices.map(c => c.number), q.choices.map(c => c.number));
  for (const c of record.choices) assert(c.reason.length > 20, '보기 설명이 짧거나 비어 있음');
  reviewedChoices += record.choices.length;
  const rendered = explanations.render(q);
  assert.match(rendered, /쉬운 해설 · 보기별 풀이/);
  assert.equal((rendered.match(/class="exam-study-option-heading"/g) || []).length, q.choices.length);
  assert.equal((rendered.match(/정답으로 고를 보기/g) || []).length, q.correct.length);
  for (const id of record.related) assert(html.includes('id="topic-' + id + '"'), '연관 노트: ' + id);
  for (const source of record.sources) assert.match(source.url, /^https:\/\//);
}
assert.equal(oldResult.quiz.questions.length, 40);
assert.equal(reviewedChoices, 170);
assert.equal(JSON.stringify(oldResult), saved, '해설 표시가 저장된 답안·기록을 변경해서는 안 된다');
assert.deepEqual(core.grade(oldResult), resultBefore);
assert.equal(oldResult.deadline - oldResult.startedAt, 2400000);

// When a question or its key changes, an old explanation must not be attached.
const original = quiz.questions[16];
const changed = JSON.parse(JSON.stringify(original));
changed.correct = [1];
assert.equal(explanations.forQuestion(changed), null);
assert.equal(explanations.render(changed), '');
changed.correct = original.correct;
changed.choices[0].text = '새 보기';
assert.equal(explanations.forQuestion(changed), null);
changed.choices = original.choices;
changed.prompt = '새 질문';
assert.equal(explanations.forQuestion(changed), null);
assert.equal(explanations.forQuestion({ id: 'unknown-question' }), null);
const withEditedPdfText = JSON.parse(JSON.stringify(original));
withEditedPdfText.explanation = 'PDF 설명의 줄바꿈만 바뀌었다.';
assert(explanations.forQuestion(withEditedPdfText), 'PDF 문단 수정은 새 보충 설명을 막지 않는다');

// Regression for the user's question: spell out the lights required by each choice.
const lights = explanations.forQuestion(original);
assert.match(lights.choices[0].reason, /미등 \+ 차폭등/);
assert.match(lights.choices[1].reason, /미등 \+ 차폭등/);
assert.match(lights.choices[2].reason, /미등 \+ 차폭등 \+ 번호등/);
assert.match(lights.choices[3].reason, /전조등 \+ 차폭등 \+ 미등 \+ 번호등/);

// Both new attempts and saved attempts load the same supplement before rendering.
assert(html.indexOf('src="exam-explanations.js"') < html.indexOf('src="mock-exam.js"'));
const client = fs.readFileSync(path.join(__dirname, 'mock-exam.js'), 'utf8');
const pdfBlock = client.indexOf('<b>PDF 해설</b>');
assert(pdfBlock >= 0 && client.indexOf('studyExplanations.render(q)', pdfBlock) > pdfBlock);
console.log('PASS: 40문항·170보기 해설, 저장된 결과 적용, 답안·점수·시간 보존, 문항 일치 확인');
