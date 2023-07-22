/* This is an attempt at a more optimal solution;
 *
 * ∞ While there are still deliveries to be made;
 * 1. It starts off by selecting the first delivery item
 * 2. Selects the closest train with enough capacity
 * 3. Move selected train towards the pickup station
 * 4. At each station along the way it attempts to pick more packages
 *      if ?
 *        train have enough capacity &
 *        package pickup is where train is &
 *        package status is still waiting to be picked up &
 *        package destination is in the same direction train is going & // TODO: <
 *        package destination is before the current train destination // TODO: <
 * 5. At each station along the way it drop off packages
 *      remove the dropped packages from delivery list
 * */

import C from "chalk";
import { readFile, stat } from "node:fs/promises";

console.clear();

// /////////////////////////////////////////////////////////////////////// //
// NOTE: Runner Preprations ////////////////////////////////////////////// //

// Debug: Print a line separator filling terminal columns
const logSeparator = (char = "#") =>
  console.log(
    Array.from({ length: process.stdout.columns }).fill(char).join("")
  );

// Debug: Logger tag function
function log(tpl, ...vars) {
  for (const [i, key] of tpl.entries()) {
    if (!key) continue;
    process.stdout.write(key + C.red.bold(JSON.stringify(vars[i]) ?? ""));
  }
  process.stdout.write("\n");
}

// Debug: Catch file not found
const catchFileNotFound = (path) =>
  stat(path).catch(() => {
    console.error(C.yellow(path), C.red("doesnt exist"));
    process.exit(1);
  });

// Input path
const path = process.argv[2] ?? "input-basic.json";
log`input path: ${path}`;

// Debug: Check if provided input path exists
catchFileNotFound(path);

// Load up the input
const input = JSON.parse(await readFile(`./${path}`, { encoding: "utf8" }));

console.log(input);
/* input-basic.json
  {
    "stations": ["A", "B", "C", "D"],
    "edges": ["E1,A,B,30", "E2,B,C,10", "E3,C,D,40"],
    "deliveries": ["K1,5,A,C"],
    "trains": ["Q1,6,B"]
  }
*/

// /////////////////////////////////////////////////////////////////////// //
// NOTE: Begin Solution ////////////////////////////////////////////////// //

logSeparator("=");

console.time("BENCH");

// Destructure input detail
const { stations, edges, deliveries, trains } = input;

// Delivery statuses enums
const STATUS = Object.freeze({
  AT_PICKUP: Symbol("AT_PICKUP"),
  IN_FLIGHT: Symbol("IN_FLIGHT"),
  DELIVERED: Symbol("DELIVERED"),
});

// Direction enums
const DIRECTIONS = Object.freeze({
  LEFT: Symbol("LEFT"),
  RIGHT: Symbol("RIGHT"),
});

// Reduce input stations to produce positions
const positions = Object.freeze(
  stations.reduce((acc, cur, i) => {
    acc[cur] = i;
    return acc;
  }, {})
);

console.log(positions);
// { A: 0, B: 1, C: 2, D: 3 }

// Reduce input edges to produce connection-map and distances
const { connections, distances } = Object.freeze(
  edges.reduce(
    (acc, cur) => {
      const [, src, dst, distance] = cur.split(",");

      acc.connections[src] = acc.connections[src] ?? [];
      acc.connections[dst] = acc.connections[dst] ?? [];

      acc.connections[src].push(dst);
      acc.connections[dst].push(src);

      acc.distances[`${src}-${dst}`] = +distance;
      acc.distances[`${dst}-${src}`] = +distance;

      return acc;
    },
    { connections: {}, distances: {} }
  )
);

console.log(connections);
//{ A: [ 'B' ], B: [ 'A', 'C' ], C: [ 'B', 'D' ], D: [ 'C' ] }

console.log(distances);
// { 'A-B': 30, 'B-A': 30, 'B-C': 10, 'C-B': 10, 'C-D': 40, 'D-C': 40 }

// Reduce input deliveries to produce delivery status
const deliveryStatus = deliveries.reduce((acc, cur) => {
  const [pkg] = cur.split(",");
  acc[pkg] = STATUS.AT_PICKUP;
  return acc;
}, {});

console.log(deliveryStatus);
// { K1: Symbol(AT_PICKUP) }

// Reduce to produce train stations, capacities, loads
const { trainStations, trainCapacities, trainLoads } = trains.reduce(
  (acc, cur) => {
    const [train, capacity, station] = cur.split(",");
    acc.trainCapacities[train] = +capacity;
    acc.trainStations[train] = station;
    acc.trainLoads[train] = [];
    return acc;
  },
  { trainStations: {}, trainCapacities: {}, trainLoads: {} }
);

