const fs = require('node:fs');
const path = require('node:path');
const quiz = require('./mock-exam-data.json');
const explanations = require('./exam-explanations.js');
const root = __dirname;
const output = path.join(root, '_site');

function escape(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function reviewQuestion(q, index) {
  if (!explanations.forQuestion(q)) throw new Error('보충 해설 누락: ' + q.id);
  const picture = q.image ? '<figure class="exam-figure' + (q.kind === 'sign' ? ' exam-sign-figure' : '') + '"><a href="' + escape(q.image) + '" target="_blank" rel="noopener" aria-label="문제 그림 원본 열기"><img src="' + escape(q.image) + '" alt="문제은행 ' + q.sourceNumber + '번 원본 그림" style="display:block;width:100%;height:auto" loading="lazy"></a><figcaption>그림을 누르면 원본을 크게 볼 수 있어요.</figcaption></figure>' : '';
  const context = q.context.length ? '<ul class="exam-context">' + q.context.map(text => '<li>' + escape(text) + '</li>').join('') + '</ul>' : '';
  const record = explanations.forQuestion(q);
  const related = [...new Set((q.related || []).concat(record.related))];
  return '<details class="exam-review-item"' + (index === 0 ? ' open' : '') + '><summary><span>' + (index + 1) + '. ' + escape(q.prompt) + '</span></summary><div class="exam-review-body">' + picture + context + '<p class="exam-answer-summary">정답 <b>' + q.correct.join(', ') + '번</b></p><ol class="exam-review-choices">' + q.choices.map(c => '<li class="' + (q.correct.includes(c.number) ? 'is-correct' : '') + '"><span class="exam-choice-number">' + c.number + '</span><span>' + escape(c.text) + (q.correct.includes(c.number) ? ' <b class="exam-inline-tag">정답</b>' : '') + '</span></li>').join('') + '</ol><div class="exam-explanation"><b>PDF 해설</b><p>' + escape(q.explanation) + '</p></div>' + explanations.render(q) + (related.length ? '<p class="exam-related"><b>같이 볼 노트</b><br>' + related.map(id => '<a href="#' + escape(id) + '">' + escape(titles.get(id) || '관련 노트') + ' ↗</a>').join(' · ') + '</p>' : '') + '<small class="sub">제공한 PDF · 문제은행 ' + q.sourceNumber + '번 · ' + q.page + '쪽</small></div></details>';
}

const metadata = JSON.parse(fs.readFileSync(path.join(root, '문제목록.json'), 'utf8'));
const titles = new Map(metadata.questions.map(q => [q.id, q.title]));
titles.set('glossary', '운전 용어집');
let html = fs.readFileSync(path.join(root, '오답노트.html'), 'utf8');
const start = html.indexOf('<div id="topic-mock-exam"');
const next = html.indexOf('<div id="topic-', start + 20);
if (start < 0 || next < start) throw new Error('모의고사 패널 위치를 확인해 주세요.');
const review = '<div id="topic-mock-exam" class="topic-panel" data-topic="mock-exam" hidden><div class="topic-heading">복습 / 40문항 정답·해설</div><section class="card" id="mock-exam"><span class="eyebrow">제공한 PDF / 2026.3.9. 문제은행</span><h2>40문항 복습 노트</h2><p>문제를 누르면 정답과 보기별 풀이를 바로 볼 수 있어요.</p><p class="exam-fineprint">이 페이지는 같은 40문항의 전체 해설이에요. 개인 시험 점수나 틀린 문항 기록은 포함하지 않아요.</p>' + quiz.questions.map(reviewQuestion).join('') + '</section></div>\n';
html = html.slice(0, start) + review + html.slice(next);
html = html.replace('>40문제 모의고사<small>40분 타이머 · 자동 저장 · 채점·오답 복습</small>', '>40문항 정답·해설<small>바로 읽기 · 보기별 풀이 · 연관 노트</small>');
html = html.replace(/data-announcement="[^"]*" data-announcement-topic="[^"]*"/, 'data-announcement="published-reading-notes-v1" data-announcement-topic="question-034"');
html = html.replace(/<script src="(?:exam-core|exam-explanations|mock-exam)\.js"><\/script>\s*/g, '');
const overlay = html.indexOf('<div id="exam-image-dialog"');
const navigation = html.indexOf('<script src="navigation.js"', overlay);
if (overlay >= 0 && navigation > overlay) html = html.slice(0, overlay) + html.slice(navigation);

fs.mkdirSync(output, { recursive: true });
for (const file of ['navigation.css', 'navigation.js', 'search.js', 'mock-exam.css', 'study-additions.css', '문제목록.json', '용어집.json']) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}
fs.cpSync(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
fs.writeFileSync(path.join(output, 'index.html'), html);
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log('Built _site/: 학습 노트 + 40문항 정답·보기별 해설');
