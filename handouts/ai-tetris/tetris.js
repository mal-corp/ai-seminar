// ==== Константы ====
const COLS = 10;
const ROWS = 20;
const BLOCK = 30; // размер клетки (300/10, 600/20)

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const restartBtn = document.getElementById('restartBtn');

// ==== Фигуры ====
const SHAPES = {
  I: [[1,1,1,1]],
  J: [[1,0,0],[1,1,1]],
  L: [[0,0,1],[1,1,1]],
  O: [[1,1],[1,1]],
  S: [[0,1,1],[1,1,0]],
  T: [[0,1,0],[1,1,1]],
  Z: [[1,1,0],[0,1,1]]
};

const COLORS = {
  I: '#00f0f0',
  J: '#0040f0',
  L: '#f0a000',
  O: '#f0f000',
  S: '#00f000',
  T: '#a000f0',
  Z: '#f00000'
};

// ==== Состояние ====
let board, current, next, score, lines, level, dropInterval, dropCounter, lastTime, isPaused, isGameOver, animationId;

// ==== Инициализация ====
function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function createPiece(type) {
  return {
    type,
    shape: SHAPES[type].map(row => [...row]),
    x: Math.floor((COLS - SHAPES[type][0].length) / 2),
    y: 0
  };
}

function randomPiece() {
  const types = Object.keys(SHAPES);
  return createPiece(types[Math.floor(Math.random() * types.length)]);
}

function reset() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  dropInterval = 1000;
  dropCounter = 0;
  isPaused = false;
  isGameOver = false;
  next = randomPiece();
  spawnPiece();
  updateUI();
  lastTime = performance.now();
  if (animationId) cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(update);
}

function spawnPiece() {
  current = next;
  next = randomPiece();
  current.x = Math.floor((COLS - current.shape[0].length) / 2);
  current.y = 0;

  if (collide(current.shape, current.x, current.y)) {
    isGameOver = true;
    showOverlay('Игра окончена', `Ваш счёт: ${score}`, 'Играть снова');
  }
  drawNext();
}

// ==== Логика столкновений ====
function collide(shape, px, py) {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) {
        const bx = px + x;
        const by = py + y;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && board[by][bx]) return true;
      }
    }
  }
  return false;
}

function merge() {
  current.shape.forEach((row, y) => {
    row.forEach((val, x) => {
      if (val) {
        const by = current.y + y;
        const bx = current.x + x;
        if (by >= 0) board[by][bx] = current.type;
      }
    });
  });
}

// ==== Вращение ====
function rotate(matrix, dir) {
  const N = matrix.length;
  const M = matrix[0].length;
  const result = Array.from({ length: M }, () => Array(N).fill(0));
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < M; x++) {
      if (dir > 0) result[x][N - 1 - y] = matrix[y][x];
      else result[M - 1 - x][y] = matrix[y][x];
    }
  }
  return result;
}

function rotateCurrent() {
  const rotated = rotate(current.shape, 1);
  // Выход за границы — сдвигаем
  for (let offset = 1; offset <= 2; offset++) {
    if (!collide(rotated, current.x + offset, current.y)) {
      current.shape = rotated;
      current.x += offset;
      return;
    }
    if (!collide(rotated, current.x - offset, current.y)) {
      current.shape = rotated;
      current.x -= offset;
      return;
    }
  }
  // Стена (wall kick): пробуем сдвиг вверх
  if (!collide(rotated, current.x, current.y - 1)) {
    current.shape = rotated;
    current.y -= 1;
  }
}

// ==== Движение ====
function move(dir) {
  if (!collide(current.shape, current.x + dir, current.y)) {
    current.x += dir;
  }
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    dropCounter = 0;
  } else {
    lockPiece();
  }
}

function hardDrop() {
  while (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 2;
  }
  lockPiece();
}

