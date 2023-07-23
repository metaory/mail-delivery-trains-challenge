/* This is an attempt at a more optimal solution;
 *
 * ∞ While there are still deliveries to be made;
 * 1. Starts off by selecting the first delivery item
 * 2. Selects the closest train with enough capacity
 * 3. Move selected train towards the pickup station and then destination
 * 4. At each station along the way it attempts to pick more packages if ?
 *    - train have enough capacity &
 *    - package pickup is where train is &
 *    - package status is still waiting to be picked up &
 *    - package destination is in the same direction train is going & // TODO:
 *    - package destination is before the current train destination // TODO:
 * 5. At each station along the way it drop off packages
 *      remove the dropped packages from delivery list
 * */

import C from "chalk";
import { readFile, stat } from "node:fs/promises";

console.clear();

// /////////////////////////////////////////////////////////////////////// //
// NOTE: Runner Preparations ///////////////////////////////////////////// //

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
    console.error(C.yellow(path), C.red("doesn't exist"));
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
/* input-edge.json
  {
    stations: [ 'A', 'B', 'C', 'D', 'E' ],
    edges: [ 'E1,A,B,30', 'E2,B,C,10', 'E3,C,D,40', 'E4,D,E,15' ],
    deliveries: [ 'K1,1,A,D', 'K2,2,C,E', 'K3,4,B,D' ],
    trains: [ 'Q1,4,C', 'Q2,5,B' ]
  }
*/

// /////////////////////////////////////////////////////////////////////// //
// NOTE: Begin Solution ////////////////////////////////////////////////// //

logSeparator("=");

console.time("BENCH");

// Destructure input detail
const { stations, edges, deliveries, trains } = input;

// ··· FROZEN STRUCTURES ················································· //

// Delivery status enums
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
  stations.reduce((acc, cur, i) => ({ ...acc, [cur]: i }), {})
);

console.log(positions);
// { A: 0, B: 1, C: 2, D: 3, E: 4 }

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
//{ A: ['B'], B: ['A', 'C'], C: ['B', 'D'], D: ['C', 'E'], E: ['D'] }

console.log(distances);
// { 'A-B': 30, 'B-A': 30, 'B-C': 10, 'C-B': 10, 'C-D': 40, 'D-C': 40, 'D-E': 15, 'E-D': 15 }

// Reduce input trains to produce an array of train names
const trainNames = Object.freeze(
  trains.reduce((acc, cur) => {
    const [name] = cur.split(",");
    return [...acc, name];
  }, [])
);

console.log(trainNames);
// ['Q1', 'Q2']

// ··· STATE STRUCTURES ·················································· //

// Outcome moves
const moves = [];

// Reduce input deliveries to produce delivery status
const deliveryStatus = deliveries.reduce((acc, cur) => {
  const [pkg] = cur.split(",");
  return { ...acc, [pkg]: STATUS.AT_PICKUP };
}, {});

console.log(deliveryStatus);
// { K1: Symbol(AT_PICKUP), K2: Symbol(AT_PICKUP), K3: Symbol(AT_PICKUP) }

// Reduce input trains to produce train stations, capacities, loads
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
// { Q1: 'C', Q2: 'B' }

console.log(trainCapacities);
// { Q1: 4, Q2: 5 }

console.log(trainLoads);
// { Q1: [], Q2: [] }

// List of logged picked up packages
// this is to avoid logging the same package multiple times in outcome moves
const logged = [];

// Train timeline
// NOTE: each train have its own timeline, (trains can move at the same time)
const timeline = trainNames.reduce((acc, cur) => ({ ...acc, [cur]: 0 }), {});

console.log(timeline);
// { Q1: 0, Q2: 0 }

// ··· METHODS ··························································· //

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
  // Remove package from delivery list
  const pkgIndex = deliveries.findIndex((x) => {
    const [name] = x.split(",");
    return name === pkg;
  });
  deliveries.splice(pkgIndex, 1);
  // Mark package delivery status to delivered
  deliveryStatus[pkg] = STATUS.DELIVERED;
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
const getTrainRemainingCapacity = (train) =>
  // Train full capacity
  trainCapacities[train] -
  // Train current total load
  trainLoads[train].reduce((acc, cur) => acc + getPkgDetail(cur).weight, 0);

// Return a train with enough capacity
const getTrainForWeight = (weight) =>
  trainNames.find((train) => trainCapacities[train] >= weight);

// Return positive diff between two numbers
const getDiff = (a, b) => (a > b ? a - b : b - a);

