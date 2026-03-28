/**
 * deck.js — Card definitions and deck construction.
 * Pure functions, no dependencies.
 */

export const COLORS  = ['red', 'blue', 'green', 'yellow'];
export const ACTIONS = ['Skip', 'Reverse', 'Draw Two'];
export const WILDS   = ['Wild', 'Wild Draw Four'];

/**
 * Build a standard 108-card UNO deck.
 * Each card: { id, color, value, type }
 * type: 'number' | 'action' | 'wild'
 */
export const buildDeck = () => {
  const deck = [];
  let id = 0;

  for (const color of COLORS) {
    // 0 appears once per color
    deck.push({ id: id++, color, value: '0', type: 'number' });

    // 1–9 appear twice per color
    for (let n = 1; n <= 9; n++) {
      deck.push({ id: id++, color, value: String(n), type: 'number' });
      deck.push({ id: id++, color, value: String(n), type: 'number' });
    }

    // Action cards × 2 per color
    for (const a of ACTIONS) {
      deck.push({ id: id++, color, value: a, type: 'action' });
      deck.push({ id: id++, color, value: a, type: 'action' });
    }
  }

  // 4 Wild + 4 Wild Draw Four
  for (const w of WILDS) {
    for (let i = 0; i < 4; i++) {
      deck.push({ id: id++, color: 'wild', value: w, type: 'wild' });
    }
  }

  // 2 Swap Hands (wild)
  for (let i = 0; i < 2; i++) {
    deck.push({ id: id++, color: 'wild', value: 'Swap Hands', type: 'wild' });
  }

  return deck; // 110 cards total
};

/** Fisher-Yates shuffle — returns a new array */
export const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
