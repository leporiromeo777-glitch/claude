/**
 * `__GAME__.campaign` (ARCHITETTURA 15.1): stato, conoscenza e comandi della campagna.
 *
 *   state() knowledge() newGame() goto(levelId, phase?) accept(noteIds, guesses?)
 *   reply(noteId, 'R1' | 'R2') toNight() skipDawn() finishDay() setFlag(k, v)
 *   setMemoria(c, n) learn(kind, id) choose(ending) unlockAll()
 * In più: phase(), evening(), report(), cards(), requirements(), next(), continue(),
 *   resumeFrom(levelId), replay(levelId), archive(levelId), objectSeen(), leave(noteId),
 *   unpin(noteId), dawn(), scene(), ripassa(); revisione 1: dawnObjectSeen(),
 *   leaveArchive(levelId), reread(levelId); revisione 2: pastLace() (oltre il merletto
 *   finito, come il tocco su «Continua»).
 */
import type { CharacterId, EndingId, FlagValue, LevelId, QuestionId, QuirkId, RuleId, Services } from '../core/types';
import { activeNight } from '../tombolo/index';
import { controller } from './controller';
import { refreshDiary } from './diary';
import { choiceCards, endingRequirements } from './endings';
import { eveningItems, isAnonymous, leaveNote, pinNote, pinsLeft, replyNote, undecided, unpinNote } from './evening';
import { eveningMode, levelOf, ripassaAvailable } from './flow';
import { unlockEverything } from './progress';
import { addDiary, emptyLog } from './story';
import type { CampaignStateX } from './types';
import type { AlbaScene } from './AlbaScene';
import type { FinaleScene } from './FinaleScene';

function cs(d: { campaign: unknown }): CampaignStateX {
  if (!d.campaign) throw new Error('campaign: no story');
  return d.campaign as CampaignStateX;
}