// Reduce to produce a map of closest train for each package
const packagesTrainCandidates = () =>
  deliveries.reduce((acc, cur) => {
    const { name, weight, from } = getPkgDetail(cur);
    const pkgPos = positions[from];

    // Reduce trains to pick the closest to current package
    const { candidate } = trainNames.reduce(
      (_acc, _cur) => {
        const trainPos = positions[trainStations[_cur]];

        // Get the distance between package and train
        const diff = getDiff(pkgPos, trainPos);

        // This distance is shorter than previous
        if (diff <= _acc.distance) {
          _acc.candidate = _cur;
          _acc.distance = diff;
        }

        return _acc;
      },
      { candidate: null, distance: edges.length }
    );

    // Get train capacity for the candidate train
    const candidateCapacity = getTrainRemainingCapacity(candidate);

    // Package weight is more than candidate train capacity
    if (weight > candidateCapacity) {
      // Find train with enough capacity regardless of its distance
      acc[name] = getTrainForWeight(weight);
    } else {
      // We can use our candidate train
      acc[name] = candidate;
    }

    return acc;
  }, {});

// Attempt to pickup packages along the way
const pickupPackages = (train, dir, destination) => {
  log`if train ${train} moving ${dir.toString()} to ${destination} can load up new package`;

  // Get train remaining capacity
  const remainingCapacity = getTrainRemainingCapacity(train);

  // PERF: Consider current train direction
  // const trainCurrentPos = positions[trainStations[train]];
  // const trainDestinationPos = positions[destination];

  // Select a package candidate for train
  const packageCandidate = deliveries.find((x) => {
    const { name, weight, from } = getPkgDetail(x);

    // PERF: Consider current train direction
    // const packageDestinationPos = positions[to];

    // Does it have enough remaining capacity?
    const enoughCapacity = remainingCapacity >= weight;
    // Is it still at pickup?
    const atPickup = deliveryStatus[name] === STATUS.AT_PICKUP;
    // Is package pickup location is where we are?
    const isHere = from === trainStations[train];

    // PERF: Consider current train direction
    // Is package destination on the same direction train is going?
    // const sameDirection = dir === DIRECTIONS.RIGHT ? packageDestinationPos > trainCurrentPos : packageDestinationPos < trainCurrentPos ;
    // check if package drop off is before current destination
    // const dropoffIsBeforeCurrentDestination = dir === DIRECTIONS.RIGHT ? packageDestinationPos < trainDestinationPos : packageDestinationPos  > trainDestinationPos;

    return enoughCapacity && atPickup && isHere;
  });

  // We found a package candidate
  if (packageCandidate) {
    const [pkg] = packageCandidate.split(",");
    log`found possible package candidate: ${pkg} for ${train}`;
    loadPackage(train, pkg);
  }
};

// Return the immediate next possible move and direction
function getNext(train, to) {
  // Possible next moves
  const [next, alt] = connections[trainStations[train]];

  // Next is destination or There is no alternative
  if (next === to || !alt) {
    return [DIRECTIONS.LEFT, next];
  }

  // The alternative is the destination
  if (alt === to) {
    return [DIRECTIONS.RIGHT, alt];
  }

  // Go right
  if (positions[to] > positions[trainStations[train]]) {
    return [DIRECTIONS.RIGHT, alt];
  }

  // Go left
  return [DIRECTIONS.LEFT, next];
}

// ··· DRIVERS ··························································· //

logSeparator("_");

// debugger; // 

// Arbitrary limit to avoid infinite loops in case of a bug 
const DEBUG_ESCAPE_HATCH_LIMIT = 20;

