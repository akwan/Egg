import { ei } from '../proto';
import data, { AfxFamily, AfxTier, getArtifactFamilyProps, getArtifactTierProps } from './data';
import { CraftingPriceParams, Recipe } from './data.json';
import { Artifact } from './effects';

import Name = ei.ArtifactSpec.Name;
import Level = ei.ArtifactSpec.Level;
import Rarity = ei.ArtifactSpec.Rarity;
import Type = ei.ArtifactSpec.Type;

type ItemId = string;

const itemIdToRecipe = new Map<ItemId, Recipe | null>(
  data.artifact_families
    .map(f => f.tiers)
    .flat()
    .map(t => [t.id, t.recipe])
);

export class Inventory {
  store: Map<Name, Map<Level, InventoryItem>>;
  stoned: Artifact[];

  constructor(db: ei.IArtifactsDB) {
    this.store = new Map();
    this.stoned = [];
    // Initialize with all possible items.
    for (const tier of data.artifact_families.map(f => f.tiers).flat()) {
      let family = this.store.get(tier.afx_id);
      if (family === undefined) {
        family = new Map();
        this.store.set(tier.afx_id, family);
      }
      family.set(tier.afx_level, new InventoryItem(tier.afx_id, tier.afx_level));
    }
    for (const item of db.discoveredArtifacts || []) {
      this.getItem(item).discovered = true;
    }
    for (const item of db.craftingCounts || []) {
      this.getItem(item.spec!).crafted = item.count!;
    }
    for (const item of db.inventoryItems || []) {
      const artifact = item.artifact!;
      const count = item.quantity!;
      this.add(artifact.spec!, count);
      for (const stone of artifact.stones || []) {
        this.add(stone, count);
      }
      if (artifact.stones && artifact.stones.length > 0) {
        this.stoned.push(Artifact.fromCompleteArtifact(artifact));
      }
    }
  }

  getItem(spec: ei.IArtifactSpec): InventoryItem {
    const item = this.store.get(spec.name!)?.get(spec.level!);
    if (item === undefined) {
      throw new Error(`unrecognized artifact encountered: ${JSON.stringify(spec)}`);
    }
    return item;
  }

  add(spec: ei.IArtifactSpec, count: number): void {
    this.getItem(spec).add(spec.rarity!, count);
  }

  get items(): InventoryItem[] {
    return [...this.store.values()].map(f => [...f.values()]).flat();
  }

  get catalog(): InventoryFamily[] {
    return data.artifact_families.map(
      f =>
        new InventoryFamily(
          f.afx_id,
          f.tiers.map(t => this.getItem({ name: t.afx_id, level: t.afx_level }))
        )
    );
  }

  get totalCount(): number {
    return sum(this.items.map(item => item.have));
  }

  get commonCount(): number {
    return sum(this.items.map(item => item.haveCommon));
  }

  get rareCount(): number {
    return sum(this.items.map(item => item.haveRare));
  }

  get epicCount(): number {
    return sum(this.items.map(item => item.haveEpic));
  }

  get legendaryCount(): number {
    return sum(this.items.map(item => item.haveLegendary));
  }

  get distinctLegendaryCount(): number {
    return sum(this.items.map(item => (item.haveLegendary > 0 ? 1 : 0)));
  }

  get sunkCost(): number {
    return sum(this.items.map(item => item.sunkCost));
  }

  countCraftable(targetItem: InventoryItem): number {
    const counter = new Map<ItemId, number>();
    for (const f of this.store.values()) {
      for (const item of f.values()) {
        counter.set(item.id, item.have);
      }
    }
    const targetId = targetItem.id;
    counter.set(targetId, 0);
    let craftable = 0;
    while (true) {
      const ingredients = new Map<ItemId, number>([[targetId, 1]]);
      while (true) {
        const nextIngredient = ingredients.entries().next();
        if (nextIngredient.done) {
          // All ingredients accounted for.
          break;
        }
        const [ingredientId, numNeeded] = nextIngredient.value;
        ingredients.delete(ingredientId);
        const numPossessed = counter.get(ingredientId)!;
        if (numPossessed >= numNeeded) {
          // We have enough of the ingredient.
          counter.set(ingredientId, numPossessed - numNeeded);
          continue;
        }
        // We don't have enough, need to further break down.
        counter.set(ingredientId, 0);
        const deficit = numNeeded - numPossessed;
        const recipe = itemIdToRecipe.get(ingredientId);
        if (!recipe) {
          // Primitive ingredient deficit. Bail.
          ingredients.set(ingredientId, deficit);
          break;
        }
        for (const subingredient of recipe.ingredients) {
          ingredients.set(
            subingredient.id,
            (ingredients.get(subingredient.id) || 0) + deficit * subingredient.count
          );
        }
      }
      if (ingredients.size > 0) {
        // Some ingredients are not present.
        break;
      }
      craftable++;
    }
    return craftable;
  }
}

