// Game rules only, no DOM, so test.mjs can run whole games in node.
import { EVENTS, JAIL } from './events.js';

export const RANKS = [[0, 'שליח'], [20, 'חייל'], [35, 'גובה'], [50, 'מנהל שטח'], [65, 'יד ימין'], [80, 'ראש משפחה'], [100, 'סנדק']];
export const INCOME = [10, 30, 60, 120, 250, 500, 1000]; // ₪K per year, by rank
export const RETIRE_AGE = 60;
export const YEARS_PER_TURN = 2;
export const RAID_SENTENCE = 4;

export const ENDINGS = {
  godfather: { emoji: '👑', title: 'סנדק', text: 'הגעת לפסגה. כל העיר מנשקת לך את היד, וגם העירייה.' },
  out: { emoji: '🚪', title: 'נזרקת מהמשפחה', text: 'אף אחד לא עונה לך לטלפון. אפילו הדוד.' },
  retired: { emoji: '🏖️', title: 'פרישה מכובדת', text: 'גיל 60, דירה בהרצליה פיתוח, קפה בבוקר ואפס כתבי אישום פתוחים. כמעט.' },
  lifer: { emoji: '🔒', title: 'הזדקנת בכלא', text: 'יצאת לעולם שלא מכיר אותך. רק הקבב בקנטינה נשאר אותו דבר.' },
};

const LAUNCH = Date.UTC(2026, 9, 11);
export const dayNumber = (now = Date.now()) => Math.floor((now - LAUNCH) / 864e5) + 1;

// mulberry32: same seed → same events and same rolls for everyone (daily challenge)
export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const gender = (str, female) => str.replace(/\{([^{}|]*)\|([^{}]*)\}/g, (_, m, f) => (female ? f : m));
export const rankOf = respect => RANKS.findLastIndex(([min]) => respect >= min);
export const score = s => s.respect + Math.floor(Math.max(0, s.cash) / 500); // +1 per ₪500K
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function newGame({ name, female, daily = 0 }) {
  return {
    name, female, daily,
    rand: daily ? rng(daily) : Math.random,
    age: 18, respect: 12, cash: 5, heat: 0, jailYears: 0, pending: 0,
    used: [], history: [],
  };
}

// Prefer events around the current rank; reshuffle once everything was seen.
export function nextEvent(s) {
  const rank = rankOf(s.respect);
  const open = EVENTS.filter(e => e.rank <= rank && !s.used.includes(e.id));
  if (!open.length) { s.used = []; return nextEvent(s); }
  const near = open.filter(e => e.rank >= rank - 1);
  const pool = near.length ? near : open;
  const e = pool[Math.floor(s.rand() * pool.length)];
  s.used.push(e.id);
  return deal(s, e);
}

// Each option gets its own roll up front, so in the daily the choice matters
// and everyone who picks the same option gets the same result.
function deal(s, e) {
  s.rolls = new Map(e.options.map(o => [o, s.rand() * 100]));
  return e;
}

// Heat eats into every risky bet. Safe options stay safe.
export const chanceOf = (s, o) => (o.chance >= 100 ? 100 : clamp(Math.round(o.chance - s.heat / 3), 5, 99));

// roll is where the needle lands (0-100). The red zone is [0, 100-chance).
// Doesn't touch stats, so the UI can spin the needle before revealing anything.
export function play(s, o) {
  const chance = chanceOf(s, o);
  const roll = s.rolls.get(o);
  const win = roll >= 100 - chance;
  return { win, roll, chance, fx: (win ? o.win : o.lose) || {}, text: win ? o.winText : o.loseText };
}

// Apply a roll, then either go to jail (returns { jail: event }) or close the round/sentence.
export function advance(s, e, res) {
  const { fx } = res;
  s.respect = clamp(s.respect + (fx.respect || 0), 0, 100);
  s.heat = clamp(s.heat + (fx.heat || 0), 0, 100);
  s.cash += fx.cash || 0;
  if (e.jail) {
    const served = Math.round(s.pending * (res.fx.mul ?? 1));
    Object.assign(s.history.at(-1), { result: 'jail', years: served, respect: s.respect });
    s.age += served;
    s.jailYears += served;
    s.pending = 0;
    return { served };
  }
  s.history.push({ age: s.age, tag: e.tag, result: res.win ? 'win' : 'lose', respect: s.respect });
  const raid = !res.fx.jail && s.heat >= 100;
  const years = res.fx.jail || (raid ? RAID_SENTENCE : 0);
  if (years) {
    s.pending = years;
    s.heat = 0;
    if (s.cash > 0) s.cash = Math.round(s.cash * 0.7); // confiscation
    return { jail: deal(s, JAIL[Math.floor(s.rand() * JAIL.length)]), raid };
  }
  const income = INCOME[rankOf(s.respect)] * YEARS_PER_TURN;
  s.cash += income;
  s.heat = Math.max(0, s.heat - 10);
  s.age += YEARS_PER_TURN;
  return { income };
}

export function checkEnd(s) {
  if (s.respect >= 100) return 'godfather';
  if (s.respect <= 0) return 'out';
  if (s.age >= RETIRE_AGE) return s.history.at(-1)?.result === 'jail' ? 'lifer' : 'retired';
  return null;
}
