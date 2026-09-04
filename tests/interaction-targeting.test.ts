import { describe, expect, it, vi } from 'vitest';
import type { InteractionContext, Interactable, InteractableKind } from '../src/game/entities/props/Interactable';
import { chooseInteractionTarget } from '../src/game/entities/props/targeting';

const ctx = {} as InteractionContext;

function target(id: string, x: number, y: number, opts: Partial<Interactable> = {}): Interactable {
  return {
    id,
    kind: (opts.kind ?? 'sign') as InteractableKind,
    x,
    y,
    radius: opts.radius ?? 24,
    prompt: opts.prompt ?? 'Read',
    priority: opts.priority ?? 0,
    isDestroyed: opts.isDestroyed,
    canInteract: opts.canInteract ?? (() => true),
    interact: opts.interact ?? vi.fn(),
  };
}

describe('chooseInteractionTarget', () => {
  it('chooses the nearest active target inside radius', () => {
    const chosen = chooseInteractionTarget(
      [target('far', 18, 0), target('near', 8, 0)],
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      ctx,
    );

    expect(chosen?.id).toBe('near');
  });

  it('ignores destroyed, disabled, and out-of-range targets', () => {
    const chosen = chooseInteractionTarget(
      [
        target('destroyed', 4, 0, { isDestroyed: true }),
        target('disabled', 5, 0, { canInteract: () => false }),
        target('too_far', 50, 0),
        target('valid', 10, 0),
      ],
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      ctx,
    );

    expect(chosen?.id).toBe('valid');
  });

  it('uses priority and facing as tie breakers for close candidates', () => {
    const chosen = chooseInteractionTarget(
      [target('behind', -8, 0, { priority: 0 }), target('ahead_high_priority', 10, 0, { priority: 1 })],
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      ctx,
    );

    expect(chosen?.id).toBe('ahead_high_priority');
  });
});
