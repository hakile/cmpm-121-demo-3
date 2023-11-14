import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
// import Board from "./board";
import "./leafletWorkaround";

interface Coin {
  i: number;
  j: number;
  serial: number;
}

const MERRILL_CLASSROOM = leaflet.latLng({
  lat: 36.9995,
  lng: -122.0533,
});

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 64;
const PIT_SPAWN_PROBABILITY = 0.04;

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
// const board = new Board(1, 1);
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No coins yet...";

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
  let value = Math.floor(luck([i, j, "initialValue"].toString()) * 100);

  let lat = MERRILL_CLASSROOM.lat * 1e4 + i;
  let lng = MERRILL_CLASSROOM.lng * 1e4 + j;

  let coins: Coin[] = [];
  for (let x = 0; x < value; x++) {
    coins.push({ i: lat, j: lng, serial: x });
  }

  pit.bindPopup(() => {
    const container = document.createElement("div");
    container.innerHTML = `
                <div>There is a pit here at "${lat},${lng}". It has <span id="value">${coins.length}</span> coins.</div>
                <button id="collect">Collect</button>
                <button id="deposit">Deposit</button>
                `;
    const collect = container.querySelector<HTMLButtonElement>("#collect")!;
    collect.addEventListener("click", () => {
      if (coins.length > 0) {
        container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          value.toString();
        wallet.push(coins.shift()!);
        const len = wallet.length;
        statusPanel.innerHTML = `${len} coins (Last coin: ${
          wallet[len - 1].i
        }:${wallet[len - 1].j}#${wallet[len - 1].serial})`;
      }
    });
    const deposit = container.querySelector<HTMLButtonElement>("#deposit")!;
    deposit.addEventListener("click", () => {
      if (wallet.length > 0) {
        container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          value.toString();
        coins.unshift(wallet.pop()!);
        const len = wallet.length;
        if (len > 0) {
          statusPanel.innerHTML = `${len} coins (Last coin: ${
            wallet[len - 1].i
          }:${wallet[len - 1].j}#${wallet[len - 1].serial})`;
        } else {
          statusPanel.innerHTML = `${len} coins`;
        }
      }
    });
    return container;
  });
  pit.addTo(map);
}

for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
      makePit(i, j);
    }
  }
}
