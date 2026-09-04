import type { SaveGame, InventoryEntry } from '../core/session';
import { getItem, hasItemDef } from '../data/items';

export type EquipmentSlot = keyof SaveGame['equipment'];

export interface InventoryChange {
  itemId: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
}

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Quantity must be a positive integer: ${quantity}`);
}

export class InventorySystem {
  constructor(private readonly save: SaveGame) {}

  get entries(): readonly InventoryEntry[] {
    return this.save.inventory;
  }

  quantityOf(itemId: string): number {
    if (itemId === 'coin') return this.save.player.coins;
    return this.save.inventory.find((entry) => entry.itemId === itemId)?.quantity ?? 0;
  }

  has(itemId: string, quantity = 1): boolean {
    assertPositiveQuantity(quantity);
    return this.quantityOf(itemId) >= quantity;
  }

  add(itemId: string, quantity = 1): InventoryChange {
    assertPositiveQuantity(quantity);
    const item = getItem(itemId);
    const previousQuantity = this.quantityOf(itemId);

    if (item.category === 'currency') {
      this.save.player.coins += quantity;
      return { itemId, quantity, previousQuantity, newQuantity: this.save.player.coins };
    }

    const existing = this.save.inventory.find((entry) => entry.itemId === itemId);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, item.maxStack);
    } else {
      this.save.inventory.push({ itemId, quantity: Math.min(quantity, item.maxStack) });
    }

    return { itemId, quantity, previousQuantity, newQuantity: this.quantityOf(itemId) };
  }

  addMany(entries: readonly InventoryEntry[]): InventoryChange[] {
    return entries.map((entry) => this.add(entry.itemId, entry.quantity));
  }

  remove(itemId: string, quantity = 1): InventoryChange {
    assertPositiveQuantity(quantity);
    if (!hasItemDef(itemId)) throw new Error(`Unknown item: ${itemId}`);
    const previousQuantity = this.quantityOf(itemId);
    if (previousQuantity < quantity) throw new Error(`Not enough ${itemId}: ${previousQuantity}/${quantity}`);

    if (itemId === 'coin') {
      this.save.player.coins -= quantity;
      return { itemId, quantity: -quantity, previousQuantity, newQuantity: this.save.player.coins };
    }

    const index = this.save.inventory.findIndex((entry) => entry.itemId === itemId);
    const entry = this.save.inventory[index];
    if (!entry) throw new Error(`Item not found: ${itemId}`);
    entry.quantity -= quantity;
    if (entry.quantity === 0) {
      this.save.inventory.splice(index, 1);
      for (const slot of Object.keys(this.save.equipment) as EquipmentSlot[]) {
        if (this.save.equipment[slot] === itemId) this.save.equipment[slot] = null;
      }
    }

    return { itemId, quantity: -quantity, previousQuantity, newQuantity: this.quantityOf(itemId) };
  }

  equip(itemId: string): EquipmentSlot {
    if (!this.has(itemId)) throw new Error(`Cannot equip missing item: ${itemId}`);
    const item = getItem(itemId);
    const slot: EquipmentSlot | null = item.category === 'weapon' ? 'weapon' : item.category === 'accessory' ? 'accessory' : null;
    if (!slot) throw new Error(`Item cannot be equipped: ${itemId}`);
    this.save.equipment[slot] = itemId;
    return slot;
  }

  unequip(slot: EquipmentSlot): void {
    this.save.equipment[slot] = null;
  }
}
