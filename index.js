/* This is an attempt at a more optimal solution;
 *
 * ∞ While there are still deliveries to be made;
 * 1. Starts off by selecting the first delivery item
 * 2. Selects the closest train with enough capacity
 * 3. Move selected train towards the pickup station and then destination
 * 4. At each station along the way attempt to pick more packages if ?
 *    - train have enough capacity &
 *      // If train is on the way to pickup a package;
 *      // account for that package weight as well
 *    - package pickup is where train is &
 *    - package status is still waiting to be picked up &
 *    - package destination is the same direction train is going & // TODO:
 *    - package destination is before the train destination // TODO:
 * 5. At each station along the way attempt to drop off packages
 *    - remove the dropped packages from delivery list
 * */

import C from "chalk";
import { readFile, stat } from "node:fs/promises";
const { info } = console;

// /////////////////////////////////////////////////////////////////////// //
// NOTE: Runner Preparations ///////////////////////////////////////////// //

const sleep = (s = 1) => new Promise((r) => setTimeout(r, s * 1_000));

// DEBUG: Print a line separator filling terminal columns
const logSeparator = (c = "#") =>
  info(C.grey(Array.from({ length: process.stdout.columns }).fill(c).join("")));

// DEBUG: Logger tag function
function log(tpl, ...vars) {
  for (const [i, key] of tpl.entries()) {
    if (!key) continue;
    const value = JSON.stringify(vars[i]) ?? "";
    process.stdout.write(C.bold(key) + C.red.bold(value));
  }
  process.stdout.write("\n");
}

// DEBUG: Message headers
const ERR = C.black(" ") + C.bgRed.black.bold(" ERROR ");
const BUG = C.black(" ") + C.bgRed.black.bold(" BUG ");
const OK = C.black(" ") + C.bgGreen.black.bold(" OK ");

// DEBUG: Catch file not found
const catchFileNotFound = (path) =>
  stat(path).catch(() => {
    console.error(ERR, C.yellow(path), C.red("FILE DOESN'T EXIST"));
    process.exit(1);
  });

// Input path
const path = process.argv[2] ?? "assets/input-basic.json";
log`input path: ${path}`;

// DEBUG: Check if provided input path exists
catchFileNotFound(path);

// Load up the input
const input = JSON.parse(await readFile(path, { encoding: "utf8" }));

console.log(input);
/* input-edge.json
  {
    stations: [ 'A', 'B', 'C', 'D', 'E' ],
    edges: [ 'E1,A,B,30', 'E2,B,C,10', 'E3,C,D,40', 'E4,D,E,15' ],
    deliveries: [ 'K1,1,A,D', 'K2,2,C,E', 'K3,4,B,D' ],
    trains: [ 'Q1,4,C', 'Q2,5,B' ]
  }
*/

// Startup delay in seconds
const sleepFor = Number(process.argv[3] ?? 3);

log`\nstarting solution in ${sleepFor} seconds...`;

await sleep(sleepFor);

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
const DIRECTION = Object.freeze({
  LEFT: Symbol("LEFT"),
  RIGHT: Symbol("RIGHT"),
});

// Reduce input stations to produce station positions
const positions = Object.freeze(
  stations.reduce((acc, cur, i) => ({ ...acc, [cur]: i }), {})
);

console.log(positions);
// { A: 0, B: 1, C: 2, D: 3, E: 4 }

// Reduce input edges to produce connection maps and distances
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
// { A: ['B'], B: ['A', 'C'], C: ['B', 'D'], D: ['C', 'E'], E: ['D'] }

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

