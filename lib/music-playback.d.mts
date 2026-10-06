export type PlayMode = "once" | "single" | "random" | "loop";
export type EndedTransition = { type: "stop" } | { type: "repeat"; index: number } | { type: "advance"; index: number };
export function getEndedTransition(mode: PlayMode, current: number, length: number, random?: () => number): EndedTransition;
export function getAutomaticFailureNextIndex(mode: PlayMode, current: number, length: number, tried?: Set<number>, random?: () => number): number | null;
