import C from "chalk";
import { readFile, stat } from "node:fs/promises";

console.clear();

// ///////////////////////////////////////////////////////////////////////// //
// NOTE: Runner preprations //////////////////////////////////////////////// //

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

// ///////////////////////////////////////////////////////////////////////// //
// NOTE: Begin solution //////////////////////////////////////////////////// //

logSeparator("=");

console.time("BENCH");

// Destructure input detail
const { stations, edges, deliveries, trains } = input;

// Delivery statuses
const STATUS = {
  AT_PICKUP: "AT_PICKUP",
  IN_FLIGHT: "IN_FLIGHT",
  DELIVERED: "DELIVERED",
};

// Reduce input deliveries to produce delivery status
const deliveryStatus = deliveries.reduce((acc, cur) => {
  const [pkg] = cur.split(",");
  acc[pkg] = STATUS.AT_PICKUP;
  return acc;
}, {});

console.log(deliveryStatus);
// { 'K1': 'AT_PICKUP' }

// Update a package delivery status
const updateDeliveryStatus = (pkg, status) => {
  // This should never happen
  if (status in STATUS === false) {
    log`provided ${status} doesnt exist on STATUS, exiting...`;
    process.exit(1);
  }
  deliveryStatus[pkg] = status;
};

// Reduce to produce trains current load
const trainLoads = trains.reduce((acc, cur) => {
  const [trainName] = cur.split(",");
  acc[trainName] = [];
  return acc;
}, {});

console.log(trainLoads);
// { Q1: [] }

// Load a package onto a train
const loadPackage = (train, pkg) => {
  if (!trainLoads[train].includes(pkg)) {
    trainLoads[train].push(pkg);
    updateDeliveryStatus(pkg, STATUS.IN_FLIGHT);
  }
};

// Unload a package from a train
const unloadPackage = (train, pkg) => {
  if (trainLoads[train].includes(pkg)) {
    trainLoads[train].pop();
    updateDeliveryStatus(pkg, STATUS.DELIVERED);
  }
};

// Reduce input stations to produce positions
const positions = stations.reduce((acc, cur, i) => {
  acc[cur] = i;
  return acc;
}, {});

console.log(positions);
// { A: 0, B: 1, C: 2, D: 3 }

// Reduce input edges to produce connection-map and distances
const { connections, distances } = edges.reduce(
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
);

console.log(connections);
//{ A: [ 'B' ], B: [ 'A', 'C' ], C: [ 'B', 'D' ], D: [ 'C' ] }

console.log(distances);
// { 'A-B': 30, 'B-A': 30, 'B-C': 10, 'C-B': 10, 'C-D': 40, 'D-C': 40 }

// Reduce to produce train positions
const trainPositions = trains.reduce((acc, cur) => {
  const [train, , station] = cur.split(",");
  acc[train] = station;
  return acc;
}, {});

console.log(trainPositions);
// { Q1: 'B', Q2: 'A' }

// Return package detail
const getPkgDetail = (pkgName) => {
  const pkg = deliveries.find((x) => {
    const [name] = x.split(",");
    return name === pkgName;
  });
  const [name, weight, from, to] = pkg.split(",");
  return { name, weight, from, to };
};

// Return train capacity
const getTrainCapacity = (trainName) => {
  const train = trains.find((x) => {
    const [name] = x.split(",");
    return name === trainName;
  });
  const [, capacity] = train.split(",");
  return +capacity;
};

// Return train remaining capacity
const getTrainRemainingCapacity = (trainName) =>
  getTrainCapacity(trainName) -
  trainLoads[trainName].reduce((acc, cur) => acc + getPkgDetail(cur).weight, 0);

// Returns a train with enough capacity
const getTrain = (weight) =>
  Object.keys(trainLoads).find((train) => getTrainCapacity(train) >= weight);

