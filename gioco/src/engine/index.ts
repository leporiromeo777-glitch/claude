/**
 * Motore delle regole di TRAMA (ARCHITETTURA 5.2): TypeScript puro, senza DOM,
 * servizi né tempo. Gira identico nel browser, nel Web Worker e in Node.
 */
export { createContext, flagOn } from './context';
export { initialState, cloneState, stateKey, sameLace } from './state';
export type { EngineLaceState } from './state';
export { blocked, forcedCrossings, checkCrossing, previewRow, applyRow, unreachablePins } from './rules';
export { evaluate, mentionsNome } from './conditions';
export { metrics, isSymmetric, ORO_MIN_INCROCI } from './metrics';
export { solve, SOLVER_VERSION, defaultMaxStates } from './solver';
export { solveAsync, generateAsync } from './solver-client';
export { planAutoRow } from './autoweave';
export { hintFor } from './hints';
export type { HintArgs } from './hints';
export { generate, minRange, GENERATOR_VERSION, GEN_KEYS } from './generator';
export type { GenSpec, GenResult } from './generator';
export { dailySpec, dailyLevelId, weekday, dayOfYear, nextDate, DAILY_RULES } from './daily';
export { greedyPlay } from './bot';
export type { BotResult } from './bot';
export { encodeSpartito, decodeSpartito, spartitoRows, spartitoRef, GRADO_CODES } from './spartito';
export type { Spartito } from './spartito';
export { simulate, simulateAndEvaluate } from './simulate';
export type { Simulation } from './simulate';
export { levelSourceHash, levelSourceHashFromDB, pinsForLevel, stableStringify, fnv1a32 } from './hash';
export { engineTextKeys, violationKey, violationTextKey, conditionKey, HINT_KEYS, VIOLATION_CODES, VIOLATION_DETAIL_KEYS } from './keys';
export { memoriaAfterDay, MEMORIA_MIN, MEMORIA_MAX } from './memoria';
export { QUALITY, CRITERIA, judgeQuality, qualityExemption, dilemmaRequired, emptyRows, designata } from './quality';
export type { Criterion, QualityItem, QualityInput, QualityJudgement, QualityExemption } from './quality';
