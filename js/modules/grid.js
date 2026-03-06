// F5 Grid — render, input, keyboard navigation, cell states

const ROWS = 5;
const COLS = 5;

let gridEl = null;
let cells = []; // 2D array of input elements
let onCellChange = null; // callback(row, col, value)

function render(container, categories, letters) {
  gridEl = container;
  gridEl.innerHTML = '';
  cells = [];

  // Corner cell
  const corner = document.createElement('div');
  corner.className = 'f5-grid__corner';
  corner.setAttribute('role', 'columnheader');
  gridEl.appendChild(corner);

  // Letter headers (top row)
  letters.forEach((letter, c) => {
    const header = document.createElement('div');
    header.className = 'f5-grid__letter-header';
    header.setAttribute('role', 'columnheader');
    header.textContent = letter;
    gridEl.appendChild(header);
  });

  // Category rows with cells
  categories.forEach((cat, r) => {
    cells[r] = [];

    // Category header
    const catHeader = document.createElement('div');
    catHeader.className = 'f5-grid__category-header';
    catHeader.setAttribute('role', 'rowheader');
    catHeader.textContent = cat.name;
    gridEl.appendChild(catHeader);

    // Input cells
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

      // Keyboard navigation
      input.addEventListener('keydown', (e) => handleKeyNav(e, r, c));

      // Auto-grow height and track changes
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

// Move with wrapping for Tab navigation
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
  focusCell(0, 0);
}

function getAnswers() {
  const answers = [];
  for (let r = 0; r < ROWS; r++) {
    answers[r] = [];
    for (let c = 0; c < COLS; c++) {
      answers[r][c] = cells[r][c] ? cells[r][c].value.replace(/\n/g, ' ').trim() : '';
    }
  }
  return answers;
}

function lock() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (cells[r][c]) {
        cells[r][c].disabled = true;
        cells[r][c].parentElement.classList.add('f5-grid__cell--locked');
      }
    }
  }
}

function unlock() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (cells[r][c]) {
        cells[r][c].disabled = false;
        cells[r][c].parentElement.classList.remove('f5-grid__cell--locked');
      }
    }
  }
}

function setOnCellChange(callback) {
  onCellChange = callback;
}

export { render, focusFirst, focusCell, getAnswers, lock, unlock, setOnCellChange };