// Reduce to produce a map of closest train for each package
const packagesTrainCandidates = () =>
  deliveries.reduce((acc, cur) => {
    const [pkg, weight, pickupStation] = cur.split(",");
    const pkgPos = positions[pickupStation];

    // Reduce trains to pick the closest to current package
    const closestTrain = Object.keys(trainPositions).reduce(
      (_acc, _cur) => {
        const trainStation = trainPositions[_cur];
        const trainPos = positions[trainStation];

        let diff;

        if (pkgPos > trainPos) {
          diff = pkgPos - trainPos;
        } else {
          diff = trainPos - pkgPos;
        }

        if (diff < _acc.distance) {
          _acc.candidate = _cur;
          _acc.distance = diff;
        }
        return _acc;
      },
      { candidate: null, distance: edges.length }
    );

    const { candidate } = closestTrain;
    const candidateCapacity = getTrainCapacity(candidate);

    if (weight > candidateCapacity) {
      // Find train with enough capacity regardless of its distance
      acc[pkg] = getTrain(weight);
    } else {
      acc[pkg] = candidate;
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

// Return the immediate next possible move
const getNext = (to) => {
  // Possible next moves
  const [next, alt] = connections[current];

  // Next is destination or There is no alteranative
  if (next === to || !alt) {
    return next;
  }

  // The alteranative is the destination
  if (alt === to) {
    return alt;
  }

  // Go right
  if (positions[to] > positions[current]) {
    return alt;
  }

  // Go left
  return next;
};

// Attempt to pickup packages along the way
const pickupPackages = (train) => {
  log`checking if ${train} can load up new package!`;

  // Get train remaining capacity
  const remainingCapacity = getTrainRemainingCapacity(train);
  log`train ${train} currently have ${remainingCapacity} capacity`;

  // Select a package candidate for train
  const packageCandidate = deliveries.find((x) => {
    const [pkg, weight, from] = x.split(",");

    // Does it have enough remaining capacity?
    const enoughCapacity = remainingCapacity >= weight;
    // Is it still at pickup?
    const atPickup = deliveryStatus[pkg] === STATUS.AT_PICKUP;
    // Is package pickup location is where we are?
    const isHere = from === current;

    return enoughCapacity && atPickup && isHere;
  });

  if (packageCandidate) {
    const [pkg] = packageCandidate.split(",");
    log`found possible package candidate: ${pkg}`;
    loadPackage(train, pkg);
  }
};

// Move the train towards a destination ( ? -> F )
function moveTrain(train, to) {
  // let packages = [pkg];
  log`move ${train} from ${current} to ${to}`;

  // Our local state
  let next = getNext(to);

  // NOTE: Debug: emergency circuit breaker
  let DEBUG_ESCAPE_HATCH_COUNTER = 0;

  // Move until we've reached destinations
  while (current !== to) {
    // NOTE: Debug: Increment circuit breaker counter
    DEBUG_ESCAPE_HATCH_COUNTER++;

    // Attempt to load more packages on train
    pickupPackages(train);

    // Filter packages that their pickup is current
    const pickPackages = trainLoads[train].filter(
      (x) => getPkgDetail(x).from === current
    );
    // Filter packages that their dropoff is next
    const dropPackages = trainLoads[train].filter(
      (x) => getPkgDetail(x).to === next
    );

    // Append the output
    moves.push(
      `W=${time}, T=${train}, N1=${current}, P1=[${pickPackages}], N2=${next}, P2=[${dropPackages}]`
    );

    // Update state
    time += distances[`${current}-${next}`];
    current = next;
    next = getNext(to);
    trainPositions[train] = current;

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

  // Pick the last package
  const pick = deliveries[deliveries.length - 1];
  const [pkg, , pickupStation, dropoffStation] = pick.split(",");

  // Pick the closest train to package with enough capacity
  const train = packagesTrainCandidates()[pkg];

  // This should never happen
  if (!train) {
    console.error(C.red(`There is no train for package ${pkg}`), "exiting...");
    process.exit(1);
  }

  log`picked ${train} train for ${pkg} package`;

  // Set the active train current position
  current = trainPositions[train];

  // Move train to package pickup station
  moveTrain(train, pickupStation);

  // Add package to train loads
  loadPackage(train, pkg);

  // Move train to dropoff station
  moveTrain(train, dropoffStation);

  // Remove package from train loads
  unloadPackage(train, pkg);

  // Remove package from our list
  deliveries.pop();
}

logSeparator();

// Output the result
console.log(moves);
/*
  [
    'W=0, T=Q1, N1=B, N2=A, P2=[null]',
    'W=30, T=Q1, N1=A, N2=B, P2=[K1]',
    'W=60, T=Q1, N1=B, N2=C, P2=[K1]'
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

// Solution benchmark
console.timeEnd("BENCH");
// BENCH: ~2.00ms
