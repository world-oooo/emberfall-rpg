import type Phaser from 'phaser';
import { propBool, propStr, type LoadedMap, type TiledObject } from '../../world/MapLoader';
import type { Npc } from '../npcs/Npc';
import { ChestProp } from './ChestProp';
import type { Interactable, InteractableCallbacks, InteractableKind } from './Interactable';
import { MapInteractable } from './MapInteractable';

const KIND_BY_TILED_TYPE: Record<string, InteractableKind> = {
  Sign: 'sign',
  Shrine: 'shrine',
  Dummy: 'dummy',
  Savepoint: 'savepoint',
  EmberPedestal: 'emberPedestal',
};

export function createMapInteractables(
  scene: Phaser.Scene,
  loaded: LoadedMap,
  openedChests: readonly string[],
  callbacks: InteractableCallbacks = {},
): Interactable[] {
  const targets: Interactable[] = [];
  for (const o of loaded.objects.Interactables ?? []) {
    const kind = KIND_BY_TILED_TYPE[o.type];
    if (!kind) continue;
    const id = propStr(o, 'interactionId', o.name);
    targets.push(new MapInteractable(scene, { id, kind, x: pointX(o), y: pointY(o), data: objectData(o) }, callbacks));
  }
  for (const o of loaded.objects.Chests ?? []) {
    const chestId = propStr(o, 'chestId', o.name);
    targets.push(new ChestProp(scene, {
      chestId,
      lootTable: propStr(o, 'lootTable'),
      x: pointX(o),
      y: pointY(o),
      big: propBool(o, 'big'),
      opened: openedChests.includes(chestId),
    }, callbacks));
  }
  return targets;
}

export function createNpcInteractable(npc: Npc, callbacks: InteractableCallbacks = {}): Interactable {
  return {
    id: npc.npcId,
    kind: 'npc',
    x: npc.x,
    y: npc.feetY,
    radius: 34,
    prompt: 'Talk',
    priority: 10,
    data: { npcId: npc.npcId },
    canInteract: () => true,
    interact: (ctx) => {
      npc.faceToward(ctx.player.x, ctx.player.y);
      callbacks.onNpc?.(npc.npcId, ctx);
    },
    setHighlighted: (highlighted) => {
      if (highlighted) npc.sprite.setTint(0xf7e2a1);
      else npc.sprite.clearTint();
    },
  };
}

function pointX(o: TiledObject): number {
  return Math.round(o.x + (o.width ? o.width / 2 : 0));
}

function pointY(o: TiledObject): number {
  return Math.round(o.y + (o.height ? o.height : 0));
}

function objectData(o: TiledObject): Readonly<Record<string, string | number | boolean>> {
  const data: Record<string, string | number | boolean> = {};
  for (const p of o.properties ?? []) data[p.name] = p.value;
  return data;
}
