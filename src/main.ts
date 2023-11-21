import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
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
    if (momento) {
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
}

const CUR_POS = leaflet.latLng({
  lat: 36.9995,
  lng: -122.0533,
});

const storedPos = localStorage.getItem("curPos");
if (storedPos != null) {
  const pos = storedPos.split(",");
  CUR_POS.lat = parseFloat(pos[0]);
  CUR_POS.lng = parseFloat(pos[1]);
}

const knownCells = new Map<string, string>();
const storedCells = localStorage.getItem("knownCells");
if (storedCells != null) {
  const cells = storedCells.split(" and ");
  for (const entry of cells) {
    const mapout = entry.split(" has ");
    knownCells.set(mapout[0], mapout[1]);
  }
} else {
}

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 5;
const PIT_SPAWN_PROBABILITY = 0.1;

const mapContainer = document.querySelector<HTMLElement>("#map")!;

const map = leaflet.map(mapContainer, {
  center: CUR_POS,
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

const playerMarker = leaflet.marker(CUR_POS);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

let wallet: Coin[] = [];
const locWallet = localStorage.getItem("wallet");
if (locWallet != null) {
  const coins = locWallet.split(";");
  for (const coin of coins) {
    const coinInfo = coin.split(",");
    wallet.push({
      cell: { i: parseInt(coinInfo[0]), j: parseInt(coinInfo[1]) },
      serial: parseInt(coinInfo[2]),
    });
  }
}

let travelHist: leaflet.LatLng[] = [];
const locHist = localStorage.getItem("travelHist");
if (locHist != null) {
  const hists = locHist.split(";");
  for (const coord of hists) {
    const co = coord.split(",");
    travelHist.push(leaflet.latLng(parseFloat(co[0]), parseFloat(co[1])));
  }
} else {
  travelHist.push(leaflet.latLng(CUR_POS.lat, CUR_POS.lng));
}

let travelLine = leaflet.polyline(travelHist, { color: "red" });
travelLine.addTo(map);

const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No coins yet...";
if (wallet.length > 0) {
  statusPanel.innerHTML = `${wallet.length} coins (Top coin: ${
    wallet[wallet.length - 1].cell.i
  }:${wallet[wallet.length - 1].cell.j}#${wallet[wallet.length - 1].serial})`;
}
const shownTiles: leaflet.Layer[] = [];

for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    const Lat = Math.round(i + CUR_POS.lat / TILE_DEGREES);
    const Lng = Math.round(j + CUR_POS.lng / TILE_DEGREES);
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
  CUR_POS.lat = parseFloat((CUR_POS.lat + 1e-4).toFixed(4));
  redrawMap();
});
southButton?.addEventListener("click", () => {
  CUR_POS.lat = parseFloat((CUR_POS.lat - 1e-4).toFixed(4));
  redrawMap();
});
westButton?.addEventListener("click", () => {
  CUR_POS.lng = parseFloat((CUR_POS.lng - 1e-4).toFixed(4));
  redrawMap();
});
eastButton?.addEventListener("click", () => {
  CUR_POS.lng = parseFloat((CUR_POS.lng + 1e-4).toFixed(4));
  redrawMap();
});

let currentWatch = 0;
let watching = false;

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  if (!watching) {
    watching = true;
    northButton!.disabled = true;
    southButton!.disabled = true;
    westButton!.disabled = true;
    eastButton!.disabled = true;
    currentWatch = navigator.geolocation.watchPosition((position) => {
      CUR_POS.lat = parseFloat(position.coords.latitude.toFixed(4));
      CUR_POS.lng = parseFloat(position.coords.longitude.toFixed(4));
      redrawMap();
    });
  } else {
    watching = false;
    northButton!.disabled = false;
    southButton!.disabled = false;
    westButton!.disabled = false;
    eastButton!.disabled = false;
    navigator.geolocation.clearWatch(currentWatch);
  }
});