console.log(trainStations);
// { Q1: 'B' }

console.log(trainCapacities);
// { Q1: 6 }

console.log(trainLoads);
// { Q1: [] }

// Load a package onto a train
const loadPackage = (train, pkg) => {
  // Train is already holding this package
  if (trainLoads[train].includes(pkg)) return;
  // Add package to train loads
  trainLoads[train].push(pkg);
  // Mark package delivery status to in-flight
  deliveryStatus[pkg] = STATUS.IN_FLIGHT;
};

// Unload a package from a train
const unloadPackage = (train, pkg) => {
  // Train is not holding this package
  if (trainLoads[train].includes(pkg) === false) return;
  // Remove package from train loads
  const trainPkgIndex = trainLoads[train].findIndex((x) => x === pkg);
  trainLoads[train].splice(trainPkgIndex, 1);
  // Mark package delivery status to delivered
  deliveryStatus[pkg] = STATUS.DELIVERED;
  // Remove package from delivery list
  const pkgIndex = deliveries.findIndex((x) => {
    const [name] = x.split(",");
    return name === pkg;
  });
  deliveries.splice(pkgIndex, 1);
};

// Return package detail
const getPkgDetail = (pkgName) => {
  const pkg = deliveries.find((x) => {
    const [name] = x.split(",");
    return x === pkgName || name === pkgName;
  });
  if (!pkg) return {};
  const [name, weight, from, to] = pkg.split(",");
  return { name, weight: +weight, from, to };
};

// Return train remaining capacity
const getTrainRemainingCapacity = (trainName) =>
  // Train full capacity
  trainCapacities[trainName] -
  // Train current total load
  trainLoads[trainName].reduce((acc, cur) => acc + getPkgDetail(cur).weight, 0);

// Returns a train with enough capacity
const getTrainForWeight = (weight) =>
  Object.keys(trainLoads).find((train) => trainCapacities[train] >= weight);

// Reduce to produce a map of closest train for each package
const packagesTrainCandidates = () =>
  deliveries.reduce((acc, cur) => {
    const { name, weight, from } = getPkgDetail(cur);
    const pkgPos = positions[from];

    // Reduce trains to pick the closest to current package
    const { candidate } = Object.keys(trainStations).reduce(
      (_acc, _cur) => {
        const trainPos = positions[trainStations[_cur]];

        let diff;

        if (pkgPos > trainPos) {
          diff = pkgPos - trainPos;
        } else {
          diff = trainPos - pkgPos;
        }

        // This diff is better than previous diff
        if (diff < _acc.distance) {
          _acc.candidate = _cur;
          _acc.distance = diff;
        }

        return _acc;
      },
      { candidate: null, distance: edges.length }
    );

    const candidateCapacity = trainCapacities[candidate];

    // Package weight is more than train capacity
    if (weight > candidateCapacity) {
      // Find train with enough capacity regardless of its distance
      acc[name] = getTrainForWeight(weight);
    } else {
      acc[name] = candidate;
    }

    return acc;
  }, {});

logSeparator("_");

// NOTE: Debug: There cant be more moves than possible edges
const DEBUG_ESCAPE_HATCH_LIMIT = edges.length;

// Our global state
const moves = [];
let time = 0;
let current;

// Return the immediate next possible move and direction
const getNext = (to) => {
  // Possible next moves
  const [next, alt] = connections[current];

  // Next is destination or There is no alteranative
  if (next === to || !alt) {
    return [DIRECTIONS.LEFT, next];
  }

  // The alteranative is the destination
  if (alt === to) {
    return [DIRECTIONS.RIGHT, alt];
  }

  // Go right
  if (positions[to] > positions[current]) {
    return [DIRECTIONS.RIGHT, alt];
  }

  // Go left
  return [DIRECTIONS.LEFT, next];
};

// Attempt to pickup packages along the way
const pickupPackages = (train, direction) => {
  log`if ${train} moving ${direction.toString()} can load up new package`;

  // Get train remaining capacity
  const remainingCapacity = getTrainRemainingCapacity(train);
  log`train ${train} currently have ${remainingCapacity} capacity`;

  // Select a package candidate for train
  const packageCandidate = deliveries.find((x) => {
    const { name, weight, from } = getPkgDetail(x);

    // Does it have enough remaining capacity?
    const enoughCapacity = remainingCapacity >= weight;
    // Is it still at pickup?
    const atPickup = deliveryStatus[name] === STATUS.AT_PICKUP;
    // Is package pickup location is where we are?
    const isHere = from === current;
    // TODO: check for direction the current is going
    // const sameDirection = true
    // TODO: check if package dropoff is before current destination
    // const dropoffIsBeforeCurrentDestination = true

    return enoughCapacity && atPickup && isHere;
  });

  // We found a package candidate
  if (packageCandidate) {
    const [name] = packageCandidate.split(",");
    log`found possible package candidate: ${name}`;
    loadPackage(train, name);
  }
};

