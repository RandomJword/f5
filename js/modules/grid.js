// F5 Grid — render, input, keyboard navigation, cell states
// Supports desktop grid and mobile card mode

const ROWS = 5;
const COLS = 5;
const MOBILE_BREAKPOINT = 600;

let gridEl = null;
let cells = []; // 2D array of input elements
let onCellChange = null;
let isMobile = false;
let mobileIndex = 0; // current category card index
let categories = [];
let letters = [];

function detectMobile() {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

function render(container, cats, ltrs) {
  gridEl = container;
  categories = cats;
  letters = ltrs;
  isMobile = detectMobile();

  if (isMobile) {
    renderMobile();
  } else {
    renderDesktop();
  }
}

function renderDesktop() {
  gridEl.innerHTML = '';
  gridEl.className = 'f5-grid';
  cells = [];

  const corner = document.createElement('div');
  corner.className = 'f5-grid__corner';
  corner.setAttribute('role', 'columnheader');
  gridEl.appendChild(corner);

  letters.forEach((letter) => {
    const header = document.createElement('div');
    header.className = 'f5-grid__letter-header';
    header.setAttribute('role', 'columnheader');
    header.textContent = letter;
    gridEl.appendChild(header);
  });

  categories.forEach((cat, r) => {
    cells[r] = [];

    const catHeader = document.createElement('div');
    catHeader.className = 'f5-grid__category-header';
    catHeader.setAttribute('role', 'rowheader');
    catHeader.textContent = cat.name;
    gridEl.appendChild(catHeader);

    letters.forEach((letter, c) => {
      const cell = document.createElement('div');
      cell.className = 'f5-grid__cell';
      cell.setAttribute('role', 'gridcell');

      const input = document.createElement('textarea');
      input.className = 'f5-grid__input';
      input.maxLength = 60;
      input.rows = 1;
      input.setAttribute('aria-label', `${cat.name} starting with ${letter}`);
      input.dataset.row = r;
      input.dataset.col = c;

      input.addEventListener('keydown', (e) => handleKeyNav(e, r, c));
      input.addEventListener('input', () => {
        autoGrow(input);
        if (onCellChange) onCellChange(r, c, input.value);
      });

      cell.appendChild(input);
      gridEl.appendChild(cell);
      cells[r][c] = input;
    });
  });
}

function renderMobile() {
  gridEl.innerHTML = '';
  gridEl.className = 'f5-grid f5-grid--mobile';
  cells = [];
  mobileIndex = 0;

  // Dot navigation
  const nav = document.createElement('div');
  nav.className = 'f5-mobile-nav';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'f5-mobile-nav__arrow';
  prevBtn.textContent = '\u2039';
  prevBtn.setAttribute('aria-label', 'Previous category');
  prevBtn.addEventListener('click', () => showCard(mobileIndex - 1));

  const dots = document.createElement('div');
  dots.className = 'f5-mobile-nav__dots';
  dots.id = 'mobile-dots';

  for (let i = 0; i < ROWS; i++) {
    const dot = document.createElement('button');
    dot.className = 'f5-mobile-nav__dot' + (i === 0 ? ' active' : '');
    dot.dataset.index = i;
    dot.setAttribute('aria-label', `Category ${i + 1}`);
    dot.addEventListener('click', () => showCard(i));
    dots.appendChild(dot);
  }

  const nextBtn = document.createElement('button');
  nextBtn.className = 'f5-mobile-nav__arrow';
  nextBtn.textContent = '\u203A';
  nextBtn.setAttribute('aria-label', 'Next category');
  nextBtn.addEventListener('click', () => showCard(mobileIndex + 1));

  nav.appendChild(prevBtn);
  nav.appendChild(dots);
  nav.appendChild(nextBtn);
  gridEl.appendChild(nav);

  // Cards container
  const cardsWrap = document.createElement('div');
  cardsWrap.className = 'f5-mobile-cards';
  cardsWrap.id = 'mobile-cards';

  categories.forEach((cat, r) => {
    cells[r] = [];

    const card = document.createElement('div');
    card.className = 'f5-mobile-card' + (r === 0 ? ' active' : '');
    card.dataset.index = r;

    const catName = document.createElement('div');
    catName.className = 'f5-mobile-card__category';
    catName.textContent = cat.name;
    card.appendChild(catName);

    const fields = document.createElement('div');
    fields.className = 'f5-mobile-card__fields';

    letters.forEach((letter, c) => {
      const field = document.createElement('div');
      field.className = 'f5-mobile-card__field';

      const label = document.createElement('div');
      label.className = 'f5-mobile-card__letter';
      label.textContent = letter;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'f5-mobile-card__input';
      input.maxLength = 60;
      input.placeholder = `${letter}...`;
      input.setAttribute('aria-label', `${cat.name} starting with ${letter}`);
      input.dataset.row = r;
      input.dataset.col = c;
      input.autocomplete = 'off';
      input.autocapitalize = 'words';

      input.addEventListener('keydown', (e) => handleMobileKeyNav(e, r, c));
      input.addEventListener('input', () => {
        if (onCellChange) onCellChange(r, c, input.value);
      });

      field.appendChild(label);
      field.appendChild(input);
      fields.appendChild(field);
      cells[r][c] = input;
    });

    card.appendChild(fields);
    cardsWrap.appendChild(card);
  });

  gridEl.appendChild(cardsWrap);

  // Swipe support
  let touchStartX = 0;
  cardsWrap.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  cardsWrap.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      if (dx < 0) showCard(mobileIndex + 1);
      else showCard(mobileIndex - 1);
    }
  }, { passive: true });
}

