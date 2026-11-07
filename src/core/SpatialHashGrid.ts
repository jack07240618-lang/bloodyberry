import { Vector2 } from './Vector2';

export interface SpatialEntity {
  id: number;
  position: Vector2;
  radius: number;
  active: boolean;
}

export class SpatialHashGrid<T extends SpatialEntity> {
  private cellSize: number;
  private grid: Map<string, T[]> = new Map();
  private queryResults: Set<T> = new Set();

  constructor(cellSize = 96) {
    this.cellSize = cellSize;
  }

  private hash(cellX: number, cellY: number): string {
    return `${cellX},${cellY}`;
  }

  public clear(): void {
    this.grid.clear();
  }

  public insert(entity: T): void {
    if (!entity.active) return;

    const minCellX = Math.floor((entity.position.x - entity.radius) / this.cellSize);
    const maxCellX = Math.floor((entity.position.x + entity.radius) / this.cellSize);
    const minCellY = Math.floor((entity.position.y - entity.radius) / this.cellSize);
    const maxCellY = Math.floor((entity.position.y + entity.radius) / this.cellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const key = this.hash(cx, cy);
        let list = this.grid.get(key);
        if (!list) {
          list = [];
          this.grid.set(key, list);
        }
        list.push(entity);
      }
    }
  }

  public queryRadius(center: Vector2, radius: number): T[] {
    this.queryResults.clear();
    const radiusSq = radius * radius;

    const minCellX = Math.floor((center.x - radius) / this.cellSize);
    const maxCellX = Math.floor((center.x + radius) / this.cellSize);
    const minCellY = Math.floor((center.y - radius) / this.cellSize);
    const maxCellY = Math.floor((center.y + radius) / this.cellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const key = this.hash(cx, cy);
        const list = this.grid.get(key);
        if (list) {
          for (let i = 0; i < list.length; i++) {
            const entity = list[i];
            if (entity.active) {
              const combinedR = radius + entity.radius;
              if (center.distanceToSq(entity.position) <= combinedR * combinedR) {
                this.queryResults.add(entity);
              }
            }
          }
        }
      }
    }

    return Array.from(this.queryResults);
  }

  public queryBox(minX: number, minY: number, maxX: number, maxY: number): T[] {
    this.queryResults.clear();

    const minCellX = Math.floor(minX / this.cellSize);
    const maxCellX = Math.floor(maxX / this.cellSize);
    const minCellY = Math.floor(minY / this.cellSize);
    const maxCellY = Math.floor(maxY / this.cellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const key = this.hash(cx, cy);
        const list = this.grid.get(key);
        if (list) {
          for (let i = 0; i < list.length; i++) {
            const entity = list[i];
            if (entity.active) {
              if (
                entity.position.x + entity.radius >= minX &&
                entity.position.x - entity.radius <= maxX &&
                entity.position.y + entity.radius >= minY &&
                entity.position.y - entity.radius <= maxY
              ) {
                this.queryResults.add(entity);
              }
            }
          }
        }
      }
    }

    return Array.from(this.queryResults);
  }
}
