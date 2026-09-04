import { buildVillage } from './maps/village.ts';
import { buildWoods } from './maps/woods.ts';
import { buildShrine } from './maps/shrine.ts';

const built = [buildVillage(), buildWoods(), buildShrine()];
for (const f of built) console.log('wrote', f);
