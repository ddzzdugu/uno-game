/**
 * rules.js — UNO game rules: playability, effects, deck management.
 * Mutates gs but never touches the DOM.
 * Returns winner index (0-2) from playCardCore, or -1 if no winner yet.
 */

import { gs } from './state.js';
import { COLORS } from './deck.js';

// ── Accessors ────────────────────────────────────────────────

export const topCard  = () => gs.discardPile[gs.discardPile.length - 1];
export const topColor = () => gs.activeColor;

/**
 * Return the index of the player N steps ahead in the current direction.
 * Handles wrap-around for 3 players.
 */
export const nextIdx = (from, steps = 1) => {
  const n = 3;
  return ((from + gs.direction * steps) % n + n) % n;
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

const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
  // During a +2 stack, only Draw Two can be played to counter
  if (gs.pendingDraw > 0) return card.value === 'Draw Two';
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
  if (card.value === 'Skip') {
    gs.currentPlayer = nextIdx(0);
  } else if (card.value === 'Reverse') {
    gs.direction *= -1;
    gs.currentPlayer = nextIdx(0);
  } else if (card.value === 'Draw Two') {
    const victim = nextIdx(0);
    drawN(victim, 2);
    gs.currentPlayer = nextIdx(victim);
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
    case 'Reverse': {
      gs.direction *= -1;
      // In 3-player UNO, Reverse just changes direction — no skip.
      // nextIdx now uses the flipped direction, so the previous player goes next.
      gs.currentPlayer = nextIdx(playerIdx);
      return 'Direction reversed!';
    }
    case 'Draw Two': {
      gs.pendingDraw += 2;
      const nextPlayer = nextIdx(playerIdx);
      gs.currentPlayer = nextPlayer;
      return `${names[nextPlayer]} must draw ${gs.pendingDraw} or stack!`;
    }
    case 'Wild Draw Four': {
      const victim = nextIdx(playerIdx);
      drawN(victim, 4);
      gs.currentPlayer = nextIdx(victim);
      gs.forcedDraw = { victim, count: 4 };
      return victim === 0
        ? 'You draw 4 and are skipped!'
        : `${names[victim]} draws 4 and is skipped!`;
    }
    case 'Swap Hands': {
      const target = gs.swapTarget ?? nextIdx(playerIdx);
      // Skip swap if this was the player's last card — let the win check in
      // playCardCore fire normally instead of giving the player cards back.
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

// ── Core play action ─────────────────────────────────────────

/**
 * Move a card from a player's hand to the discard pile and apply its effect.
 * @param {number} playerIdx
 * @param {number} cardId
 * @param {string|null} chosenColor  Required for wild cards.
 * @returns {number} Winner index (0-2) if this move wins, otherwise -1.
 */
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