function lockPiece() {
  merge();
  clearLines();
  spawnPiece();
  dropCounter = 0;
  updateUI();
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(cell => cell !== null)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared++;
      y++; // проверить эту строку заново
    }
  }
  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800][cleared] * level;
    score += points;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 100);
  }
}

// ==== Отрисовка ====
function drawBlock(context, x, y, color, size = BLOCK) {
  context.fillStyle = color;
  context.fillRect(x * size, y * size, size, size);
  // Блик
  context.fillStyle = 'rgba(255,255,255,0.2)';
  context.fillRect(x * size, y * size, size, size / 4);
  // Тень
  context.fillStyle = 'rgba(0,0,0,0.25)';
  context.fillRect(x * size, y * size + size * 0.75, size, size / 4);
  // Рамка
  context.strokeStyle = 'rgba(0,0,0,0.5)';
  context.lineWidth = 1;
  context.strokeRect(x * size + 0.5, y * size + 0.5, size - 1, size - 1);
}

function draw() {
  // Фон
  ctx.fillStyle = '#16213e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Сетка
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK, 0);
    ctx.lineTo(x * BLOCK, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK);
    ctx.lineTo(canvas.width, y * BLOCK);
    ctx.stroke();
  }

  // Зафиксированные блоки
  board.forEach((row, y) => {
    row.forEach((type, x) => {
      if (type) drawBlock(ctx, x, y, COLORS[type]);
    });
  });

  // Текущая фигура + призрак
  if (current && !isGameOver) {
    // Призрак
    let ghostY = current.y;
    while (!collide(current.shape, current.x, ghostY + 1)) ghostY++;
    current.shape.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val) {
          const gy = ghostY + y;
          if (gy >= 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect((current.x + x) * BLOCK, gy * BLOCK, BLOCK, BLOCK);
          }
        }
      });
    });

    // Фигура
    current.shape.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val && current.y + y >= 0) {
          drawBlock(ctx, current.x + x, current.y + y, COLORS[current.type]);
        }
      });
    });
  }

  // Пауза
  if (isPaused && !isGameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('ПАУЗА', canvas.width / 2, canvas.height / 2);
  }
}

function drawNext() {
  nextCtx.fillStyle = '#16213e';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!next) return;
  const size = 24;
  const shape = next.shape;
  const offsetX = (nextCanvas.width - shape[0].length * size) / 2;
  const offsetY = (nextCanvas.height - shape.length * size) / 2;

  shape.forEach((row, y) => {
    row.forEach((val, x) => {
      if (val) {
        const px = (offsetX + x * size) / size;
        const py = (offsetY + y * size) / size;
        drawBlock(nextCtx, px, py, COLORS[next.type], size);
      }
    });
  });
}

// ==== UI ====
function updateUI() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function showOverlay(title, text, btnText) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  restartBtn.textContent = btnText;
  overlay.classList.add('active');
}

function hideOverlay() {
  overlay.classList.remove('active');
}

// ==== Игровой цикл ====
function update(time = performance.now()) {
  const delta = time - lastTime;
  lastTime = time;

  if (!isPaused && !isGameOver) {
    dropCounter += delta;
    if (dropCounter > dropInterval) {
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
      dropCounter = 0;
    }
  }

  draw();
  animationId = requestAnimationFrame(update);
}

// ==== Управление ====
document.addEventListener('keydown', (e) => {
  if (isGameOver) return;

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      if (!isPaused) move(-1);
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (!isPaused) move(1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      if (!isPaused) softDrop();
      break;
    case 'ArrowUp':
      e.preventDefault();
      if (!isPaused) rotateCurrent();
      break;
    case ' ':
      e.preventDefault();
      if (!isPaused) hardDrop();
      break;
    case 'p':
    case 'P':
    case 'з':
    case 'З':
      isPaused = !isPaused;
      break;
  }
});

restartBtn.addEventListener('click', () => {
  hideOverlay();
  reset();
});

// ==== Старт ====
reset();
showOverlay('Тетрис', 'Нажмите, чтобы начать', 'Начать');