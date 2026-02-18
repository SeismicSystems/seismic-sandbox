export function highlightJSON(obj, indent = 2) {
  const raw = JSON.stringify(obj, null, indent);
  return raw.replace(
    /("(?:\\.|[^"\\])*")\s*(:)?|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, str, colon, bool, num) => {
      if (str) {
        if (colon) {
          return `<span class="json-key">${esc(str)}</span>:`;
        }
        if (/^"0x[0-9a-fA-F]+"$/.test(str)) {
          return `<span class="json-hex">${esc(str)}</span>`;
        }
        return `<span class="json-string">${esc(str)}</span>`;
      }
      if (bool) return `<span class="json-bool">${esc(bool)}</span>`;
      if (num) return `<span class="json-number">${esc(num)}</span>`;
      return esc(match);
    }
  );
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