function showCard(index) {
  if (index < 0 || index >= ROWS) return;
  mobileIndex = index;

  const cards = gridEl.querySelectorAll('.f5-mobile-card');
  cards.forEach((card, i) => {
    card.classList.toggle('active', i === index);
  });

  const dots = gridEl.querySelectorAll('.f5-mobile-nav__dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
}

function handleMobileKeyNav(e, row, col) {
  if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault();
    if (e.shiftKey) {
      // Back
      if (col > 0) focusCell(row, col - 1);
      else if (row > 0) { showCard(row - 1); focusCell(row - 1, COLS - 1); }
    } else {
      // Forward
      if (col < COLS - 1) focusCell(row, col + 1);
      else if (row < ROWS - 1) { showCard(row + 1); focusCell(row + 1, 0); }
    }
  }
}

function handleKeyNav(e, row, col) {
  const input = e.target;
  const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
  const atEnd = input.selectionStart === input.value.length;
  const isEmpty = input.value.length === 0;

  switch (e.key) {
    case 'Tab':
      e.preventDefault();
      if (e.shiftKey) {
        moveTo(row, col - 1, -1);
      } else {
        moveTo(row, col + 1, 1);
      }
      break;

    case 'Enter':
      e.preventDefault();
      if (row + 1 < ROWS) focusCell(row + 1, col);
      else focusCell(0, col);
      break;

    case 'ArrowUp':
      e.preventDefault();
      if (row > 0) focusCell(row - 1, col);
      break;

    case 'ArrowDown':
      e.preventDefault();
      if (row < ROWS - 1) focusCell(row + 1, col);
      break;

    case 'ArrowLeft':
      if (atStart || isEmpty) {
        e.preventDefault();
        if (col > 0) focusCell(row, col - 1);
      }
      break;

    case 'ArrowRight':
      if (atEnd || isEmpty) {
        e.preventDefault();
        if (col < COLS - 1) focusCell(row, col + 1);
      }
      break;
  }
}

function moveTo(row, col, direction) {
  if (col >= COLS) {
    col = 0;
    row++;
  } else if (col < 0) {
    col = COLS - 1;
    row--;
  }
  if (row >= ROWS) row = 0;
  if (row < 0) row = ROWS - 1;
  focusCell(row, col);
}

function autoGrow(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

function focusCell(row, col) {
  if (cells[row] && cells[row][col]) {
    cells[row][col].focus();
  }
}

function focusFirst() {
  if (isMobile) {
    showCard(0);
    setTimeout(() => focusCell(0, 0), 50);
  } else {
    focusCell(0, 0);
  }
}

function getAnswers() {
  const answers = [];
  for (let r = 0; r < ROWS; r++) {
    answers[r] = [];
    for (let c = 0; c < COLS; c++) {
      const val = cells[r][c] ? cells[r][c].value : '';
      answers[r][c] = val.replace(/\n/g, ' ').trim();
    }
  }
  return answers;
}

function lock() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (cells[r][c]) {
        cells[r][c].disabled = true;
        if (cells[r][c].parentElement) {
          cells[r][c].parentElement.classList.add('f5-grid__cell--locked');
        }
      }
    }
  }
}

function unlock() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (cells[r][c]) {
        cells[r][c].disabled = false;
        if (cells[r][c].parentElement) {
          cells[r][c].parentElement.classList.remove('f5-grid__cell--locked');
        }
      }
    }
  }
}

function setOnCellChange(callback) {
  onCellChange = callback;
}

export { render, focusFirst, focusCell, getAnswers, lock, unlock, setOnCellChange };
