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

// Render a description string as safe HTML.
// Lines starting with "- " become bullet points with a hanging indent so
// wrapped text aligns with the text after the bullet, not the bullet itself.
function formatDesc(text) {
  if (!text) return '';
  const lines = text.split('\n');
  let html = '';
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (trimmed.startsWith('- ')) {
      html += '<span style="display:block;padding-left:1.2em;text-indent:-1.2em">• '
            + escHtml(trimmed.slice(2)) + '</span>';
    } else {
      html += escHtml(lines[i]);
      if (i < lines.length - 1) html += '<br>';
    }
  }
  return html;
}
