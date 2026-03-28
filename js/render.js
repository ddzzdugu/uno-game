/**
 * render.js — All DOM rendering. No game logic, only reads gs.
 */

import { gs } from './state.js';
import { isHumanPlayable, topCard, topColor } from './rules.js';

const PLAYER_COLORS = ['#a855f7', '#c94455', '#3d9b5a'];

const COLOR_HEX = {
  red: '#c94455', blue: '#4a7ec0', green: '#3d9b5a',
  yellow: '#d4b830', wild: '#1a1a1a',
};

const ACTION_SYMBOL = { Skip: '⊘', Reverse: '↺', 'Draw Two': '+2' };

// ── Card element factory ─────────────────────────────────────

/**
 * Create a card <div> element.
 * @param {Object}  card
 * @param {boolean} [faceDown=false]
 * @param {boolean} [humanPlayable=false]
 */
export const makeCardEl = (card, { faceDown = false, humanPlayable = false } = {}) => {
  const el = document.createElement('div');
  el.className = 'card';

  if (faceDown) {
    el.classList.add('back');
    el.innerHTML = `<div class="card-back-inner"><div class="back-oval"><span>UNO</span></div></div>`;
    return el;
  }

  el.classList.add(card.color);

  let cornerText, centerHtml;
  if (card.type === 'wild') {
    if (card.value === 'Wild Draw Four') {
      cornerText = '+4';
      centerHtml = `<div class="wild-squares">
        <div class="ws ws-r"></div><div class="ws ws-b"></div>
        <div class="ws ws-y"></div><div class="ws ws-g"></div>
      </div>`;
    } else if (card.value === 'Swap Hands') {
      cornerText = '🔄';
      centerHtml = `<div class="card-center action-sym" style="font-size:1.8em;line-height:1">🔄</div>`;
    } else {
      cornerText = '🌈';
      centerHtml = `<div class="wild-circle"></div>`;
    }
  } else if (card.type === 'action') {
    cornerText = ACTION_SYMBOL[card.value] ?? card.value;
    centerHtml = `<div class="card-center action-sym">${cornerText}</div>`;
  } else {
    cornerText = card.value;
    centerHtml = `<div class="card-center">${card.value}</div>`;
  }

  el.innerHTML = `<div class="card-face">
    <span class="corner tl">${cornerText}</span>
    ${centerHtml}
    <span class="corner br">${cornerText}</span>
  </div>`;

  el.classList.add(humanPlayable ? 'playable' : 'disabled');
  return el;
};

// ── Hand rendering ───────────────────────────────────────────

export const renderHand = (playerIdx, handElId, faceDown) => {
  const handEl = document.getElementById(handElId);
  handEl.innerHTML = '';
  gs.hands[playerIdx].forEach(card => {
    const playable = !faceDown && isHumanPlayable(card);
    const el = makeCardEl(card, { faceDown, humanPlayable: playable });
    if (!faceDown) {
      el.dataset.id = card.id;
      el.addEventListener('click', () => window.onCardClick?.(card.id));
    }
    handEl.appendChild(el);
  });
};

// ── Discard pile rendering ───────────────────────────────────

export const renderDiscardTop = () => {
  const container = document.getElementById('discard-top');
  container.innerHTML = '';
  if (!gs.discardPile.length) return;

  // Show up to 3 cards from the pile, rotated to look messy
  const total   = gs.discardPile.length;
  const numShow = Math.min(total, 3);
  const rotations = [-13, 9, -3]; // [3rd from top, 2nd from top, top]
  const rots = rotations.slice(rotations.length - numShow);

  for (let i = 0; i < numShow; i++) {
    const card = gs.discardPile[total - numShow + i];
    const el   = makeCardEl(card, { faceDown: false, humanPlayable: false });
    el.classList.remove('disabled');
    el.style.position     = 'absolute';
    el.style.top          = '0';
    el.style.left         = '0';
    el.style.zIndex       = String(i + 1);
    el.style.transform    = `rotate(${rots[i]}deg)`;
    if (i < numShow - 1) el.style.pointerEvents = 'none';
    container.appendChild(el);
  }

  document.getElementById('color-indicator').style.background =
    COLOR_HEX[topColor()] ?? '#a855f7';
};

// ── Badge & counter updates ──────────────────────────────────

export const updateBadges = () => {
  for (let i = 0; i < 3; i++) {
    const b = document.getElementById(`badge-${i}`);
    if (b) b.textContent = gs.hands[i].length;
  }
  const dc = document.getElementById('deck-count');
  if (dc) dc.textContent = gs.deck.length;
};

// ── Active-turn highlights ───────────────────────────────────

export const updateNameTagHighlights = () => {
  const isPlaying = gs.phase === 'playing';
  for (let i = 0; i < 3; i++) {
    const active = i === gs.currentPlayer && isPlaying;
    const tag  = document.getElementById(`nametag-${i}`);
    const zone = document.getElementById(i === 0 ? 'player-zone' : `zone-${i}`);
    if (tag)  tag.classList.toggle('active-turn', active);
    if (zone) {
      zone.classList.toggle('active-zone', active);
      // Set zone color so ::after "thinking…" inherits it via currentColor
      if (active && i > 0) zone.style.color = PLAYER_COLORS[i];
      else if (!active && i > 0) zone.style.color = '';
    }
  }
  document.getElementById('player-zone').classList.toggle(
    'your-turn', gs.currentPlayer === 0 && isPlaying
  );
  // Tint status message with the current player's color
  document.getElementById('status-msg').style.color =
    isPlaying ? PLAYER_COLORS[gs.currentPlayer] : 'var(--accent)';
  document.getElementById('direction-indicator').textContent =
    gs.direction === 1 ? '↻' : '↺';
};

// ── Full render ──────────────────────────────────────────────

export const renderAll = () => {
  renderHand(0, 'hand-0', false);
  renderHand(1, 'hand-1', true);
  renderHand(2, 'hand-2', true);
  renderDiscardTop();
  updateBadges();
};

// ── UI helpers ───────────────────────────────────────────────

export const setStatus     = msg => { document.getElementById('status-msg').textContent = msg; };
export const showUnoBadge  = ()  => document.getElementById('uno-btn').classList.add('uno-alert');
export const hideUnoBadge  = ()  => document.getElementById('uno-btn').classList.remove('uno-alert');
export const showColorChooser = () => document.getElementById('color-chooser').classList.add('visible');
export const hideColorChooser = () => document.getElementById('color-chooser').classList.remove('visible');
export const showSwapChooser  = () => document.getElementById('swap-chooser').classList.add('visible');
export const hideSwapChooser  = () => document.getElementById('swap-chooser').classList.remove('visible');