// Reduce input deliveries to produce delivery status map
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
// NOTE: each train has its own timeline, (trains can move at the same time)
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
  if (!pkg) return { weight: 0 };
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
    // Package pickup position
    const pkgPos = positions[from];

    // Reduce trains to pick the best train for the current package
    const { candidate } = trainNames.reduce(
      (_acc, _cur) => {
        // Train current position
        const trainPos = positions[trainStations[_cur]];

        // Distance between package and train
        const diff = getDiff(pkgPos, trainPos);

        // Enough capacity for package weight
        const enoughCapacity = getTrainRemainingCapacity(_cur) >= weight;

        // This distance is shorter than previous and have enough capacity
        if (diff <= _acc.distance && enoughCapacity) {
          _acc.candidate = _cur;
          _acc.distance = diff;
        }

        return _acc;
      },
      { candidate: getTrainForWeight(weight), distance: edges.length }
    );

    return { ...acc, [name]: candidate };
  }, {});

console.log(packagesTrainCandidates());
// { K1: 'Q2', K2: 'Q1', K3: 'Q2' }

// Attempt to pickup more packages along the way
const pickupPackages = (train, targetPkgName) => {
  // The package train is on the way to pickup
  const { weight: targetPkgWeight } = getPkgDetail(targetPkgName);
  // Train remaining capacity
  const remainingCapacity = getTrainRemainingCapacity(train);

  // PERF: Consider current train direction
  // const trainCurrentPos = positions[trainStations[train]];
  // const trainDestinationPos = positions[destination];

  // Select a package candidate for train
  const packageCandidate = deliveries.find((x) => {
    const { name, weight, from } = getPkgDetail(x);

    // PERF: Consider current train direction
    // const packageDestinationPos = positions[to];

    // If train is on the way to pickup a package: (targetPkg)
    // account for that package weight as well

    // Does it have enough remaining capacity?
    const enoughCapacity = remainingCapacity - targetPkgWeight >= weight;
    // Is it still at pickup?
    const atPickup = deliveryStatus[name] === STATUS.AT_PICKUP;
    // Is package pickup location where train is?
    const isHere = from === trainStations[train];

    // PERF: Consider current train direction
    // Is package destination on the same direction train is going?
    // const sameDirection = dir === DIRECTION.RIGHT ? packageDestinationPos > trainCurrentPos : packageDestinationPos < trainCurrentPos ;
    // Is package drop off before current destination
    // const dropoffIsBeforeCurrentDestination = dir === DIRECTION.RIGHT ? packageDestinationPos < trainDestinationPos : packageDestinationPos  > trainDestinationPos;

    return enoughCapacity && atPickup && isHere;
  });

  // We have a package candidate
  if (packageCandidate) {
    const [pkg] = packageCandidate.split(",");
    log`found package candidate: ${pkg} for ${train}`;
    loadPackage(train, pkg);
  }
};

// Return the immediate next possible move and direction
function getNext(train, to) {
  // Possible next moves
  const [next, alt] = connections[trainStations[train]];

  // Next is destination or There is no alternative
  if (next === to || !alt) {
    return [DIRECTION.LEFT, next];
  }

  // The alternative is the destination
  if (alt === to) {
    return [DIRECTION.RIGHT, alt];
  }

  // Go right
  if (positions[to] > positions[trainStations[train]]) {
    return [DIRECTION.RIGHT, alt];
  }

  // Go left
  return [DIRECTION.LEFT, next];
}

// ··· DRIVERS ··························································· //

logSeparator("_");

// debugger; // 

// Arbitrary limit to avoid infinite loops in case of a bug 
const DEBUG_ESCAPE_HATCH_LIMIT = 99;

