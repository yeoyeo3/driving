(function () {
  'use strict';
  var links = Array.from(document.querySelectorAll('.topic-link'));
  var panels = Array.from(document.querySelectorAll('.topic-panel'));
  var storageKey = 'driving-notes:selected-topic';
  var menuButton = document.getElementById('menu-toggle');
  var sidebar = document.getElementById('study-sidebar');
  var backdrop = document.getElementById('menu-backdrop');
  function setMenu(open) {
    sidebar.hidden = !open;
    backdrop.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.textContent = open ? '✕ 메뉴 닫기' : '☰ 카테고리';
    try { localStorage.setItem('driving-notes:menu-open', String(open)); } catch (_) {}
  }
  menuButton.addEventListener('click', function () { setMenu(sidebar.hidden); });
  backdrop.addEventListener('click', function () { setMenu(false); });
  var menuOpen = false;
  try { menuOpen = localStorage.getItem('driving-notes:menu-open') === 'true'; } catch (_) {}
  setMenu(menuOpen);
  document.getElementById('search-toggle').addEventListener('click', function () {
    history.pushState(null, '', '#search');
    showTopic('search', true);
    setMenu(false);
    document.getElementById('note-search').focus();
  });
  function valid(id) {
    return panels.some(function (panel) { return panel.dataset.topic === id; });
  }
  function showTopic(id, scroll) {
    if (!valid(id)) id = panels[0].dataset.topic;
    panels.forEach(function (panel) { panel.hidden = panel.dataset.topic !== id; });
    links.forEach(function (link) {
      if (link.dataset.topic === id) {
        link.setAttribute('aria-current', 'page');
        var category = link.closest('.nav-category');
        if (category) category.open = true;
      }
      else link.removeAttribute('aria-current');
    });
    document.getElementById('license-source').hidden = id !== 'question-001';
    try { localStorage.setItem(storageKey, id); } catch (_) {}
    if (scroll) window.scrollTo(0, 0);
  }
  function fromHash() { return window.location.hash.slice(1); }
  links.forEach(function (link) {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      var id = link.dataset.topic;
      history.pushState(null, '', '#' + id);
      showTopic(id, true);
    });
  });
  window.addEventListener('hashchange', function () { showTopic(fromHash(), true); });
  window.addEventListener('popstate', function () { showTopic(fromHash(), true); });
  var saved;
  var lastSeenAddition;
  var latestTopic = panels[panels.length - 1].dataset.topic;
  var additionKey = 'driving-notes:last-added-topic';
  try {
    saved = localStorage.getItem(storageKey);
    lastSeenAddition = localStorage.getItem(additionKey);
  } catch (_) {}
  var isNewTopic = lastSeenAddition !== latestTopic;
  var main = document.querySelector('main');
  var announcement = main.dataset.announcement;
  var announcementTopic = main.dataset.announcementTopic;
  var hasAnnouncement = false;
  try { hasAnnouncement = announcement && localStorage.getItem('driving-notes:announcement') !== announcement; } catch (_) {}
  var initialTopic = hasAnnouncement && valid(announcementTopic) ? announcementTopic : isNewTopic ? latestTopic : valid(fromHash()) ? fromHash() : valid(saved) ? saved : latestTopic;
  if (isNewTopic || hasAnnouncement) history.replaceState(null, '', '#' + initialTopic);
  showTopic(initialTopic, false);
  try { localStorage.setItem(additionKey, latestTopic); } catch (_) {}
  try { if (announcement) localStorage.setItem('driving-notes:announcement', announcement); } catch (_) {}
}());