const resetButton = document.querySelector("#reset")!;
resetButton.addEventListener("click", () => {
  if (watching) {
    watching = false;
    northButton!.disabled = false;
    southButton!.disabled = false;
    westButton!.disabled = false;
    eastButton!.disabled = false;
    navigator.geolocation.clearWatch(currentWatch);
  }

  CUR_POS.lat = 36.9995;
  CUR_POS.lng = -122.0533;
  travelHist.length = 0;
  travelHist.push(leaflet.latLng(CUR_POS.lat, CUR_POS.lng));
  wallet.length = 0;
  statusPanel.innerHTML = "No coins yet...";
  knownCells.clear();

  localStorage.clear();
  redrawMap();
});

function makePit(i: number, j: number) {
  const bounds = leaflet.latLngBounds([
    [CUR_POS.lat + i * TILE_DEGREES, CUR_POS.lng + j * TILE_DEGREES],
    [
      CUR_POS.lat + (i + 1) * TILE_DEGREES,
      CUR_POS.lng + (j + 1) * TILE_DEGREES,
    ],
  ]);

  const pit = leaflet.rectangle(bounds) as leaflet.Layer;

  let lat = Math.round(CUR_POS.lat / TILE_DEGREES + i);
  let lng = Math.round(CUR_POS.lng / TILE_DEGREES + j);
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
        setLocalWallet();
        container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          cache!.coins.length.toString();
        const len = wallet.length;
        statusPanel.innerHTML = `${len} coins (Top coin: ${
          wallet[len - 1].cell.i
        }:${wallet[len - 1].cell.j}#${wallet[len - 1].serial})`;
        knownCells.set(key, cache.toMomento());
        setLocalCells();
      }
    });
    const deposit = container.querySelector<HTMLButtonElement>("#deposit")!;
    deposit.addEventListener("click", () => {
      if (wallet.length > 0) {
        cache!.coins.unshift(wallet.pop()!);
        setLocalWallet();
        container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          cache!.coins.length.toString();
        const len = wallet.length;
        if (len > 0) {
          statusPanel.innerHTML = `${len} coins (Top coin: ${
            wallet[len - 1].cell.i
          }:${wallet[len - 1].cell.j}#${wallet[len - 1].serial})`;
        } else {
          statusPanel.innerHTML = `${len} coins`;
        }
        knownCells.set(key, cache.toMomento());
        setLocalCells();
      }
    });
    return container;
  });
  pit.addTo(map);
  shownTiles.push(pit);
}

function redrawMap() {
  playerMarker.setLatLng(leaflet.latLng(CUR_POS.lat, CUR_POS.lng));
  map.setView(playerMarker.getLatLng());

  for (const x of shownTiles) {
    x.remove();
  }

  for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
      const Lat = Math.round(i + CUR_POS.lat / TILE_DEGREES);
      const Lng = Math.round(j + CUR_POS.lng / TILE_DEGREES);
      if (luck([Lat, Lng].toString()) < PIT_SPAWN_PROBABILITY) {
        makePit(i, j);
      }
    }
  }

  travelHist.push(leaflet.latLng(CUR_POS.lat, CUR_POS.lng));
  travelLine.remove();
  travelLine = leaflet.polyline(travelHist, { color: "red" });
  travelLine.addTo(map);
  setLocalPos();
  setLocalHistory();
}

function setLocalCells() {
  if (knownCells.size > 0) {
    const storeCells: string[] = [];
    knownCells.forEach((val, key) => {
      storeCells.push(`${key} has ${val}`);
    });
    localStorage.setItem("knownCells", storeCells.join(" and "));
  } else {
    localStorage.removeItem("knownCells");
  }
}

function setLocalWallet() {
  if (wallet.length > 0) {
    localStorage.setItem(
      "wallet",
      wallet
        .map((coin) => [coin.cell.i, coin.cell.j, coin.serial].toString())
        .join(";")
    );
  } else {
    localStorage.removeItem("wallet");
  }
}

function setLocalPos() {
  localStorage.setItem(
    "curPos",
    CUR_POS.lat.toString() + "," + CUR_POS.lng.toString()
  );
}

function setLocalHistory() {
  if (travelHist.length > 0) {
    localStorage.setItem(
      "travelHist",
      travelHist.map((coord) => [coord.lat, coord.lng].toString()).join(";")
    );
  } else {
    localStorage.removeItem("travelHist");
  }
}
