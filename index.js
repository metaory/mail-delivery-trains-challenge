import { readFileSync } from "node:fs";

console.clear();

const data = JSON.parse(readFileSync("./input.json", { encoding: "utf8" }));
console.log("data:", data);

const {
  // stations, // NOTE: we dont need this!
  edges,
  deliveries,
  trains: [TRAIN], // NOTE: To simplify; lets imagine there is only one train!
} = data;

// NOTE: we'll also ignore weight constraint entirely as well!

/*
  {
    "stations": ["A", "B", "C"],
    "edges": ["E1, A, B, 30", "E2, B, C, 10"],
    "deliveries": ["K1, 5, A, C"],
    "trains": ["Q1, 6, B"]
  }
*/

const { connections, distances } = edges.reduce(
  (acc, cur) => {
    const [, from, to, distance] = cur.split(",");
    // XXX: we are overwriting key with same node with ones that have multiple edges!!
    acc.connections[from] = to;
    acc.connections[to] = from;
    acc.distances[`${from}-${to}`] = +distance;
    acc.distances[`${to}-${from}`] = +distance;
    return acc;
  },
  { connections: {}, distances: {} }
);

console.log("connections:", connections);
console.log("distances:", distances);

const [train, capacity, initialLocation] = TRAIN.split(",");

const moves = [];
let time = 0;
let trainLocation = initialLocation;

function moveTrain(from, to, pkg = null) {
  let current = from;
  let next = connections[trainLocation];
  console.log(
    `move train(@${trainLocation}) from ${from} to ${to} with ${pkg}`
  );

  while (current !== to) {
    moves.push(`W=${time}, T=${train}, N1=${current}, N2=${next}, P2=[${pkg}]`);
    trainLocation = next;
    time += distances[`${current}-${next}`];
    current = next;
    next = connections[next];
    console.log("trainLocation:", trainLocation);
    process.exit();
  }
}

for (const delivery of deliveries) {
  const [pkg, weight, src, dst] = delivery.split(",");
  // move train to delivery pickup location
  moveTrain(trainLocation, src);

  // move train to destination
  // moveTrain(trainLocation, dst, pkg);
}

console.log("moves:", moves);
