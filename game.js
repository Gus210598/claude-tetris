'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
  '#90a4ae', // Nut - steel gray
];

// Per-skin color tables. Same 8-entry piece-index mapping as COLORS.
const SKIN_COLORS = {
  retro: COLORS,
  neon: [
    null,
    '#00e5ff', // I - cyan
    '#fff200', // O - yellow
    '#e040fb', // T - purple
    '#00ff85', // S - green
    '#ff1744', // Z - red
    '#2979ff', // J - pale blue
    '#ff9100', // L - orange
    '#b0bec5', // Nut - steel gray
  ],
  pastel: [
    null,
    '#a7e3ea', // I - cyan
    '#fbe7a1', // O - yellow
    '#d9b3e0', // T - purple
    '#b8ddb0', // S - green
    '#f0b3b0', // Z - red
    '#b3cdf0', // J - pale blue
    '#f5cda3', // L - orange
    '#c9d2d6', // Nut - steel gray
  ],
  pixel: [
    null,
    '#4dd0e1', // I - cyan
    '#ffd54f', // O - yellow
    '#ba68c8', // T - purple
    '#81c784', // S - green
    '#e57373', // Z - red
    '#64b5f6', // J - pale blue
    '#ffb74d', // L - orange
    '#90a4ae', // Nut - steel gray
  ],
};

const SKINS = ['retro', 'neon', 'pastel', 'pixel'];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Nut (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

const THEME_KEY = 'tetris-theme';
const SKIN_KEY = 'tetris-skin';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, gridColor, activeSkin;

function applyTheme(isLight) {
  document.documentElement.classList.toggle('light', isLight);
  localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
  themeToggle.checked = isLight;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim();
}

themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked));

function applySkin(name) {
  if (!SKIN_COLORS[name]) name = 'retro';
  SKINS.forEach(s => document.documentElement.classList.remove('skin-' + s));
  if (name !== 'retro') document.documentElement.classList.add('skin-' + name);
  localStorage.setItem(SKIN_KEY, name);
  activeSkin = name;
  skinSelect.value = name;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim();
  if (typeof board !== 'undefined' && board) draw();
}

skinSelect.addEventListener('change', () => applySkin(skinSelect.value));

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = activeSkin || 'retro';
  const palette = SKIN_COLORS[skin] || COLORS;
  const color = palette[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const w = size - 2;
  const h = size - 2;

  context.globalAlpha = alpha ?? 1;

  if (skin === 'neon') {
    context.save();
    context.shadowColor = color;
    context.shadowBlur = size * 0.6;
    context.fillStyle = color;
    context.fillRect(px, py, w, h);
    context.fillRect(px, py, w, h); // second pass intensifies glow
    context.restore();
    context.strokeStyle = 'rgba(255,255,255,0.5)';
    context.lineWidth = 1;
    context.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1);
  } else if (skin === 'pastel') {
    const radius = Math.min(6, w / 3, h / 3);
    context.fillStyle = color;
    context.beginPath();
    if (typeof context.roundRect === 'function') {
      context.roundRect(px, py, w, h, radius);
    } else {
      // manual rounded-rect path fallback
      context.moveTo(px + radius, py);
      context.lineTo(px + w - radius, py);
      context.arcTo(px + w, py, px + w, py + radius, radius);
      context.lineTo(px + w, py + h - radius);
      context.arcTo(px + w, py + h, px + w - radius, py + h, radius);
      context.lineTo(px + radius, py + h);
      context.arcTo(px, py + h, px, py + h - radius, radius);
      context.lineTo(px, py + radius);
      context.arcTo(px, py, px + radius, py, radius);
      context.closePath();
    }
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.25)';
    context.beginPath();
    if (typeof context.roundRect === 'function') {
      context.roundRect(px, py, w, h * 0.35, [radius, radius, 0, 0]);
      context.fill();
    }
  } else if (skin === 'pixel') {
    context.fillStyle = color;
    context.fillRect(px, py, w, h);
    // checkerboard texture overlay
    const cell = Math.max(3, Math.floor(size / 5));
    context.fillStyle = 'rgba(0,0,0,0.18)';
    for (let gy = 0; gy * cell < h; gy++) {
      for (let gx = 0; gx * cell < w; gx++) {
        if ((gx + gy) % 2 === 0) {
          const bw = Math.min(cell, w - gx * cell);
          const bh = Math.min(cell, h - gy * cell);
          context.fillRect(px + gx * cell, py + gy * cell, bw, bh);
        }
      }
    }
    context.strokeStyle = 'rgba(0,0,0,0.4)';
    context.lineWidth = 1;
    context.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1);
  } else {
    // retro
    context.fillStyle = color;
    context.fillRect(px, py, w, h);
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(px, py, w, 4);
  }

  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  applyTheme(document.documentElement.classList.contains('light'));
  applySkin(localStorage.getItem(SKIN_KEY) || 'retro');
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

init();
