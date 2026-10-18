const presetClasses = {
  'a4-2x7': 'preset--a4-2x7',
  'a4-3x8': 'preset--a4-3x8',
  'letter-2x7': 'preset--letter-2x7',
  'letter-3x8': 'preset--letter-3x8',
};

export function renderPages(result, copy) {
  const fragment = document.createDocumentFragment();
  for (const page of result.pages) {
    const section = document.createElement('section');
    section.className = 'page-preview';
    const title = document.createElement('h3');
    title.className = 'page-caption';
    title.textContent = copy.page(page.pageIndex + 1, result.pageCount);
    const viewport = document.createElement('div');
    viewport.className = 'paper-viewport';
    viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-label', title.textContent);
    viewport.tabIndex = 0;
    const sheet = document.createElement('div');
    sheet.className = `label-sheet ${presetClasses[result.presetId]}`;
    const grid = document.createElement('div');
    grid.className = 'label-grid';
    for (const value of page.slots) {
      const cell = document.createElement('div');
      cell.className = 'label-cell';
      if (value === null) cell.setAttribute('aria-hidden', 'true');
      else {
        const name = document.createElement('span');
        name.textContent = value;
        name.dir = 'auto';
        cell.append(name);
      }
      grid.append(cell);
    }
    sheet.append(grid);
    viewport.append(sheet);
    section.append(title, viewport);
    fragment.append(section);
  }
  return fragment;
}
