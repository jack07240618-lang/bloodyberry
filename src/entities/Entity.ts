import { Vector2 } from '../core/Vector2';
import { SpatialEntity } from '../core/SpatialHashGrid';

let nextEntityId = 1;

export abstract class Entity implements SpatialEntity {
  public id: number;
  public position: Vector2;
  public velocity: Vector2;
  public radius: number;
  public active = true;

  constructor(x = 0, y = 0, radius = 10) {
    this.id = nextEntityId++;
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(0, 0);
    this.radius = radius;
  }

  public abstract update(dt: number): void;
  public abstract render(ctx: CanvasRenderingContext2D): void;
}