// Move the train towards a destination ( ? -> F )
function moveTrain(train, to) {
  log`move ${train} from ${trainStations[train]} to ${to}`;

  // Our local state
  let [direction, next] = getNext(train, to);

  // NOTE: Debug: emergency circuit breaker
  let DEBUG_ESCAPE_HATCH_COUNTER = 0;

  // Check if train can pickup package before moving
  pickupPackages(train, direction, to);

  // Move until we've reached destinations
  while (trainStations[train] !== to) {
    // NOTE: Debug: Increment circuit breaker counter
    DEBUG_ESCAPE_HATCH_COUNTER++;

    // Attempt to load more packages on train
    pickupPackages(train, direction, to);

    // Filter packages that their pickup is current
    const pickPackages = trainLoads[train].filter(
      (x) =>
        getPkgDetail(x).from === trainStations[train] &&
        logged.includes(x) === false
    );

    // Add to logged packages
    pickPackages.forEach((x) => logged.push(x));

    // Filter packages that their drop off is next
    const dropPackages = trainLoads[train].filter(
      (x) => getPkgDetail(x).to === next
    );

    // Remove package from train loads and deliveries
    dropPackages.forEach((x) => unloadPackage(train, x));

    // Append the output
    moves.push(
      [
        `W=${timeline[train]}`, // Time elapsed for train
        `T=${train}`, // Train name
        `N1=${trainStations[train]}`, // Start node (current train location)
        `P1=[${pickPackages}]`, // Pick-up packages
        `N2=${next}`, // End node
        `P2=[${dropPackages}]`, // Drop-off packages
        `L=[${trainLoads[train]}]`, // Train load
      ].join(", ")
    );

    // Update state
    timeline[train] += distances[`${trainStations[train]}-${next}`];
    trainStations[train] = next;
    direction = getNext(train, to)[0];
    next = getNext(train, to)[1];

    // NOTE: Debug: emergency circuit breaker
    // XXX: This should never happen
    if (DEBUG_ESCAPE_HATCH_COUNTER > DEBUG_ESCAPE_HATCH_LIMIT) {
      console.error(C.red("MOVE_TRAIN INFINITE LOOP BREAK"));
      console.info("incomplete moves:", moves);
      console.error(
        DEBUG_ESCAPE_HATCH_COUNTER,
        C.red.bold("REACHED ESCAPE HATCH LIMIT!"),
        "exiting..."
      );
      process.exit(1);
    }

    logSeparator("-");
  }
}

// NOTE: Debug: emergency circuit breaker
let DEBUG_ESCAPE_HATCH_COUNTER = 0;

// While there are still deliveries to be made
while (deliveries.length) {
  log`still got ${deliveries.length} deliveries to do`;

  // NOTE: Debug: emergency circuit breaker
  DEBUG_ESCAPE_HATCH_COUNTER++;
  // XXX: This should never happen
  if (DEBUG_ESCAPE_HATCH_COUNTER > DEBUG_ESCAPE_HATCH_LIMIT) {
    console.info(C.red("DELIVERY INFINITE LOOP BREAK"));
    console.info("incomplete moves:", moves);
    console.error(
      DEBUG_ESCAPE_HATCH_COUNTER,
      C.red.bold("REACHED ESCAPE HATCH LIMIT!"),
      "exiting..."
    );
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

  // XXX: This should never happen
  if (!train) {
    console.error(C.red(`There is no train for package ${pkg}`), "exiting...");
    process.exit(1);
  }

  log`picked ${train} train for ${pkg} package`;

  // Check if the picked package is at pickup
  // the picked package might already be in-flight on another train
  if (deliveryStatus[pkg] === STATUS.AT_PICKUP) {
    // Move train to package pickup station
    moveTrain(train, pickupStation);
  }

  // Move train to drop off station
  moveTrain(train, dropoffStation);
}

logSeparator();

// ··· RESULTS ··························································· //

// Output the outcome moves
console.log(moves);
/* input-edge.json
  [
    'W=0, T=Q2, N1=B, P1=[K3], N2=A, P2=[], L=[K3]',
    'W=30, T=Q2, N1=A, P1=[K1], N2=B, P2=[], L=[K3,K1]',
    'W=60, T=Q2, N1=B, P1=[], N2=C, P2=[], L=[K3,K1]',
    'W=70, T=Q2, N1=C, P1=[], N2=D, P2=[K3,K1], L=[]',
    'W=0, T=Q1, N1=C, P1=[K2], N2=D, P2=[], L=[K2]',
    'W=40, T=Q1, N1=D, P1=[], N2=E, P2=[K2], L=[]'
  ]
*/

// Return the entire journey time taken from timeline
// when we have multiple trains, we have multiple timelines
// (trains can move at the same time)
// the highest of which is our total solution time
const solutionTime = Object.keys(timeline).reduce(
  (acc, cur) => (timeline[cur] > acc ? timeline[cur] : acc),
  0
);

log`(Time elapsed + the final leg of journey duration)`;
log`Solution time is: ${solutionTime}`;
// for input-basic.json: 70
// for input-edge.json: 110
// for input-advance.json: 140

// Solution benchmark
console.timeEnd("BENCH");
// for input-basic.json: ~4.00ms
// for input-edge.json: ~6.00ms
// for input-advance.json: ~6.00ms
