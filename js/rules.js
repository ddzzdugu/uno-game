/**
 * rules.js — UNO game rules: playability, effects, deck management.
 * Mutates gs but never touches the DOM.
 * Returns winner index (0-2) from playCardCore, or -1 if no winner yet.
 */

import { gs } from './state.js';
import { COLORS, shuffle } from './deck.js';

// ── Constants ─────────────────────────────────────────────
const DRAW_CARDS = ['Draw Two', 'Wild Draw Four', 'Wild Draw 6', 'Wild Draw 10'];

// ── Accessors ────────────────────────────────────────────────

export const topCard  = () => gs.discardPile[gs.discardPile.length - 1];
export const topColor = () => gs.activeColor;

/**
 * Return the index of the player N steps ahead in the current direction.
 * Handles wrap-around for 3 players. Skips eliminated players.
 */
export const nextIdx = (from, steps = 1) => {
  const n = 3;
  let cur = from;
  for (let s = 0; s < steps; s++) {
    do {
      cur = ((cur + gs.direction) % n + n) % n;
    } while (gs.eliminated[cur]);
  }
  return cur;
};

// ── Deck management ──────────────────────────────────────────

/** Reshuffle the discard pile back into the deck when it runs dry */
export const ensureDeck = () => {
  if (gs.deck.length > 0) return;
  const top = gs.discardPile.pop();
  gs.deck = shuffle(gs.discardPile);
  gs.discardPile = [top];
  // Clear chosen colors from recycled wild cards
  gs.deck.forEach(c => { if (c.type === 'wild') c.color = 'wild'; });
};

/** Draw n cards from the deck into a player's hand */
export const drawN = (playerIdx, n) => {
  for (let i = 0; i < n; i++) {
    ensureDeck();
    if (gs.deck.length === 0) break;
    gs.hands[playerIdx].push(gs.deck.pop());
  }
};

// ── Card playability ─────────────────────────────────────────

/** Can this card legally be played on top of the current discard? */
export const canPlay = card => {
  if (gs.pendingDraw > 0) {
    if (gs.mode === 'noMercy') {
      return DRAW_CARDS.includes(card.value);
    }
    return card.value === 'Draw Two';
  }
  if (card.type === 'wild')              return true;
  if (card.color === topColor())         return true;
  if (card.value === topCard().value)    return true;
  return false;
};

/** Can the human player play this card right now? */
export const isHumanPlayable = card => {
  if (gs.currentPlayer !== 0) return false;
  if (gs.phase !== 'playing') return false;
  return canPlay(card);
};

// ── Card effects ─────────────────────────────────────────────

/**
 * Apply the effect of the first card on the discard pile at game start.
 * (Wild is already excluded by initGame.)
 */
export const applyStartCardEffect = card => {
  if (card.value === 'Skip' || card.value === 'Skip Everyone') {
    gs.currentPlayer = nextIdx(0);
  } else if (card.value === 'Reverse' || card.value === 'Reverse Draw Four') {
    gs.direction *= -1;
    gs.currentPlayer = nextIdx(0);
    if (card.value === 'Reverse Draw Four') {
      const victim = gs.currentPlayer;
      drawN(victim, 4);
      gs.currentPlayer = nextIdx(victim);
    }
  } else if (card.value === 'Draw Two') {
    const victim = nextIdx(0);
    drawN(victim, 2);
    gs.currentPlayer = nextIdx(victim);
  } else if (card.value === 'Discard All') {
    // At start, treat as a normal colored card — no effect
    gs.currentPlayer = 0;
  }
  // Number cards: no effect, human starts
};

/**
 * Apply the ongoing effect of a card that was just played.
 * Updates gs.currentPlayer and gs.activeColor.
 * Returns a short status string for the UI.
 */
