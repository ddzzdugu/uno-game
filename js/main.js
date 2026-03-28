/**
 * main.js — Orchestrator: wires up events, turn loop, and win screen.
 * This is the only module that touches index.html event handlers directly.
 */

import { gs, initGame }                           from './state.js';
import { applyStartCardEffect, isHumanPlayable,
         canPlay, drawN, nextIdx, playCardCore }  from './rules.js';
import { renderAll, setStatus, updateNameTagHighlights,
         showUnoBadge, hideUnoBadge,
         showColorChooser, hideColorChooser,
         showSwapChooser, hideSwapChooser }       from './render.js';
import { animatePlay, animateDraw, animateDrawN,
         launchConfetti, launchFireworks }        from './animate.js';
import { doAITurn }                               from './ai.js';
import { sndUno, sndWin }                         from './audio.js';

// ── Turn loop ────────────────────────────────────────────────

const scheduleTurn = () => {
  if (gs.phase === 'gameOver') return;

  if (gs.currentPlayer === 0) {
    setStatus(gs.pendingDraw > 0
      ? `You must draw ${gs.pendingDraw} cards or stack a +2!`
      : 'Your turn!');
    renderAll();
    updateNameTagHighlights();
  } else {
    const name = gs.playerNames[gs.currentPlayer];
    setStatus(gs.pendingDraw > 0
      ? `${name} must draw ${gs.pendingDraw} or stack!`
      : `${name}'s turn…`);
    renderAll();
    updateNameTagHighlights();
    setTimeout(() => doAITurn(scheduleTurn, showWinScreen), 1800);
  }
};

// ── Human player actions ─────────────────────────────────────

/** Called by render.js via window.onCardClick when the human clicks a card */
window.onCardClick = cardId => {
  if (gs.currentPlayer !== 0 || gs.phase !== 'playing' || gs.animating) return;
  const card = gs.hands[0].find(c => c.id === cardId);
  if (!card || !isHumanPlayable(card)) return;

  if (card.type === 'wild') {
    gs.pendingWild = cardId;
    if (card.value === 'Swap Hands') {
      document.getElementById('swap-choice-1').textContent = `🤖 ${gs.playerNames[1]}`;
      document.getElementById('swap-choice-2').textContent = `🤖 ${gs.playerNames[2]}`;
      showSwapChooser();
    } else {
      showColorChooser();
    }
  } else {
    _startHumanPlay(cardId, null);
  }
};

/** Called from the swap-chooser overlay buttons in index.html */
window.chooseSwap = targetIdx => {
  hideSwapChooser();
  gs.swapTarget = targetIdx;
  showColorChooser();
};

/** Called from the color-chooser overlay buttons in index.html */
window.chooseColor = color => {
  hideColorChooser();
  if (gs.pendingWild === null) return;
  const cardId = gs.pendingWild;
  gs.pendingWild = null;
  gs.activeColor = color;
  _startHumanPlay(cardId, color);
};

const _startHumanPlay = (cardId, chosenColor) => {
  gs.animating = true;
  animatePlay(0, cardId, () => {
    const { winner, msg } = playCardCore(0, cardId, chosenColor);
    gs.animating = false;

    if (gs.hands[0].length === 1 && !gs.unoCalled[0]) showUnoBadge();
    else hideUnoBadge();

    if (winner >= 0) {
      renderAll();
      showWinScreen(winner);
    } else {
      if (msg) setStatus(msg);
      renderAll();
      if (gs.forcedDraw) {
        const { victim, count } = gs.forcedDraw;
        gs.animating = true;
        animateDrawN(victim, count, () => {
          gs.animating = false;
          updateNameTagHighlights();
          scheduleTurn();
        });
      } else {
        updateNameTagHighlights();
        scheduleTurn();
      }
    }
  });
};

