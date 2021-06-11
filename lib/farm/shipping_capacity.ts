// https://egg-inc.fandom.com/wiki/Vehicles

import { Farm, Research } from './farm';

type VehicleId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

function isVehicleId(x: number): x is VehicleId {
  return Number.isInteger(x) && x >= 0 && x <= 11;
}

interface VehicleType {
  id: VehicleId;
  name: string;
  // Unupgraded shipping capacity per second.
  baseCapacity: number;
}

export interface Vehicle extends VehicleType {
  trainLength: number;
}

const vehicleTypes: VehicleType[] = [
  {
    id: 0,
    name: 'Trike',
    baseCapacity: 5e3 / 60,
  },
  {
    id: 1,
    name: 'Transit Van',
    baseCapacity: 15e3 / 60,
  },
  {
    id: 2,
    name: 'Pickup',
    baseCapacity: 50e3 / 60,
  },
  {
    id: 3,
    name: '10 Foot',
    baseCapacity: 100e3 / 60,
  },
  {
    id: 4,
    name: '24 Foot',
    baseCapacity: 250e3 / 60,
  },
  {
    id: 5,
    name: 'Semi',
    baseCapacity: 500e3 / 60,
  },
  {
    id: 6,
    name: 'Double Semi',
    baseCapacity: 1e6 / 60,
  },
  {
    id: 7,
    name: 'Future Semi',
    baseCapacity: 5e6 / 60,
  },
  {
    id: 8,
    name: 'Mega Semi',
    baseCapacity: 15e6 / 60,
  },
  {
    id: 9,
    name: 'Hover Semi',
    baseCapacity: 30e6 / 60,
  },
  {
    id: 10,
    name: 'Quantum Transporter',
    baseCapacity: 50e6 / 60,
  },
  {
    id: 11,
    name: 'Hyperloop Train',
    baseCapacity: 50e6 / 60,
  },
];

function isHoverVehicle(vehicle: VehicleType): boolean {
  return vehicle.id >= 9;
}

function isHyperloop(vehicle: VehicleType): boolean {
  return vehicle.id === 11;
}

export interface ShippingCapacityResearch extends Research {
  hoverOnly?: boolean;
  hyperloopOnly?: boolean;
}

export interface ShippingCapacityResearchInstance extends ShippingCapacityResearch {
  level: number;
}

const shippingCapacityRelevantResearches: ShippingCapacityResearch[] = [
  {
    id: 'leafsprings',
    name: 'Improved Leafsprings',
    maxLevel: 30,
    perLevel: 0.05,
  },
  {
    id: 'lightweight_boxes',
    name: 'Lightweight Boxes',
    maxLevel: 40,
    perLevel: 0.1,
  },
  {
    id: 'driver_training',
    name: 'Driver Training',
    maxLevel: 30,
    perLevel: 0.05,
  },
  {
    id: 'super_alloy',
    name: 'Super Alloy Frames',
    maxLevel: 50,
    perLevel: 0.05,
  },
  {
    id: 'quantum_storage',
    name: 'Quantum Egg Storage',
    maxLevel: 20,
    perLevel: 0.05,
  },
  {
    id: 'hover_upgrades',
    name: 'Hover Upgrades',
    maxLevel: 25,
    perLevel: 0.05,
    hoverOnly: true,
  },
  {
    id: 'dark_containment',
    name: 'Dark Containment',
    maxLevel: 25,
    perLevel: 0.05,
  },
  {
    id: 'neural_net_refine',
    name: 'Neural Net Refinement',
    maxLevel: 25,
    perLevel: 0.05,
  },
  {
    id: 'hyper_portalling',
    name: 'Hyper Portalling',
    maxLevel: 25,
    perLevel: 0.05,
    hyperloopOnly: true,
  },
  {
    id: 'transportation_lobbyist',
    name: 'Transportation Lobbyists',
    maxLevel: 30,
    perLevel: 0.05,
  },
];

export function vehicleList(farm: Farm): Vehicle[] {
  const vehicleIds = farm.farm.vehicles!;
  const trainLengths = farm.farm.trainLength!;
  if (vehicleIds.length !== trainLengths.length) {
    throw new Error(
      `vehicles and trainLength have different lengths: ${vehicleIds.length} != ${trainLengths.length}`
    );
  }
  const count = vehicleIds.length;
  const vehicles: Vehicle[] = [];
  for (let i = 0; i < count; i++) {
    const vehicleId = vehicleIds[i];
    const trainLength = trainLengths[i];
    if (!isVehicleId(vehicleId)) {
      throw new Error(`${vehicleId} is not a recognized vehicle ID`);
    }
    const prototype = vehicleTypes[vehicleId];
    vehicles.push({
      ...prototype,
      trainLength,
      baseCapacity: prototype.baseCapacity * trainLength,
    });
  }
  return vehicles;
}

export function shippingCapacityResearches(farm: Farm): ShippingCapacityResearchInstance[] {
  return farm.researches(shippingCapacityRelevantResearches);
}

export function vehicleShippableEggsPerSecondList(
  farm: Farm,
  vehicles: Vehicle[],
  researches: ShippingCapacityResearchInstance[]
): number[] {
  let universalMultiplier = 1;
  let hoverOnlyMultiplier = 1;
  let hyperloopOnlyMultiplier = 1;
  for (const research of researches) {
    const multiplier = 1 + research.level * research.perLevel;
    if (research.hoverOnly) {
      hoverOnlyMultiplier *= multiplier;
    } else if (research.hyperloopOnly) {
      hyperloopOnlyMultiplier *= multiplier;
    } else {
      universalMultiplier *= multiplier;
    }
  }
  const artifactsMultiplier = farm.artifactSet.shippingCapacityMultiplier;
  return vehicles.map(
    vehicle =>
      vehicle.baseCapacity *
      universalMultiplier *
      (isHoverVehicle(vehicle) ? hoverOnlyMultiplier : 1) *
      (isHyperloop(vehicle) ? hyperloopOnlyMultiplier : 1) *
      artifactsMultiplier
  );
}