export const applyCardEffect = (card, playerIdx) => {
  const names = gs.playerNames;
  switch (card.value) {
    case 'Skip': {
      const skipped = nextIdx(playerIdx);
      gs.currentPlayer = nextIdx(skipped);
      return skipped === 0 ? 'You are skipped!' : `${names[skipped]} is skipped!`;
    }
    case 'Skip Everyone': {
      gs.currentPlayer = playerIdx;
      return playerIdx === 0
        ? 'You skip everyone — go again!'
        : `${names[playerIdx]} skips everyone!`;
    }
    case 'Reverse': {
      gs.direction *= -1;
      gs.currentPlayer = nextIdx(playerIdx);
      return 'Direction reversed!';
    }
    case 'Reverse Draw Four': {
      gs.direction *= -1;
      const victim = nextIdx(playerIdx);
      drawN(victim, 4);
      gs.currentPlayer = nextIdx(victim);
      gs.forcedDraw = { victim, count: 4 };
      return victim === 0
        ? 'Reversed! You draw 4 and are skipped!'
        : `Reversed! ${names[victim]} draws 4 and is skipped!`;
    }
    case 'Draw Two': {
      gs.pendingDraw += 2;
      const nextPlayer = nextIdx(playerIdx);
      gs.currentPlayer = nextPlayer;
      return `${names[nextPlayer]} must draw ${gs.pendingDraw} or stack!`;
    }
    case 'Discard All': {
      const color = card.color;
      const keep = [], discard = [];
      for (const c of gs.hands[playerIdx]) {
        (c.color === color ? discard : keep).push(c);
      }
      gs.hands[playerIdx] = keep;
      gs.discardPile.push(...discard);
      gs.currentPlayer = nextIdx(playerIdx);
      const count = discard.length;
      return count > 0
        ? `${playerIdx === 0 ? 'You discard' : names[playerIdx] + ' discards'} ${count} more ${color} card${count > 1 ? 's' : ''}!`
        : '';
    }
    case 'Wild Draw Four': {
      if (gs.mode === 'noMercy') {
        gs.pendingDraw += 4;
        const next = nextIdx(playerIdx);
        gs.currentPlayer = next;
        return `${names[next]} must draw ${gs.pendingDraw} or stack!`;
      }
      // Standard: immediate draw
      const victim = nextIdx(playerIdx);
      drawN(victim, 4);
      gs.currentPlayer = nextIdx(victim);
      gs.forcedDraw = { victim, count: 4 };
      return victim === 0
        ? 'You draw 4 and are skipped!'
        : `${names[victim]} draws 4 and is skipped!`;
    }
    case 'Wild Draw 6':
    case 'Wild Draw 10': {
      gs.pendingDraw += card.value === 'Wild Draw 6' ? 6 : 10;
      const next = nextIdx(playerIdx);
      gs.currentPlayer = next;
      return `${names[next]} must draw ${gs.pendingDraw} or stack!`;
    }
    case 'Wild Draw Color': {
      gs.pendingDrawColor = gs.activeColor;
      const next = nextIdx(playerIdx);
      gs.currentPlayer = next;
      return next === 0
        ? `You must draw until you get ${gs.activeColor}!`
        : `${names[next]} draws until they get ${gs.activeColor}!`;
    }
    case 'Swap Hands':
    case 'Wild Forced Swap': {
      const target = gs.swapTarget ?? nextIdx(playerIdx);
      if (gs.hands[playerIdx].length > 0) {
        [gs.hands[playerIdx], gs.hands[target]] = [gs.hands[target], gs.hands[playerIdx]];
      }
      gs.swapTarget = null;
      gs.currentPlayer = nextIdx(playerIdx);
      return `${names[playerIdx]} swapped hands with ${names[target]}!`;
    }
    case 'Wild':
      gs.currentPlayer = nextIdx(playerIdx);
      return `${names[playerIdx]} chose ${gs.activeColor}!`;
    default:
      gs.currentPlayer = nextIdx(playerIdx);
      return '';
  }
};

// ── No Mercy helpers ─────────────────────────────────────────

/**
 * Draw cards until the player gets the declared color.
 * Returns the number of cards drawn.
 */
export const resolveDrawColor = (playerIdx) => {
  const targetColor = gs.pendingDrawColor;
  gs.pendingDrawColor = null;
  let count = 0;
  while (true) {
    ensureDeck();
    if (gs.deck.length === 0) break;
    const drawn = gs.deck.pop();
    gs.hands[playerIdx].push(drawn);
    count++;
    if (drawn.color === targetColor) break;
    if (count >= 30) break; // safety cap
  }
  return count;
};

/**
 * Check if a player should be eliminated (25+ cards).
 * Returns: winner index if only 1 player remains, -2 if eliminated but game continues, false otherwise.
 */
export const checkElimination = (playerIdx) => {
  if (gs.mode !== 'noMercy') return false;
  if (gs.eliminated[playerIdx]) return false;
  if (gs.hands[playerIdx].length < 25) return false;

  gs.eliminated[playerIdx] = true;
  gs.hands[playerIdx] = [];

  const remaining = [0, 1, 2].filter(i => !gs.eliminated[i]);
  if (remaining.length === 1) {
    gs.phase = 'gameOver';
    return remaining[0]; // winner — last player standing
  }
  // If it's the eliminated player's turn, advance
  if (gs.currentPlayer === playerIdx) {
    gs.currentPlayer = nextIdx(playerIdx);
  }
  return -2; // eliminated but game continues
};

// ── Core play action ─────────────────────────────────────────

/**
 * @returns {{ winner: number, msg: string }}
 *   winner = player index if someone won, -1 otherwise.
 *   msg    = status string describing the card effect.
 */
export const playCardCore = (playerIdx, cardId, chosenColor = null) => {
  const hand = gs.hands[playerIdx];
  const idx  = hand.findIndex(c => c.id === cardId);
  if (idx === -1) return { winner: -1, msg: '' };

  gs.forcedDraw = null;

  const card = hand.splice(idx, 1)[0];
  gs.discardPile.push(card);
  gs.unoCalled[playerIdx] = false;

  if (card.type === 'wild') {
    gs.activeColor = chosenColor || COLORS[0];
    card.color = gs.activeColor;
  } else {
    gs.activeColor = card.color;
  }

  const msg = applyCardEffect(card, playerIdx);

  if (gs.hands[playerIdx].length === 0) {
    gs.phase = 'gameOver';
    return { winner: playerIdx, msg };
  }

  return { winner: -1, msg };
};
