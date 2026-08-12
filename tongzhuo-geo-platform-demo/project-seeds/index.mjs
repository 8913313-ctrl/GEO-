import { tongzhuoGeoProjectSeed } from "./tongzhuo-geo.mjs";
import { buildingMaterialsDemoProjectSeed } from "./building-materials-demo.mjs";
import { machineryDemoProjectSeed } from "./machinery-demo.mjs";
import { energyDemoProjectSeed } from "./energy-demo.mjs";
import { beautyDemoProjectSeed } from "./beauty-demo.mjs";

const PROJECT_SEEDS = new Map([[tongzhuoGeoProjectSeed.key, tongzhuoGeoProjectSeed], [buildingMaterialsDemoProjectSeed.key, buildingMaterialsDemoProjectSeed], [machineryDemoProjectSeed.key, machineryDemoProjectSeed], [energyDemoProjectSeed.key, energyDemoProjectSeed], [beautyDemoProjectSeed.key, beautyDemoProjectSeed]]);

export function resolveProjectSeed(key = "") {
  const normalizedKey = String(key || "").trim();
  return normalizedKey ? PROJECT_SEEDS.get(normalizedKey) || null : null;
}

export function projectSeedKeys() {
  return [...PROJECT_SEEDS.keys()];
}