export class InventoryItem {
  afxId: Name;
  afxLevel: Level;
  discovered = false;
  haveRarity: [number, number, number, number] = [0, 0, 0, 0];
  crafted = 0;
  protected afxTier: AfxTier;

  constructor(afxId: Name, afxLevel: Level) {
    this.afxId = afxId;
    this.afxLevel = afxLevel;
    this.afxTier = getArtifactTierProps(afxId, afxLevel);
  }

  add(rarity: Rarity, count = 1): void {
    this.haveRarity[rarity] += count;
  }

  get props(): AfxTier {
    return this.afxTier;
  }

  get id(): ItemId {
    return this.afxTier.id;
  }

  get type(): Type {
    return this.afxTier.afx_type;
  }

  get tierNumber(): number {
    return this.afxTier.tier_number;
  }

  get name(): string {
    return this.afxTier.name;
  }

  get tierName(): string {
    return this.afxTier.tier_name;
  }

  get iconPath(): string {
    return `egginc/${this.afxTier.icon_filename}`;
  }

  get have(): number {
    return sum(this.haveRarity);
  }

  get haveCommon(): number {
    return this.haveRarity[Rarity.COMMON];
  }

  get haveRare(): number {
    return this.haveRarity[Rarity.RARE];
  }

  get haveEpic(): number {
    return this.haveRarity[Rarity.EPIC];
  }

  get haveLegendary(): number {
    return this.haveRarity[Rarity.LEGENDARY];
  }

  get sunkCost(): number {
    const params = this.afxTier.recipe?.crafting_price;
    if (!params) {
      return 0;
    }
    let cost = 0;
    for (let i = 0; i < this.crafted; i++) {
      cost += singleCraftCost(params, i);
    }
    return cost;
  }

  get nextCraftCost(): number {
    const params = this.afxTier.recipe?.crafting_price;
    if (!params) {
      return 0;
    }
    return singleCraftCost(params, this.crafted);
  }

  stoneSlotCount(rarity: Rarity): number {
    if (!this.afxTier.effects) {
      return 0;
    }
    for (const effect of this.afxTier.effects) {
      if (rarity === effect.afx_rarity) {
        return effect.slots || 0;
      }
    }
    throw new Error(
      `the impossible happened: invalid rarity ${rarity} for ${this.afxId}:${this.afxLevel}`
    );
  }

  effectDelta(rarity: Rarity): number {
    if (!this.afxTier.effects) {
      return NaN;
    }
    for (const effect of this.afxTier.effects) {
      if (rarity === effect.afx_rarity) {
        return effect.effect_delta || 0;
      }
    }
    throw new Error(
      `the impossible happened: invalid rarity ${rarity} for ${this.afxId}:${this.afxLevel}`
    );
  }
}

export class InventoryFamily {
  afxId: Name;
  tiers: InventoryItem[];
  protected afxFamily: AfxFamily;

  constructor(afxId: Name, tiers: InventoryItem[]) {
    this.afxId = afxId;
    this.tiers = tiers;
    this.afxFamily = getArtifactFamilyProps(afxId);
  }

  get props(): AfxFamily {
    return this.afxFamily;
  }

  get name(): string {
    return this.afxFamily.name;
  }

  get type(): Type.ARTIFACT | Type.STONE | Type.INGREDIENT {
    return this.afxFamily.afx_type;
  }

  get effect(): string {
    return this.afxFamily.effect;
  }

  get discovered(): boolean {
    return this.tiers.some(t => t.discovered);
  }

  // Returns 0 if none of the tiers have been discovered.
  get highestTierDiscovered(): number {
    let highestTier = 0;
    for (const tier of this.tiers) {
      if (tier.discovered) {
        highestTier = tier.tierNumber;
      }
    }
    return highestTier;
  }
}

function singleCraftCost(params: CraftingPriceParams, previousCrafts: number): number {
  return Math.floor(
    Math.max(
      1,
      params.base -
        (params.base - params.low) * Math.min(1, previousCrafts / params.domain) ** params.curve
    )
  );
}

function sum(arr: number[]): number {
  return arr.reduce((s, elem) => s + elem);
}
