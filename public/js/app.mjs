import { calculateLabels } from './core/label-printer.mjs';
import { messages, errorMessage } from './messages.mjs';
import { renderPages } from './render.mjs';

const form = document.getElementById('label-form');
let submitWork = null;
// Install the fail-closed submission boundary before any other listener or enabling.
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (submitWork) submitWork();
}, { capture: true });

function initialize() {
  const byId = (id) => {
    const element = document.getElementById(id);
    if (!element) throw new Error('Missing interface element');
    return element;
  };
  const copy = messages[document.documentElement.lang];
  if (!copy) throw new Error('Unsupported interface language');
  const items = byId('items');
  const copies = byId('copies');
  const presetGroup = byId('presets');
  const presets = [...presetGroup.querySelectorAll('input[type="radio"]')];
  const controls = [...document.querySelectorAll('[data-enable]')];
  const preview = byId('preview');
  const pages = byId('pages');
  const status = byId('status');
  const summary = byId('preview-summary');
  const idle = byId('preview-idle');
  const printButton = byId('print');
  const buildButton = byId('build');
  const error = byId('form-error');
  const itemsError = byId('items-error');
  const copiesError = byId('copies-error');
  const presetError = byId('preset-error');
  const dialog = byId('confirm-dialog');
  const dialogTitle = byId('confirm-title');
  const dialogBody = byId('confirm-body');
  const dialogCancel = byId('confirm-cancel');
  const dialogConfirm = byId('confirm-accept');
  const languageButton = byId('language');
  const languageTarget = document.documentElement.lang === 'en' ? '/index.html' : '/en/index.html';
  let revision = 0;
  let generation = 0;
  let current = null;
  let pending = null;
  let returnFocus = null;

  function clearErrors() {
    for (const element of [error, itemsError, copiesError, presetError]) {
      element.textContent = '';
      element.hidden = true;
    }
    for (const element of [items, copies, presetGroup]) element.removeAttribute('aria-invalid');
    for (const element of presets) element.removeAttribute('aria-invalid');
  }

  function invalidate(message = copy.changed) {
    revision += 1;
    current = null;
    pages.replaceChildren();
    preview.hidden = true;
    printButton.disabled = true;
    printButton.hidden = true;
    buildButton.classList.add('primary');
    summary.textContent = '';
    idle.hidden = false;
    status.textContent = message;
    clearErrors();
  }

  function reset() {
    generation += 1;
    invalidate(copy.idle);
    items.value = '';
    copies.value = '1';
    for (const preset of presets) preset.checked = preset.value === 'a4-2x7';
    revision = 0;
    pending = null;
    returnFocus = null;
    if (dialog.open) dialog.close();
  }

  function hasWork() {
    return items.value !== '' || current !== null || copies.value !== '1'
      || !presets.find((preset) => preset.value === 'a4-2x7').checked;
  }

  function ask(kind, opener) {
    pending = { kind, generation };
    returnFocus = opener;
    dialogTitle.textContent = copy[`${kind}Title`];
    dialogBody.textContent = copy[`${kind}Body`];
    dialogCancel.textContent = copy[`${kind}Cancel`];
    dialogConfirm.textContent = copy[`${kind}Confirm`];
    dialog.showModal();
    dialogCancel.focus();
  }

  function cancelDialog() {
    const opener = returnFocus;
    pending = null;
    returnFocus = null;
    dialog.close();
    opener?.focus();
  }

  function showError(failure) {
    const text = errorMessage(copy, failure);
    let target = items;
    let message = itemsError;
    if (failure.field === 'copiesRaw') { target = copies; message = copiesError; }
    if (failure.field === 'presetId') { target = presets[0]; message = presetError; }
    if (failure.field === 'totalLabels') {
      items.setAttribute('aria-invalid', 'true');
      copies.setAttribute('aria-invalid', 'true');
    }
    target.setAttribute('aria-invalid', 'true');
    if (failure.field === 'presetId') {
      presetGroup.setAttribute('aria-invalid', 'true');
      for (const preset of presets) preset.setAttribute('aria-invalid', 'true');
    }
    error.textContent = text;
    error.hidden = false;
    if (failure.field !== 'totalLabels') {
      message.textContent = text;
      message.hidden = false;
    }
    target.focus();
  }

  for (const element of [items, copies]) element.addEventListener('input', () => invalidate());
  for (const preset of presets) {
    // Avoid radio grouping names so even an interrupted initialization cannot submit data.
    preset.addEventListener('change', () => {
      if (preset.checked) for (const other of presets) if (other !== preset) other.checked = false;
      invalidate();
    });
    preset.addEventListener('keydown', (event) => {
      const direction = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
      if (!direction) return;
      event.preventDefault();
      const selected = presets[(presets.indexOf(preset) + direction + presets.length) % presets.length];
      for (const other of presets) other.checked = other === selected;
      invalidate();
      selected.focus();
    });
  }
  byId('example').addEventListener('click', () => {
    invalidate(copy.example);
    items.value = copy.sample;
    items.focus();
  });
  byId('clear').addEventListener('click', (event) => {
    if (hasWork()) ask('clear', event.currentTarget);
    else { reset(); items.focus(); }
  });
  languageButton.addEventListener('click', () => ask('language', languageButton));
  dialogCancel.addEventListener('click', cancelDialog);
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); cancelDialog(); });
  dialogConfirm.addEventListener('click', () => {
    if (!pending || pending.generation !== generation) { cancelDialog(); return; }
    const kind = pending.kind;
    reset();
    if (kind === 'language') window.location.assign(languageTarget);
    else items.focus();
  });
  printButton.addEventListener('click', () => {
    if (!current || current.revision !== revision || current.generation !== generation || printButton.disabled) return;
    window.print();
  });
  window.addEventListener('pagehide', reset);
  window.addEventListener('pageshow', (event) => { if (event.persisted) reset(); });

  const build = () => {
    invalidate('');
    const outcome = calculateLabels({
      itemsRaw: items.value,
      copiesRaw: copies.value,
      presetId: presets.find((preset) => preset.checked)?.value ?? '',
    });
    if (!outcome.ok) { showError(outcome.error); return; }
    const fragment = renderPages(outcome.result, copy);
    pages.replaceChildren(fragment);
    current = { revision, generation, result: outcome.result };
    summary.textContent = copy.summary(outcome.result);
    status.textContent = copy.ready(outcome.result.totalLabels, outcome.result.pageCount);
    preview.hidden = false;
    idle.hidden = true;
    printButton.hidden = false;
    printButton.disabled = false;
    buildButton.classList.remove('primary');
  };
  reset();
  submitWork = build;
  for (const control of controls) control.disabled = false;
  byId('startup-note').hidden = true;
}

try { initialize(); } catch {
  submitWork = null;
  for (const control of document.querySelectorAll('[data-enable]')) control.disabled = true;
}