// Move the train towards a destination ( ? -> F )
function moveTrain(train, to) {
  log`move ${train} from ${current} to ${to}`;

  // Our local state
  let [direction, next] = getNext(to);

  // NOTE: Debug: emergency circuit breaker
  let DEBUG_ESCAPE_HATCH_COUNTER = 0;

  // Move until we've reached destinations
  while (current !== to) {
    // NOTE: Debug: Increment circuit breaker counter
    DEBUG_ESCAPE_HATCH_COUNTER++;

    // Attempt to load more packages on train
    pickupPackages(train, direction);

    // Filter packages that their pickup is current
    const pickPackages = trainLoads[train].filter(
      (x) => getPkgDetail(x).from === current
    );

    // Filter packages that their dropoff is next
    const dropPackages = trainLoads[train].filter(
      (x) => getPkgDetail(x).to === next
    );

    // Remove package from train loads and deliveries
    dropPackages.forEach((x) => unloadPackage(train, x));

    // Append the output
    moves.push(
      `W=${time}, T=${train}, N1=${current}, P1=[${pickPackages}], N2=${next}, P2=[${dropPackages}]`
    );

    // Update state
    time += distances[`${current}-${next}`];
    current = next;
    direction = getNext(to)[0];
    next = getNext(to)[1];
    trainStations[train] = current;

    // NOTE: Debug: emergency circuit breaker
    // This should never happen
    if (DEBUG_ESCAPE_HATCH_COUNTER > DEBUG_ESCAPE_HATCH_LIMIT) {
      console.info(C.cyan("There cant be more moves than possible edges"));
      console.error(C.red.bold("REACHED ESCAPE HATCH LIMIT!"), "exiting...");
      process.exit(1);
    }

    logSeparator("-");
  }
}

// NOTE: Debug: emergency circuit breaker
let DEBUG_ESCAPE_HATCH_COUNTER = 0;

// While there are still deliveries to be made
while (deliveries.length) {
  logSeparator(".");

  log`still got ${deliveries.length} deliveries to do`;

  // NOTE: Debug: emergency circuit breaker
  DEBUG_ESCAPE_HATCH_COUNTER++;
  // This should never happen
  if (DEBUG_ESCAPE_HATCH_COUNTER > DEBUG_ESCAPE_HATCH_LIMIT) {
    console.info(C.cyan("There cant be more moves than possible edges"));
    console.error(C.red.bold("REACHED ESCAPE HATCH LIMIT!"), "exiting...");
    process.exit(1);
  }

  // Pick the first package; we have to start somewhere!
  const [pick] = deliveries;
  const {
    name: pkg,
    from: pickupStation,
    to: dropoffStation,
  } = getPkgDetail(pick);

  // Pick the closest train to package with enough capacity
  const train = packagesTrainCandidates()[pkg];

  // This should never happen
  if (!train) {
    console.error(C.red(`There is no train for package ${pkg}`), "exiting...");
    process.exit(1);
  }

  log`picked ${train} train for ${pkg} package`;

  // Set the active train current position
  current = trainStations[train];

  // Move train to package pickup station
  moveTrain(train, pickupStation);

  // Move train to dropoff station
  moveTrain(train, dropoffStation);
}

logSeparator();

// Output the result
console.log(moves);
/*
  [
    'W=0, T=Q1, N1=B, P1=[], N2=A, P2=[]',
    'W=30, T=Q1, N1=A, P1=[K1], N2=B, P2=[]',
    'W=60, T=Q1, N1=B, P1=[], N2=C, P2=[K1]'
  ]
*/

// Return the entire journey time taken
function getSolutionTime() {
  const finalMove = [...moves].pop();
  const [W, , N1, , N2] = finalMove.split(",");
  const [, time] = W.split("=");
  const [, n1] = N1.split("=");
  const [, n2] = N2.split("=");
  return Number(time) + distances[`${n1}-${n2}`];
}

const solutionTime = getSolutionTime();

log`Solution time is: ${solutionTime}`;
// for input-basic.json: 70
// for input-advance.json: 250

// Solution benchmark
console.timeEnd("BENCH");
// for input-basic.json: ~4.00ms
// for input-advance.json: ~6.00ms
