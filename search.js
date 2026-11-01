(function () {
  'use strict';
  var input = document.getElementById('note-search');
  var results = document.getElementById('search-results');
  var status = document.getElementById('search-status');
  var key = 'driving-notes:search-query';
  function normalize(text) {
    return text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');
  }
  var notes = Array.from(document.querySelectorAll('.topic-panel')).filter(function (panel) {
    return panel.dataset.topic !== 'search';
  }).map(function (panel) {
    var link = Array.from(document.querySelectorAll('.topic-link')).find(function (item) {
      return item.dataset.topic === panel.dataset.topic;
    });
    var copy = panel.cloneNode(true);
    Array.from(copy.querySelectorAll('svg, script, button, .sub a')).forEach(function (item) { item.remove(); });
    var title = link ? link.childNodes[0].textContent.trim() : panel.querySelector('h2').textContent;
    var heading = panel.querySelector('.topic-heading');
    var text = copy.textContent.replace(/\s+/g, ' ').trim();
    return { id: panel.dataset.topic, title: title, category: heading ? heading.textContent : '', text: text,
      normalized: normalize(title + ' ' + text), link: link };
  });
  function render() {
    var query = input.value.trim();
    try { localStorage.setItem(key, input.value); } catch (_) {}
    results.textContent = '';
    if (!query) {
      status.textContent = '검색어를 입력하면 노트 제목과 본문에서 찾아요.';
      return;
    }
    var words = query.split(/\s+/).map(normalize).filter(Boolean);
    var matches = notes.filter(function (note) {
      return words.every(function (word) { return note.normalized.includes(word); });
    });
    status.textContent = matches.length ? matches.length + '개 노트를 찾았어요.' : '검색 결과가 없어요. 다른 단어로 찾아보세요.';
    matches.forEach(function (note) {
      var item = document.createElement('a');
      item.className = 'search-result';
      item.href = '#' + note.id;
      var category = document.createElement('small');
      category.textContent = note.category;
      var title = document.createElement('strong');
      title.textContent = note.title;
      var excerpt = document.createElement('span');
      var position = note.text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
      if (position < 0) position = note.text.toLocaleLowerCase().indexOf(query.split(/\s+/)[0].toLocaleLowerCase());
      var start = Math.max(0, position - 35);
      excerpt.textContent = (start ? '…' : '') + note.text.slice(start, start + 150) + (note.text.length > start + 150 ? '…' : '');
      item.appendChild(category); item.appendChild(title); item.appendChild(excerpt);
      item.addEventListener('click', function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (note.link) { event.preventDefault(); note.link.click(); }
      });
      results.appendChild(item);
    });
  }
  try { input.value = localStorage.getItem(key) || ''; } catch (_) {}
  input.addEventListener('input', render);
  document.getElementById('search-clear').addEventListener('click', function () {
    input.value = ''; render(); input.focus();
  });
  document.getElementById('search-form').addEventListener('submit', function (event) { event.preventDefault(); render(); });
  render();
}());
