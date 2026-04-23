'use strict';

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function lotLabel(n) {
  if (n >= 200) return 'I' + (n - 200);
  if (n >= 100) return 'S' + (n - 100);
  return String(n);
}