// Move the train towards a destination ( ? -> F )
function moveTrain(train, to, targetPkg) {
  // Our local state
  let [direction, next] = getNext(train, to);

  // NOTE: DEBUG: emergency circuit breaker
  let DEBUG_ESCAPE_HATCH_COUNTER = 0;

  // Move until we've reached destinations
  while (trainStations[train] !== to) {
    // NOTE: DEBUG: Increment circuit breaker counter
    DEBUG_ESCAPE_HATCH_COUNTER++;

    // Attempt to pickup more package
    pickupPackages(train, targetPkg);

    // Filter packages that their pickup is here
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

    // Unload packages from train loads and deliveries
    dropPackages.forEach((x) => unloadPackage(train, x));

    // Append the output
    moves.push(
      [
        `W=${timeline[train]}`, // Time elapsed for train
        `T=${train}`, // Train name
        `N1=${trainStations[train]}`, // Start node (train current location)
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

    // NOTE: DEBUG: emergency circuit breaker
    // XXX: This should never happen
    if (DEBUG_ESCAPE_HATCH_COUNTER > DEBUG_ESCAPE_HATCH_LIMIT) {
      console.error(BUG, C.red("MOVE_TRAIN INFINITE LOOP BREAK"));
      process.exit(1);
    }
  }
}

// NOTE: DEBUG: emergency circuit breaker
let DEBUG_ESCAPE_HATCH_COUNTER = 0;

loadPackage("Q1", "K1");
loadPackage("Q1", "K2");
loadPackage("Q1", "K3");
// While there are still deliveries to be made
while (deliveries.length) {
  log`still got ${deliveries.length} deliveries to do`;

  // NOTE: DEBUG: emergency circuit breaker
  DEBUG_ESCAPE_HATCH_COUNTER++;
  // XXX: This should never happen
  if (DEBUG_ESCAPE_HATCH_COUNTER > DEBUG_ESCAPE_HATCH_LIMIT) {
    console.error(BUG, C.red("DELIVERY INFINITE LOOP BREAK"));
    process.exit(1);
  }

  // Pick the first package; we have to start somewhere!
  const [pick] = deliveries;
  const {
    name: pkg,
    from: pickupStation,
    to: dropoffStation,
  } = getPkgDetail(pick);

  // Check if the picked package status is at pickup
  if (deliveryStatus[pkg] === STATUS.AT_PICKUP) {
    // Pick the closest train to package with enough capacity
    const train = packagesTrainCandidates()[pkg];
    // Check if the package pickup is where train already is
    if (pickupStation === trainStations[train]) {
      log`package ${pkg} pickup is where train already is: ${trainStations[train]}`;
      // Load package onto train
      loadPackage(train, pkg);
    } else {
      log`move ${train} to pickup ${pkg} from ${pickupStation}`;
      // Move train to pickup package at pickup station
      moveTrain(train, pickupStation, pkg);
    }
  }

  // Check if the picked package status is in-flight
  if (deliveryStatus[pkg] === STATUS.IN_FLIGHT) {
    // The train that is holding the package
    const train = trainNames.reduce(
      (acc, cur) => (trainLoads[cur].includes(pkg) ? cur : acc),
      null
    );

    // This train might be holding multiple packages
    const buckets = trainLoads[train].reduce(
      (acc, cur) => {
        return acc;
      },
      [[], []]
    );
    console.log("buckets:", buckets);

    // Find which direction has the most dropoffs

    // Find the furthest package in that direction

    process.exit();
    log`move ${train} to dropoff ${pkg} at ${dropoffStation}`;

    // DEBUG: This should never happen
    if (!train) {
      console.error(BUG, C.red("NO TRAIN IS HOLDING"), C.cyan(pkg));
      process.exit(1);
    }

    // Move train to drop off package at dropoff station
    moveTrain(train, dropoffStation);
  }
}

logSeparator();

info(OK, C.green.bold("All packages have been delivered."));

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

// Return the entire journey time elapsed; taken from timeline
// when we have multiple trains, we have multiple timelines
// (trains can move at the same time)
// the highest of which is our total solution time
const solutionTime = trainNames.reduce(
  (acc, cur) => (timeline[cur] > acc ? timeline[cur] : acc),
  0
);

info(C.italic.grey("(Time elapsed + the final leg of journey duration)"));

log`Solution time is: ${solutionTime}`;
// for input-basic.json:   70   // 70  on old implementation
// for input-edge.json:    110  // 235 on old implementation
// for input-advance.json: 140  // 320 on old implementation

// Solution benchmark
console.timeEnd("BENCH");
// BENCH: ~4.00ms
