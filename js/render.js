/**
 * render.js — All DOM rendering. No game logic, only reads gs.
 */

import { gs } from './state.js';
import { isHumanPlayable, topCard, topColor } from './rules.js';

const COLOR_HEX = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
  yellow: '#facc15', wild: '#a855f7',
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
    return el;
  }

  el.classList.add(card.color);

  let center, corner;
  if (card.type === 'wild') {
    center = card.value === 'Wild' ? '🌈' : '+4';
    corner = center;
  } else if (card.type === 'action') {
    center = ACTION_SYMBOL[card.value] ?? card.value;
    corner = center;
  } else {
    center = card.value;
    corner = card.value;
  }

  const centerSize = card.type === 'number' ? '64px' : card.type === 'action' ? '38px' : '40px';

  el.innerHTML = `
    <span class="corner tl">${corner}</span>
    <span style="font-size:${centerSize};line-height:1;">${center}</span>
    <span class="corner br">${corner}</span>
  `;

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
  const card = topCard();
  if (!card) return;

  const el = makeCardEl(card, { faceDown: false, humanPlayable: false });
  el.classList.remove('disabled');
  container.appendChild(el);

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
  for (let i = 0; i < 3; i++) {
    const tag = document.getElementById(`nametag-${i}`);
    if (tag) tag.classList.toggle('active-turn', i === gs.currentPlayer && gs.phase === 'playing');
  }
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
