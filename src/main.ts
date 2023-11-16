import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
// import Board from "./board";
import "./leafletWorkaround";

interface Cell {
  readonly i: number;
  readonly j: number;
}

interface Coin {
  cell: Cell;
  serial: number;
}

interface Momento<T> {
  toMomento(): T;
  fromMomento(momento: T): void;
}

class Geocache implements Momento<string> {
  i: number;
  j: number;
  coins: Coin[];
  constructor(cell: Cell) {
    this.i = cell.i;
    this.j = cell.j;
    this.coins = [];

    const numInitialCoins = Math.floor(
      luck([cell.i, cell.j, "initialValue"].toString()) * 100
    );
    for (let x = 0; x < numInitialCoins; x++) {
      this.coins.push({ cell: { i: this.i, j: this.j }, serial: x });
    }
  }
  toMomento(): string {
    return this.coins
      .map((coin) => [coin.cell.i, coin.cell.j, coin.serial].toString())
      .join(";");
  }
  fromMomento(momento: string): void {
    this.coins.length = 0;
    const newCoins = momento.split(";");
    for (const x of newCoins) {
      const coinInfo = x.split(",");
      this.coins.push({
        cell: { i: parseInt(coinInfo[0]), j: parseInt(coinInfo[1]) },
        serial: parseInt(coinInfo[2]),
      });
    }
  }
}

const MERRILL_CLASSROOM = leaflet.latLng({
  lat: 36.9995,
  lng: -122.0533,
});

const knownCells = new Map<string, string>();

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 6;
const PIT_SPAWN_PROBABILITY = 0.1;

const mapContainer = document.querySelector<HTMLElement>("#map")!;

const map = leaflet.map(mapContainer, {
  center: MERRILL_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

const playerMarker = leaflet.marker(MERRILL_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  navigator.geolocation.watchPosition((position) => {
    playerMarker.setLatLng(
      leaflet.latLng(position.coords.latitude, position.coords.longitude)
    );
    map.setView(playerMarker.getLatLng());
  });
});

let wallet: Coin[] = [];
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No coins yet...";
const shownTiles: leaflet.Layer[] = [];

function makePit(i: number, j: number) {
  const bounds = leaflet.latLngBounds([
    [
      MERRILL_CLASSROOM.lat + i * TILE_DEGREES,
      MERRILL_CLASSROOM.lng + j * TILE_DEGREES,
    ],
    [
      MERRILL_CLASSROOM.lat + (i + 1) * TILE_DEGREES,
      MERRILL_CLASSROOM.lng + (j + 1) * TILE_DEGREES,
    ],
  ]);

  const pit = leaflet.rectangle(bounds) as leaflet.Layer;

  let lat = Math.round(MERRILL_CLASSROOM.lat / TILE_DEGREES + i);
  let lng = Math.round(MERRILL_CLASSROOM.lng / TILE_DEGREES + j);
  const key = [lat, lng].toString();

  let cache = new Geocache({ i: lat, j: lng });
  let cMom = knownCells.get(key);
  if (typeof cMom == "string") {
    cache.fromMomento(cMom);
  }

  pit.bindPopup(() => {
    const container = document.createElement("div");
    container.innerHTML = `
                <div>There is a pit here at "${lat},${lng}". It has <span id="value">${
      cache!.coins.length
    }</span> coins.</div>
                <button id="collect">Collect</button>
                <button id="deposit">Deposit</button>
                `;
    const collect = container.querySelector<HTMLButtonElement>("#collect")!;
    collect.addEventListener("click", () => {
      if (cache!.coins.length > 0) {
        wallet.push(cache!.coins.shift()!);
        container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          cache!.coins.length.toString();
        const len = wallet.length;
        statusPanel.innerHTML = `${len} coins (Last coin: ${
          wallet[len - 1].cell.i
        }:${wallet[len - 1].cell.j}#${wallet[len - 1].serial})`;
        knownCells.set(key, cache.toMomento());
      }
    });
    const deposit = container.querySelector<HTMLButtonElement>("#deposit")!;
    deposit.addEventListener("click", () => {
      if (wallet.length > 0) {
        cache!.coins.unshift(wallet.pop()!);
        container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          cache!.coins.length.toString();
        const len = wallet.length;
        if (len > 0) {
          statusPanel.innerHTML = `${len} coins (Last coin: ${
            wallet[len - 1].cell.i
          }:${wallet[len - 1].cell.j}#${wallet[len - 1].serial})`;
        } else {
          statusPanel.innerHTML = `${len} coins`;
        }
        knownCells.set(key, cache.toMomento());
      }
    });
    return container;
  });
  pit.addTo(map);
  shownTiles.push(pit);
}

function redrawMap() {
  playerMarker.setLatLng(
    leaflet.latLng(MERRILL_CLASSROOM.lat, MERRILL_CLASSROOM.lng)
  );
  map.setView(playerMarker.getLatLng());

  for (const x of shownTiles) {
    x.remove();
  }

  for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
      const Lat = Math.round(i + MERRILL_CLASSROOM.lat / TILE_DEGREES);
      const Lng = Math.round(j + MERRILL_CLASSROOM.lng / TILE_DEGREES);
      if (luck([Lat, Lng].toString()) < PIT_SPAWN_PROBABILITY) {
        makePit(i, j);
      }
    }
  }
}

for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    const Lat = Math.round(i + MERRILL_CLASSROOM.lat / TILE_DEGREES);
    const Lng = Math.round(j + MERRILL_CLASSROOM.lng / TILE_DEGREES);
    if (luck([Lat, Lng].toString()) < PIT_SPAWN_PROBABILITY) {
      makePit(i, j);
    }
  }
}

const northButton = document.querySelector<HTMLButtonElement>("#north");
const southButton = document.querySelector<HTMLButtonElement>("#south");
const westButton = document.querySelector<HTMLButtonElement>("#west");
const eastButton = document.querySelector<HTMLButtonElement>("#east");

northButton?.addEventListener("click", () => {
  MERRILL_CLASSROOM.lat += 1e-4;
  redrawMap();
});
southButton?.addEventListener("click", () => {
  MERRILL_CLASSROOM.lat -= 1e-4;
  redrawMap();
});
westButton?.addEventListener("click", () => {
  MERRILL_CLASSROOM.lng -= 1e-4;
  redrawMap();
});
eastButton?.addEventListener("click", () => {
  MERRILL_CLASSROOM.lng += 1e-4;
  redrawMap();
});
