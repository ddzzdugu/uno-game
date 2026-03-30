/**
 * main.js — Orchestrator: wires up events, turn loop, and win screen.
 * This is the only module that touches index.html event handlers directly.
 */

import { gs, initGame }                           from './state.js';
import { applyStartCardEffect, isHumanPlayable,
         canPlay, drawN, nextIdx, playCardCore,
         resolveDrawColor, checkElimination }      from './rules.js';
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

  // ── Wild Draw Color resolution for human player ─────────
  if (gs.currentPlayer === 0 && gs.pendingDrawColor) {
    const color = gs.pendingDrawColor;
    const count = resolveDrawColor(0);
    setStatus(`You draw ${count} cards until you get ${color}!`);
    renderAll();
    gs.animating = true;
    animateDrawN(0, count, () => {
      gs.animating = false;
      renderAll();
      updateNameTagHighlights();
      const elimResult = checkElimination(0);
      if (typeof elimResult === 'number' && elimResult >= 0) {
        showWinScreen(elimResult);
      } else if (elimResult === -2) {
        showEliminatedScreen();
      } else {
        gs.currentPlayer = nextIdx(0);
        renderAll();
        updateNameTagHighlights();
        scheduleTurn();
      }
    });
    return;
  }

  if (gs.currentPlayer === 0) {
    gs.drewThisTurn = false;
    const stackMsg = gs.mode === 'noMercy'
      ? `You must draw ${gs.pendingDraw} cards or stack a draw card!`
      : `You must draw ${gs.pendingDraw} cards or stack a +2!`;
    setStatus(gs.pendingDraw > 0 ? stackMsg : 'Your turn!');
    renderAll();
    updateNameTagHighlights();
  } else {
    setStatus(gs.pendingDraw > 0
      ? `${gs.playerNames[gs.currentPlayer]} must draw ${gs.pendingDraw} or stack!`
      : `${gs.playerNames[gs.currentPlayer]}'s turn`);
    renderAll();
    updateNameTagHighlights();
    setTimeout(() => doAITurn(scheduleTurn, showWinScreen), 1800);
  }
};

// ── Human player actions ─────────────────────────────────────

window.onCardClick = cardId => {
  if (gs.currentPlayer !== 0 || gs.phase !== 'playing' || gs.animating) return;
  const card = gs.hands[0].find(c => c.id === cardId);
  if (!card || !isHumanPlayable(card)) return;

  if (card.type === 'wild') {
    gs.pendingWild = cardId;
    if (card.value === 'Swap Hands' || card.value === 'Wild Forced Swap') {
      _populateSwapChooser();
      showSwapChooser();
    } else {
      showColorChooser();
    }
  } else {
    _startHumanPlay(cardId, null);
  }
};

/** Populate swap chooser, hiding eliminated players */
const _populateSwapChooser = () => {
  for (let i = 1; i <= 2; i++) {
    const btn = document.getElementById(`swap-choice-${i}`);
    btn.textContent = `🤖 ${gs.playerNames[i]}`;
    if (gs.eliminated[i]) {
      btn.style.display = 'none';
    } else {
      btn.style.display = '';
    }
  }
};

window.chooseSwap = targetIdx => {
  hideSwapChooser();
  gs.swapTarget = targetIdx;
  showColorChooser();
};

window.chooseColor = color => {
  hideColorChooser();
  if (gs.pendingWild === null) return;
  const cardId = gs.pendingWild;
  gs.pendingWild = null;
  gs.activeColor = color;
  _startHumanPlay(cardId, color);
};

const _startHumanPlay = (cardId, chosenColor) => {
  gs.drewThisTurn = false;
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
          renderAll();
          const elimResult = checkElimination(victim);
          if (typeof elimResult === 'number' && elimResult >= 0) {
            showWinScreen(elimResult);
          } else if (elimResult === -2) {
            setStatus(`${gs.playerNames[victim]} is eliminated!`);
            renderAll();
            updateNameTagHighlights();
            setTimeout(scheduleTurn, 1500);
          } else {
            updateNameTagHighlights();
            scheduleTurn();
          }
        });
      } else {
        updateNameTagHighlights();
        if (msg) {
          setTimeout(scheduleTurn, 1200);
        } else {
          scheduleTurn();
        }
      }
    }
  });
};

