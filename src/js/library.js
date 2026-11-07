const NOTE = 'These open the files already on this Mac. They are not part of the built-in course.';
const GROUPS = ['Primers', 'Song charts', 'Lesson sheets', 'Lesson recordings'];

let entries = null;
let query = '';
let loading = false;
let openError = '';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value == null || value === false) return;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  });
  children.forEach((child) => {
    if (child == null) return;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  });
  return node;
}

function paint() {
  const root = document.getElementById('library');
  if (!root) return;
  const previous = document.activeElement;
  const typing = previous?.dataset?.action === 'library-query';
  const caret = typing ? previous.selectionStart : null;
  root.replaceChildren();
  root.append(el('p', { class: 'library-note', text: NOTE }));
  root.append(el('input', {
    class: 'library-search',
    type: 'search',
    placeholder: 'Search',
    value: query,
    'data-action': 'library-query',
    'aria-label': 'Search library',
  }));

  if (loading || !entries) {
    root.append(el('p', { class: 'rail-foot', text: 'Checking which files are on this Mac.' }));
  } else {
    const needle = query.trim().toLowerCase();
    let shown = 0;
    GROUPS.forEach((group) => {
      const rows = entries.filter((item) => item.group === group && (!needle || item.name.toLowerCase().includes(needle)));
      if (!rows.length) return;
      shown += rows.length;
      const section = el('section', { class: 'library-group' });
      section.append(el('h2', { text: group }));
      rows.forEach((item) => {
        section.append(el('div', { class: 'library-row' }, [
          el('span', { class: 'library-name', text: item.name, title: item.name }),
          el('button', {
            type: 'button',
            'data-action': 'library-open',
            'data-path': item.path,
            text: 'Open',
          }),
        ]));
      });
      root.append(section);
    });
    if (!shown) {
      root.append(el('p', {
        class: 'rail-foot',
        text: needle ? 'Nothing under that name.' : 'None of those files are on this Mac.',
      }));
    }
  }
  if (openError) root.append(el('p', { class: 'error', text: openError }));
  if (typing) {
    const input = root.querySelector('[data-action="library-query"]');
    input.focus();
    const pos = caret ?? input.value.length;
    input.setSelectionRange(pos, pos);
  }
}

export function renderLibrary() {
  const root = document.getElementById('library');
  if (!root) return;
  if (!entries && !loading) {
    loading = true;
    paint();
    const api = window.straightBar;
    if (!api?.listLibrary) {
      loading = false;
      entries = [];
      openError = 'Opening files needs the Straight Bar desktop app.';
      paint();
      return;
    }
    api.listLibrary().then((rows) => {
      entries = Array.isArray(rows) ? rows : [];
      loading = false;
      paint();
    }).catch(() => {
      entries = [];
      loading = false;
      openError = 'The library could not be read.';
      paint();
    });
    return;
  }
  paint();
}

export function setLibraryQuery(value) {
  query = value;
  openError = '';
  paint();
}

export async function openLibraryFile(filePath) {
  openError = '';
  const api = window.straightBar;
  if (!api?.openLibraryFile) {
    openError = 'Opening files needs the Straight Bar desktop app.';
    paint();
    return;
  }
  try {
    const result = await api.openLibraryFile(filePath);
    if (result?.error) openError = result.error;
  } catch {
    openError = 'That file could not be opened.';
  }
  paint();
}
