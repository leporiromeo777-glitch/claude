import { readFileSync } from 'node:fs';
import { it } from 'vitest';
import { Session } from '../../../src/tombolo/session';
const lv = JSON.parse(readFileSync('/home/user/claude/gioco/src/content/levels/arc6.json', 'utf8'));
const comp = JSON.parse(readFileSync('/home/user/claude/gioco/src/content/levels/arc6.computed.json', 'utf8'));
it('arc6', () => {
  const s = new Session({ origin: 'archivio', mode: 'occasioni', level: lv, flags: {}, accepted: [], goals: [...lv.goals], needsNome: false });
  s.setOccasions(comp.occasionsSolution);
  for (let i = 0; i < 20; i++) { const r = s.stepAuto(); if (!r) break; if (!r.ok) { console.log('fail', r.violations); break; } }
  console.log('done', s.done, 'succ', s.succeeded(), s.goalStatus());
  for (const t of s.archive!.faded()) s.archive!.name(t, lv.archive.answer[t]);
  const o = s.complete();
  console.log(JSON.stringify(o.archive), o.goals);
});