/** Called when the human clicks the draw pile */
const onDrawPileClick = () => {
  if (gs.currentPlayer !== 0 || gs.phase !== 'playing' || gs.animating) return;

  if (gs.pendingDraw > 0) {
    gs.animating = true;
    const count = gs.pendingDraw;
    gs.pendingDraw = 0;
    drawN(0, count);
    setStatus(`You draw ${count} cards!`);
    renderAll();
    animateDrawN(0, count, () => {
      gs.animating = false;
      renderAll();
      const elimResult = checkElimination(0);
      if (typeof elimResult === 'number' && elimResult >= 0) {
        showWinScreen(elimResult);
      } else if (elimResult === -2) {
        showEliminatedScreen();
      } else {
        gs.currentPlayer = nextIdx(0);
        renderAll();
        updateNameTagHighlights();
        scheduleTurn();
      }
    });
  } else if (gs.drewThisTurn) {
    gs.drewThisTurn = false;
    gs.currentPlayer = nextIdx(0);
    renderAll();
    updateNameTagHighlights();
    scheduleTurn();
  } else {
    gs.animating = true;
    drawN(0, 1);
    const drawn = gs.hands[0][gs.hands[0].length - 1];
    animateDraw(0, () => {
      gs.animating = false;
      renderAll();
      if (canPlay(drawn)) {
        gs.drewThisTurn = true;
        setStatus('Card drawn is playable — play it, or click draw pile to pass.');
        updateNameTagHighlights();
      } else {
        gs.currentPlayer = nextIdx(0);
        renderAll();
        updateNameTagHighlights();
        scheduleTurn();
      }
    });
  }
};

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

window.stopGame = () => {
  if (gs.phase !== 'playing') return;
  gs.phase = 'gameOver';
  document.getElementById('win-title').textContent    = 'Game Stopped';
  document.getElementById('win-subtitle').textContent = 'Want to play again?';
  document.getElementById('win-screen').classList.add('visible');
};

// ── Win / elimination screens ────────────────────────────────

const showWinScreen = winnerIdx => {
  const name = gs.playerNames[winnerIdx];
  const isNoMercy = gs.mode === 'noMercy';
  if (winnerIdx === 0) {
    document.getElementById('win-title').textContent    = 'You Win! 🎉';
    document.getElementById('win-subtitle').textContent = isNoMercy ? 'Last one standing! 🎊' : 'Congratulations! 🎊';
  } else {
    document.getElementById('win-title').textContent    = `${name} Wins!`;
    document.getElementById('win-subtitle').textContent = 'Better luck next time!';
  }
  document.getElementById('win-screen').classList.add('visible');
  sndWin();
  launchConfetti();
  launchFireworks();
};

const showEliminatedScreen = () => {
  gs.phase = 'gameOver';
  document.getElementById('win-title').textContent    = 'You\'re Eliminated!';
  document.getElementById('win-subtitle').textContent = '25 cards — no mercy!';
  document.getElementById('win-screen').classList.add('visible');
};

window.restartGame = () => {
  document.getElementById('win-screen').classList.remove('visible');
  hideUnoBadge();
  // Go back to mode select
  document.getElementById('game-wrapper').style.display = 'none';
  document.getElementById('stop-btn').style.display = 'none';
  document.getElementById('mode-select-screen').style.display = '';
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

  // Show mode badge in turn order screen
  const modeLabel = gs.mode === 'noMercy' ? '🔥 No Mercy' : '🃏 Standard';
  document.getElementById('turn-order-list').innerHTML =
    `<div class="to-mode-badge">${modeLabel}</div>` +
    seq.map((pid, pos) => `
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

// ── Mode selection ───────────────────────────────────────────

window.selectMode = (mode) => {
  document.getElementById('mode-select-screen').style.display = 'none';
  document.getElementById('game-wrapper').style.display = '';
  document.getElementById('stop-btn').style.display = '';
  startGame(mode);
};

// ── Boot ─────────────────────────────────────────────────────

const startGame = (mode) => {
  initGame(mode);
  applyStartCardEffect(gs.discardPile[0]);
  renderAll();
  updateNameTagHighlights();
  showTurnOrder();
};

document.getElementById('draw-pile').addEventListener('click', onDrawPileClick);

// Show mode select on load (don't auto-start)
document.getElementById('game-wrapper').style.display = 'none';
document.getElementById('stop-btn').style.display = 'none';
