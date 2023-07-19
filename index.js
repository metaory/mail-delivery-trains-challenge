import C from "chalk";
import { readFile, stat } from "node:fs/promises";

console.clear();

// ////////////////////////////////////////////////////////////////////////// //
// NOTE: Runner preprations ///////////////////////////////////////////////// //

// Debug: print a line separator filling terminal columns
const logSeparator = (char = "#") =>
  console.log(
    Array.from({ length: process.stdout.columns }).fill(char).join("")
  );

// Debug: logger tag function
function log(tpl, ...vars) {
  for (const [i, key] of tpl.entries()) {
    if (!key) continue;
    process.stdout.write(key + C.red.bold(vars[i] ?? ""));
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

// ////////////////////////////////////////////////////////////////////////// //
// NOTE: Begin solution ///////////////////////////////////////////////////// //

console.time("BENCH");

// Destructure input detail
const { stations, edges, deliveries, trains } = input;

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

  // Source and destination positions
  const currentPosition = positions[current];
  const destinationPosition = positions[to];

  log`current position is: ${currentPosition}`;
  log`destination position is: ${destinationPosition}`;

  // Go right
  if (destinationPosition > currentPosition) {
    return alt;
  }

  // Go left
  return next;
};

// Move the train towards a destination ( ? -> F )
function moveTrain(train, to, pkg = null) {
  log`move ${train} from ${current} to ${to} with ${pkg}`;

  // Our local state
  let next = getNext(to);

  // NOTE: Debug: emergency circuit breaker
  let DEBUG_ESCAPE_HATCH_COUNTER = 0;

  // Move until we've reached destinations
  while (current !== to) {
    // NOTE: Debug: Increment circuit breaker counter
    DEBUG_ESCAPE_HATCH_COUNTER++;

    log`next: ${next}`;

    // Append the output
    moves.push(`W=${time}, T=${train}, N1=${current}, N2=${next}, P2=[${pkg}]`);

    // Update local state
    time += distances[`${current}-${next}`];
    current = next;
    next = getNext(to);

    log`current: ${current}`;

    // NOTE: Debug: emergency circuit breaker
    if (DEBUG_ESCAPE_HATCH_COUNTER > DEBUG_ESCAPE_HATCH_LIMIT) {
      console.info(C.cyan("There cant be more moves than possible edges"));
      console.error(C.red.bold("REACHED ESCAPE HATCH LIMIT!"), "exiting...");
      process.exit(1);
    }
    logSeparator("-");
  }
}

// Iterate over deliveries
for (const delivery of deliveries) {
  // Destructure delivery detail
  const [pkg, weight, src, dst] = delivery.split(",");

  // Pick a train with enough capacity
  const train = trains.find((train) => {
    const [, capacity] = train.split(",");
    return capacity >= weight;
  });

  // Catch when there is no train to hold the weight
  if (!train) {
    console.error(C.red.bold("FOUND NO TRAIN WITH ENOUGH CAPACITY!"));
    process.exit(1);
  }

  // Destructure train detail
  const [trainName, , location] = train.split(",");

  // Set current location
  current = location;

  // Move train to delivery pickup location
  moveTrain(trainName, src);

  // Move train to destination
  moveTrain(trainName, dst, pkg);
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
  const [W, , N1, N2] = finalMove.split(",");
  const [, time] = W.split("=");
  const [, n1] = N1.split("=");
  const [, n2] = N2.split("=");

  return Number(time) + distances[`${n1}-${n2}`];
}

const solutionTime = getSolutionTime();

log`Solution time is: ${solutionTime}`;
// Solution time is: 70

// Solution benchmark
console.timeEnd("BENCH");
// BENCH: ~2.00ms

// *********************************** //
// NOTE: This is not an optimal solution;
// it does not cater the possibility that a train can hold multiple packages
// so that the optimal route might be to make multiple pickups before delivering
