/**
 * ai.js — AI player turn logic.
 *
 * doAITurn(onTurnEnd, onWin) takes callbacks so it stays decoupled from main.js.
 * The AI never touches the DOM directly — it calls renderAll and setStatus from render.js.
 */

import { gs } from './state.js';
import { canPlay, drawN, nextIdx, playCardCore } from './rules.js';
import { renderAll, setStatus } from './render.js';
import { animateAIPlay, animateDraw, animateDrawN } from './animate.js';
import { sndFlip, sndUno } from './audio.js';
import { COLORS } from './deck.js';

/**
 * Execute the current AI player's turn.
 * @param {Function} onTurnEnd  Called when the turn ends without a winner.
 * @param {Function} onWin      Called with the winner's index when the AI wins.
 */
export const doAITurn = (onTurnEnd, onWin) => {
  if (gs.phase === 'gameOver' || gs.currentPlayer === 0) return;

  const idx      = gs.currentPlayer;
  const playable = gs.hands[idx].filter(canPlay);

  if (playable.length === 0) {
    sndFlip();

    if (gs.pendingDraw > 0) {
      // Must absorb the full stacked draw
      const count = gs.pendingDraw;
      gs.pendingDraw = 0;
      drawN(idx, count);
      setStatus(`${gs.playerNames[idx]} draws ${count} cards!`);
      gs.animating = true;
      animateDrawN(idx, count, () => {
        gs.animating = false;
        gs.currentPlayer = nextIdx(idx);
        renderAll();
        setTimeout(onTurnEnd, 1100);
      });
    } else {
      // Draw one card and check if playable
      drawN(idx, 1);
      setStatus(`${gs.playerNames[idx]} draws a card.`);
      gs.animating = true;
      animateDraw(idx, () => {
        gs.animating = false;
        renderAll();
        const drawn = gs.hands[idx][gs.hands[idx].length - 1];
        if (canPlay(drawn)) {
          setTimeout(() => _aiPlayCard(idx, drawn, onTurnEnd, onWin), 1400);
        } else {
          gs.currentPlayer = nextIdx(idx);
          renderAll();
          setTimeout(onTurnEnd, 1100);
        }
      });
    }
    return;
  }

  const chosen = _pickBestCard(playable, idx);
  setTimeout(() => _aiPlayCard(idx, chosen, onTurnEnd, onWin), 1200);
};

// ── Card selection strategy ──────────────────────────────────

/**
 * Choose the best card to play from a list of valid options.
 * Prefers action cards; saves wilds; plays aggressively when opponents are close to winning.
 */
const _pickBestCard = (playable, idx) => {
  const opponents   = [0, 1, 2].filter(i => i !== idx);
  const minOpCards  = Math.min(...opponents.map(i => gs.hands[i].length));

  // Go aggressive when an opponent is close to winning
  if (minOpCards <= 3) {
    const priority = ['Wild Draw Four', 'Draw Two', 'Skip', 'Reverse', 'Wild'];
    for (const val of priority) {
      const c = playable.find(c => c.value === val);
      if (c) return c;
    }
  }

  // Prefer action cards to deplete them
  const action = playable.find(c => c.type === 'action');
  if (action) return action;

  // Prefer non-wild cards to preserve wilds
  const nonWild = playable.filter(c => c.type !== 'wild');
  if (nonWild.length > 0) return nonWild[Math.floor(Math.random() * nonWild.length)];

  return playable[0];
};

// ── Internal play execution ──────────────────────────────────

const _aiPlayCard = (idx, card, onTurnEnd, onWin) => {
  if (gs.phase === 'gameOver') return;
  gs.animating = true;

  animateAIPlay(idx, card.id, () => {
    const chosenColor = card.type === 'wild' ? _pickColor(idx) : null;
    if (card.value === 'Swap Hands') gs.swapTarget = _pickSwapTarget(idx);
    const { winner, msg } = playCardCore(idx, card.id, chosenColor);

    gs.animating = false;

    if (gs.hands[idx].length === 1 && !gs.unoCalled[idx]) {
      gs.unoCalled[idx] = true;
      sndUno();
      setStatus(`${gs.playerNames[idx]} calls UNO!`);
    } else if (msg) {
      setStatus(msg);
    }

    renderAll();

    if (winner >= 0) {
      onWin(winner);
    } else if (gs.forcedDraw) {
      const { victim, count } = gs.forcedDraw;
      gs.animating = true;
      animateDrawN(victim, count, () => {
        gs.animating = false;
        renderAll();
        setTimeout(onTurnEnd, 900);
      });
    } else {
      setTimeout(onTurnEnd, 900);
    }
  });
};

/** Pick the opponent to swap with — target whoever has the fewest cards */
const _pickSwapTarget = idx => {
  const opponents = [0, 1, 2].filter(i => i !== idx);
  return opponents.reduce((best, i) =>
    gs.hands[i].length < gs.hands[best].length ? i : best
  , opponents[0]);
};

/** Pick the color the AI has the most of in hand */
const _pickColor = idx => {
  const counts = {};
  gs.hands[idx].forEach(c => {
    if (c.color !== 'wild') counts[c.color] = (counts[c.color] ?? 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : COLORS[Math.floor(Math.random() * COLORS.length)];
};
