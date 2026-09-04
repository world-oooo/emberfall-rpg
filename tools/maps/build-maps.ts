import { buildVillage } from './maps/village.ts';
import { buildWoods } from './maps/woods.ts';

const built = [buildVillage(), buildWoods()];
for (const f of built) console.log('wrote', f);