/** Called when the human clicks the draw pile */
const onDrawPileClick = () => {
  if (gs.currentPlayer !== 0 || gs.phase !== 'playing' || gs.animating) return;
  gs.animating = true;

  if (gs.pendingDraw > 0) {
    const count = gs.pendingDraw;
    gs.pendingDraw = 0;
    drawN(0, count);
    setStatus(`You draw ${count} cards!`);
    animateDrawN(0, count, () => {
      gs.animating = false;
      gs.currentPlayer = nextIdx(0);
      renderAll();
      updateNameTagHighlights();
      scheduleTurn();
    });
  } else {
    drawN(0, 1);
    animateDraw(0, () => {
      gs.animating = false;
      gs.currentPlayer = nextIdx(0);
      renderAll();
      updateNameTagHighlights();
      scheduleTurn();
    });
  }
};

/** Called from the UNO button in index.html */
window.callUno = () => {
  if (gs.phase !== 'playing') return;
  if (gs.hands[0].length === 1 && !gs.unoCalled[0]) {
    gs.unoCalled[0] = true;
    sndUno();
    setStatus('UNO! 🎉');
    hideUnoBadge();
  }
};

// ── Stop game ────────────────────────────────────────────────

/** Called from the Stop button */
window.stopGame = () => {
  if (gs.phase !== 'playing') return;
  gs.phase = 'gameOver';
  document.getElementById('win-title').textContent    = 'Game Stopped';
  document.getElementById('win-subtitle').textContent = 'Want to play again?';
  document.getElementById('win-screen').classList.add('visible');
};

// ── Win screen ───────────────────────────────────────────────

const showWinScreen = winnerIdx => {
  const name = gs.playerNames[winnerIdx];
  document.getElementById('win-title').textContent    = winnerIdx === 0 ? 'You Win! 🎉' : `${name} Wins!`;
  document.getElementById('win-subtitle').textContent = winnerIdx === 0 ? 'Congratulations! 🎊' : 'Better luck next time!';
  document.getElementById('win-screen').classList.add('visible');
  sndWin();
  launchConfetti();
  launchFireworks();
};

/** Called from the "Play Again" button in index.html */
window.restartGame = () => {
  document.getElementById('win-screen').classList.remove('visible');
  hideUnoBadge();
  startGame();
};

// ── Turn order intro ─────────────────────────────────────────

const PLAYER_COLORS = ['#a855f7', '#c94455', '#3d9b5a'];
const PLAYER_ICONS  = ['👤', '🤖', '🤖'];

let _toTimer = null;

const showTurnOrder = () => {
  const seq = [
    gs.currentPlayer,
    nextIdx(gs.currentPlayer),
    nextIdx(gs.currentPlayer, 2),
  ];

  document.getElementById('turn-order-list').innerHTML = seq.map((pid, pos) => `
    <div class="to-item" style="color:${PLAYER_COLORS[pid]}">
      <span class="to-num">${pos + 1}</span>
      <span>${PLAYER_ICONS[pid]} ${gs.playerNames[pid]}</span>
      ${pos === 0 ? '<span class="to-first-badge">First!</span>' : ''}
    </div>
  `).join('');

  let secs = 3;
  const cd = document.getElementById('turn-order-cd');
  if (cd) cd.textContent = secs;
  document.getElementById('turn-order-screen').classList.add('visible');

  _toTimer = setInterval(() => {
    secs--;
    if (cd) cd.textContent = secs;
    if (secs <= 0) { clearInterval(_toTimer); _toTimer = null; _dismissTurnOrder(); }
  }, 1000);
};

const _dismissTurnOrder = () => {
  if (_toTimer) { clearInterval(_toTimer); _toTimer = null; }
  document.getElementById('turn-order-screen').classList.remove('visible');
  scheduleTurn();
};
window.dismissTurnOrder = _dismissTurnOrder;

// ── Boot ─────────────────────────────────────────────────────

const startGame = () => {
  initGame();
  applyStartCardEffect(gs.discardPile[0]);
  renderAll();
  updateNameTagHighlights();
  showTurnOrder();
};

document.getElementById('draw-pile').addEventListener('click', onDrawPileClick);

startGame();
