import leaflet from "leaflet";

interface Cell {
  readonly i: number;
  readonly j: number;
}

export default class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;

  private readonly knownCells: Map<string, Cell>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map<string, Cell>();
  }

  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = [i, j].toString();
    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    return this.getCanonicalCell({
      i: point.lat,
      j: point.lng,
    });
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    return leaflet.latLngBounds(
      leaflet.latLng(cell.i, cell.j),
      leaflet.latLng(cell.i + this.tileWidth, cell.j + this.tileWidth)
    );
  }

  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];

    for (let x = 0; x < this.tileVisibilityRadius; x++) {
      const lat = point.lat - this.tileVisibilityRadius / 2 + x;
      for (let y = 0; y < this.tileVisibilityRadius; y++) {
        const lng = point.lng - this.tileVisibilityRadius / 2 + y;
        const closeCell = this.getCellForPoint(leaflet.latLng(lat, lng));
        resultCells.push(closeCell);
      }
    }

    return resultCells;
  }
}
