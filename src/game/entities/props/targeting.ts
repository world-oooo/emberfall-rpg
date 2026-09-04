import type { InteractionContext, Interactable } from './Interactable';

export interface InteractionOrigin {
  x: number;
  y: number;
}

export interface InteractionFacing {
  x: number;
  y: number;
}

export function chooseInteractionTarget(
  targets: readonly Interactable[],
  origin: InteractionOrigin,
  facing: InteractionFacing,
  ctx: InteractionContext,
): Interactable | null {
  let best: Interactable | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const target of targets) {
    if (target.isDestroyed || !target.canInteract(ctx)) continue;
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > target.radius * target.radius) continue;
    const len = Math.max(1, Math.sqrt(d2));
    const facingBonus = Math.max(0, (dx / len) * facing.x + (dy / len) * facing.y) * 80;
    const score = d2 - target.priority * 200 - facingBonus;
    if (score < bestScore) {
      best = target;
      bestScore = score;
    }
  }
  return best;
}
