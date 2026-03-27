/**
 * main.js — Orchestrator: wires up events, turn loop, and win screen.
 * This is the only module that touches index.html event handlers directly.
 */

import { gs, initGame }                           from './state.js';
import { applyStartCardEffect, isHumanPlayable,
         canPlay, drawN, nextIdx, playCardCore }  from './rules.js';
import { renderAll, setStatus, updateNameTagHighlights,
         showUnoBadge, hideUnoBadge,
         showColorChooser, hideColorChooser }     from './render.js';
import { animatePlay, launchConfetti,
         launchFireworks }                        from './animate.js';
import { doAITurn }                               from './ai.js';
import { sndUno, sndWin }                         from './audio.js';

// ── Turn loop ────────────────────────────────────────────────

const scheduleTurn = () => {
  if (gs.phase === 'gameOver') return;

  if (gs.currentPlayer === 0) {
    setStatus('Your turn!');
    renderAll();
    updateNameTagHighlights();
  } else {
    setStatus(`${gs.playerNames[gs.currentPlayer]}'s turn…`);
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
    showColorChooser();
  } else {
    _startHumanPlay(cardId, null);
  }
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
    const winner = playCardCore(0, cardId, chosenColor);
    gs.animating = false;

    if (gs.hands[0].length === 1 && !gs.unoCalled[0]) showUnoBadge();
    else hideUnoBadge();

    if (winner >= 0) {
      renderAll();
      showWinScreen(winner);
    } else {
      renderAll();
      updateNameTagHighlights();
      scheduleTurn();
    }
  });
};

/** Called when the human clicks the draw pile */
const onDrawPileClick = () => {
  if (gs.currentPlayer !== 0 || gs.phase !== 'playing' || gs.animating) return;
  gs.animating = true;

  drawN(0, 1);
  setTimeout(() => {
    gs.animating = false;
    gs.currentPlayer = nextIdx(0);
    renderAll();
    updateNameTagHighlights();
    scheduleTurn();
  }, 280);
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

// ── Boot ─────────────────────────────────────────────────────

const startGame = () => {
  initGame();
  applyStartCardEffect(gs.discardPile[0]);
  renderAll();
  updateNameTagHighlights();
  scheduleTurn();
};

document.getElementById('draw-pile').addEventListener('click', onDrawPileClick);

startGame();
