/**
 * state.js — Shared mutable game state.
 *
 * All modules import the same `gs` object reference.
 * initGame() resets it in-place using Object.assign so every
 * module always sees current state without re-importing.
 */

import { buildDeck, buildNoMercyDeck, shuffle, COLORS } from './deck.js';

/**
 * gs — the single source of truth for all game state.
 *
 * Properties (set by initGame):
 *   deck          {Card[]}   remaining draw pile
 *   discardPile   {Card[]}   played cards (top = last element)
 *   hands         {Card[][]} hands[0]=human, hands[1]=Alex, hands[2]=Sam
 *   currentPlayer {number}   0|1|2
 *   direction     {number}   1=clockwise, -1=counter-clockwise
 *   activeColor   {string}   current active color (may differ from top card for wilds)
 *   phase         {string}   'playing' | 'choosingColor' | 'gameOver'
 *   unoCalled     {boolean[]} whether each player has called UNO
 *   pendingWild   {number|null} card id awaiting color choice
 *   animating     {boolean}  true while a card animation is running
 *   playerNames   {string[]} display names
 */
export const gs = {};

export const initGame = (mode = 'standard') => {
  const deck = shuffle(mode === 'noMercy' ? buildNoMercyDeck() : buildDeck());

  // Deal 7 cards to each of the 3 players
  const hands = [[], [], []];
  for (let i = 0; i < 7 * 3; i++) hands[i % 3].push(deck.pop());

  // Find a non-wild starting card for the discard pile
  let startCard;
  while (true) {
    startCard = deck.pop();
    if (startCard.type !== 'wild') break;
    deck.unshift(startCard); // return wild to bottom
  }

  const next = {
    mode,
    deck,
    discardPile: [startCard],
    hands,
    currentPlayer: 0,
    direction: 1,
    activeColor: startCard.color,
    phase: 'playing',
    unoCalled: [false, false, false],
    pendingWild: null,
    animating: false,
    playerNames: ['You', 'Alex', 'Sam'],
    pendingDraw: 0,
    swapTarget: null,
    drewThisTurn: false,
    // No Mercy extras
    eliminated: [false, false, false],
    pendingDrawColor: null,
  };

  // Reset in-place so all module references stay valid
  Object.keys(gs).forEach(k => delete gs[k]);
  Object.assign(gs, next);
};