export function registerCampaignDebug(s: Services): void {
  const db = (): Services['content'] => s.content;
  const evening = (): unknown => {
    const c = controller.state();
    if (!c?.evening) return null;
    return {
      phase: c.phase,
      levelId: c.levelId,
      noteIds: c.evening.noteIds,
      accepted: c.evening.accepted,
      replies: c.evening.replies,
      ignored: c.evening.ignored,
      left: c.left ?? [],
      undecided: undecided(c),
      anonymous: c.evening.noteIds.filter((id) => {
        const n = s.content.notes.get(id);
        return !!n && isAnonymous(n, c, s.content);
      }),
      pinsLeft: pinsLeft(c, s.content),
      objectSeen: c.evening.objectSeen,
      objects: eveningItems(c.dayIndex, eveningMode(c), c, s.content).map((i) => i.id),
      ripassa: ripassaAvailable(controller.data()),
    };
  };
  const refresh = (): string[] => {
    let fresh: string[] = [];
    controller.mutate((d) => {
      if (d.campaign) fresh = refreshDiary(d.campaign, d.knowledge, s.content);
    }, 'debug', false);
    controller.announceDiary(fresh);
    return fresh;
  };

  s.debug.register('campaign', {
    state: () => controller.state(),
    knowledge: () => controller.knowledge(),
    phase: () => controller.state()?.phase ?? null,
    scene: () => s.scenes.current(),
    nav: () => controller.navInfo(),
    newGame: async () => {
      await controller.newGame();
      return controller.state();
    },
    continue: async () => {
      await controller.continueGame();
      return controller.state()?.phase ?? null;
    },
    goto: (levelId: LevelId, phase?: string) => controller.goto(levelId, phase ?? 'sera'),
    evening,
    accept: (noteIds: string[] | string, guesses?: Record<string, CharacterId>) => {
      const ids = Array.isArray(noteIds) ? noteIds : [noteIds];
      const errors: Record<string, string> = {};
      controller.mutate((d) => {
        for (const id of ids) {
          const e = pinNote(cs(d), db(), id, guesses?.[id]);
          if (e) errors[id] = e;
        }
      }, 'debug');
      return { ok: Object.keys(errors).length === 0, errors, evening: evening() };
    },
    unpin: (noteId: string) => {
      controller.mutate((d) => unpinNote(cs(d), noteId), 'debug');
      return evening();
    },
    leave: (noteId: string) => {
      const e = controller.mutate((d) => leaveNote(cs(d), noteId), 'debug');
      return { ok: !e, error: e, evening: evening() };
    },
    reply: (noteId: string, r: 'R1' | 'R2') => {
      const log = emptyLog();
      const e = controller.mutate((d) => replyNote(cs(d), d.knowledge, db(), noteId, r, log), 'debug');
      controller.announceDiary(log.diary);
      return { ok: !e, error: e, flags: controller.state()?.flags ?? {} };
    },
    objectSeen: () => controller.objectSeen(),
    toNight: () => {
      const p = controller.toNight();
      return { levelId: p.level.id, mode: p.mode, accepted: p.accepted.map((a) => a.noteId), needsNome: p.needsNome };
    },
    ripassa: () => {
      const p = controller.ripassa();
      return p ? { levelId: p.level.id, mode: p.mode } : null;
    },
    skipDawn: () => {
      const c = controller.state();
      if (c?.phase !== 'alba') return c?.phase ?? null;
      if (s.scenes.current() === 'alba') {
        const scene = (s.scenes as Services['scenes'] & { scene?: () => unknown }).scene?.() as AlbaScene | null | undefined;
        if (scene && typeof scene.skip === 'function') {
          scene.skip();
          // Con l'oggetto dell'alba (C04) il primo salto apre la consegna: si salta anche quella.
          if (controller.state()?.phase === 'alba') scene.skip();
          if (controller.state()?.phase === 'alba') controller.toBilancio();
          return 'bilancio';
        }
      }
      controller.toBilancio();
      return 'bilancio';
    },
    dawn: () => {
      const scene = (s.scenes as Services['scenes'] & { scene?: () => unknown }).scene?.() as AlbaScene | null | undefined;
      const c = controller.state();
      return {
        report: c?.report?.dawn.map((v) => v.id) ?? [],
        position: s.scenes.current() === 'alba' && scene ? scene.position() : null,
        object: c?.report?.dawnItems ?? [],
        objectRead: !!c?.dawnRead,
        delivery: s.scenes.current() === 'alba' && scene && typeof scene.deliveryShown === 'function' ? scene.deliveryShown() : false,
      };
    },
    dawnObjectSeen: () => controller.dawnObjectSeen(),
    // Revisione 2 (R2-D5): oltre il merletto finito senza aspettare i 2,5 s né toccare «Continua».
    pastLace: () => controller.pastLace(),
    leaveArchive: (levelId: LevelId) => controller.leaveArchive(levelId),
    reread: (levelId: LevelId) => {
      const p = controller.rereadArchive(levelId);
      return { levelId: p.level.id, mode: p.mode };
    },
    report: () => controller.state()?.report ?? null,
    next: () => {
      const c = controller.state();
      if (!c) return null;
      if (c.phase === 'alba') controller.toBilancio();
      else if (c.phase === 'bilancio') controller.afterBilancio();
      else if (c.phase === 'archivio') controller.afterArchive();
      else if (c.phase === 'titoli') {
        const scene = (s.scenes as Services['scenes'] & { scene?: () => unknown }).scene?.() as FinaleScene | null | undefined;
        if (s.scenes.current() === 'finale' && scene && typeof scene.skip === 'function') scene.skip();
        else controller.finishTitles();
      }
      return controller.state()?.phase ?? null;
    },
    finishDay: async () => {
      const c = await controller.finishDay();
      return c ? { phase: c.phase, levelId: c.levelId, dayIndex: c.dayIndex } : null;
    },
    setFlag: (k: string, v: FlagValue) => {
      controller.mutate((d) => {
        cs(d).flags[k] = v;
      }, 'debug');
      refresh();
      return controller.state()?.flags ?? {};
    },
    setMemoria: (c: CharacterId, n: number) => {
      controller.mutate((d) => {
        cs(d).memoria[c] = Math.max(0, Math.min(3, Math.round(n)));
      }, 'debug');
      return controller.state()?.memoria ?? {};
    },
    learn: (kind: string, id: string, state?: string) => {
      controller.mutate((d) => {
        const k = d.knowledge;
        switch (kind) {
          case 'quirk':
            if (!k.quirks.includes(id as QuirkId)) k.quirks.push(id as QuirkId);
            break;
          case 'diary':
            addDiary(k, id, { db: db() });
            break;
          case 'desire':
            if (!k.desires.includes(id as CharacterId)) k.desires.push(id as CharacterId);
            break;
          case 'rule':
            if (!k.rules.includes(id as RuleId)) k.rules.push(id as RuleId);
            break;
          case 'archive':
            k.archive[id] = state === 'nuovo' || state === 'nominato' ? state : 'rammendato';
            break;
          case 'letter':
            if (!k.letters.includes(id)) k.letters.push(id);
            break;
          case 'object':
            if (!k.objects.includes(id)) k.objects.push(id);
            break;
          case 'question':
            k.questions[id as QuestionId] = state === 'risolta' ? 'risolta' : 'aperta';
            break;
          default:
            throw new Error(`campaign.learn: unknown kind ${kind}`);
        }
      }, 'debug');
      refresh();
      return controller.knowledge();
    },
    cards: () => {
      const c = controller.state();
      if (!c) return [];
      return choiceCards(levelOf(db(), db().campaign.choiceDay), c, controller.knowledge(), db()).map((x) => ({ noteId: x.note.id, ending: x.ending, available: x.available, missing: x.missing }));
    },
    requirements: (ending?: EndingId) => {
      const c = controller.state();
      if (!c) return null;
      return endingRequirements(ending ?? 'aperto', c, controller.knowledge(), db());
    },
    choose: (ending: EndingId) => controller.choose(ending),
    resumeFrom: async (levelId: LevelId) => {
      await controller.resumeFrom(levelId);
      return controller.state();
    },
    replay: async (levelId: LevelId) => {
      await controller.replay(levelId);
      return activeNight()?.params.origin ?? null;
    },
    archive: (levelId: LevelId) => {
      const p = controller.openArchive(levelId);
      return { levelId: p.level.id, mode: p.mode };
    },
    unlockAll: () => {
      s.save.update(
        (d) => {
          unlockEverything(d.unlocks);
          for (const day of s.content.campaign.days) if (day.archiveAfter && d.knowledge.archive[day.archiveAfter] === undefined) d.knowledge.archive[day.archiveAfter] = 'nuovo';
        },
        { immediate: true, reason: 'debug' },
      );
      return s.save.data().unlocks;
    },
    finale: () => {
      const scene = (s.scenes as Services['scenes'] & { scene?: () => unknown }).scene?.() as FinaleScene | null | undefined;
      return s.scenes.current() === 'finale' && scene && typeof scene.info === 'function' ? scene.info() : null;
    },
  });
}
