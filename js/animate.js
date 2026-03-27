/**
 * animate.js — Card flight animations, pulse rings, confetti, fireworks.
 */

import { gs } from './state.js';
import { sndWhoosh } from './audio.js';

const COLOR_HEX = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
  yellow: '#facc15', wild: '#a855f7',
};

// ── Card flight ───────────────────────────────────────────────

/**
 * Animate a human player's card flying to the discard pile.
 * @param {number}   playerIdx
 * @param {number}   cardId
 * @param {Function} onDone  Called after animation completes.
 */
export const animatePlay = (playerIdx, cardId, onDone) => {
  const handEl  = document.getElementById(`hand-${playerIdx}`);
  const destEl  = document.getElementById('discard-top');
  const cardIdx = gs.hands[playerIdx].findIndex(c => c.id === cardId);
  const srcEl   = [...handEl.querySelectorAll('.card')][cardIdx];
  if (!srcEl || !destEl) { onDone(); return; }

  const srcRect  = srcEl.getBoundingClientRect();
  const destRect = destEl.getBoundingClientRect();
  const card     = gs.hands[playerIdx][cardIdx];

  _flyCard({
    classList: `card ${card.color}`,
    html:       srcEl.innerHTML,
    from:       srcRect,
    to:         destRect,
    onLand:     () => { spawnPulseRing(destEl, card); onDone(); },
  });
};

/**
 * Animate an AI player's card (face-down) flying to the discard pile.
 * @param {number}   playerIdx
 * @param {number}   cardId
 * @param {Function} onDone
 */
export const animateAIPlay = (playerIdx, cardId, onDone) => {
  const handEl  = document.getElementById(`hand-${playerIdx}`);
  const destEl  = document.getElementById('discard-top');
  const cardIdx = gs.hands[playerIdx].findIndex(c => c.id === cardId);
  const srcEl   = [...handEl.querySelectorAll('.card')][cardIdx] || handEl;
  const srcRect  = srcEl.getBoundingClientRect();
  const destRect = destEl.getBoundingClientRect();
  const card     = gs.hands[playerIdx][cardIdx];

  _flyCard({
    classList: 'card back',
    html:      '',
    from:      { ...srcRect, width: Math.min(srcRect.width, 100), height: Math.min(srcRect.height, 150) },
    to:        destRect,
    onLand:    () => { if (card) spawnPulseRing(destEl, card); onDone(); },
  });
};

/** Internal: move the shared #anim-card element from `from` rect to `to` rect */
const _flyCard = ({ classList, html, from, to, onLand }) => {
  const fly = document.getElementById('anim-card');
  fly.className = classList;
  fly.innerHTML = html;
  const rotation = (Math.random() * 40 - 20).toFixed(1);
  Object.assign(fly.style, {
    display:    'block',
    left:       `${from.left}px`,
    top:        `${from.top}px`,
    width:      `${from.width}px`,
    height:     `${from.height}px`,
    transform:  'none',
    transition: 'left .3s cubic-bezier(.22,1,.36,1), top .3s cubic-bezier(.22,1,.36,1), transform .3s cubic-bezier(.22,1,.36,1)',
  });

  sndWhoosh();

  requestAnimationFrame(() => requestAnimationFrame(() => {
    fly.style.left      = `${to.left}px`;
    fly.style.top       = `${to.top}px`;
    fly.style.transform = `rotate(${rotation}deg) scale(1.08)`;
  }));

  setTimeout(() => { fly.style.display = 'none'; onLand(); }, 330);
};

// ── Pulse ring ────────────────────────────────────────────────

/** Show a colored expanding ring around the discard pile for action/wild cards */
export const spawnPulseRing = (anchorEl, card) => {
  if (!['action', 'wild'].includes(card.type)) return;
  const rect = anchorEl.getBoundingClientRect();
  const ring = document.createElement('div');
  ring.className = 'pulse-ring';
  Object.assign(ring.style, {
    left:        `${rect.left}px`,
    top:         `${rect.top}px`,
    width:       `${rect.width}px`,
    height:      `${rect.height}px`,
    borderColor: COLOR_HEX[card.color] ?? '#fff',
  });
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 750);
};

// ── Win effects ───────────────────────────────────────────────

const CONFETTI_COLORS = ['#ef4444','#facc15','#22c55e','#3b82f6','#a855f7','#f97316','#ffffff'];

export const launchConfetti = () => {
  for (let i = 0; i < 90; i++) {
    const p   = document.createElement('div');
    p.className = 'confetti-piece';
    const w   = 6 + Math.random() * 8;
    const h   = 8 + Math.random() * 12;
    const dur = 2.5 + Math.random() * 2.5;
    const del = Math.random() * 1.6;
    Object.assign(p.style, {
      left:              `${Math.random() * 100}vw`,
      top:               `-${h + 10}px`,
      width:             `${w}px`,
      height:            `${h}px`,
      background:        CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      animationDuration: `${dur}s`,
      animationDelay:    `${del}s`,
      transform:         `rotate(${Math.random() * 360}deg)`,
    });
    document.body.appendChild(p);
    setTimeout(() => p.remove(), (dur + del + 0.5) * 1000);
  }
};

export const launchFireworks = () => {
  const burst = (cx, cy, delay) => {
    setTimeout(() => {
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2;
        const dist  = 50 + Math.random() * 90;
        const dot   = document.createElement('div');
        dot.className = 'firework';
        const dur = 0.55 + Math.random() * 0.4;
        Object.assign(dot.style, {
          left:              `${cx}px`,
          top:               `${cy}px`,
          background:        CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          '--tx':            `${(Math.cos(angle) * dist).toFixed(1)}px`,
          '--ty':            `${(Math.sin(angle) * dist).toFixed(1)}px`,
          animationDuration: `${dur}s`,
        });
        document.body.appendChild(dot);
        setTimeout(() => dot.remove(), (dur + 0.1) * 1000);
      }
    }, delay);
  };

  const W = window.innerWidth, H = window.innerHeight;
  [
    [W * .2, H * .3, 0], [W * .8, H * .25, 200], [W * .5, H * .12, 400],
    [W * .3, H * .55, 600], [W * .75, H * .5, 800], [W * .5, H * .35, 1100],
  ].forEach(([x, y, d]) => burst(x, y, d));
};
