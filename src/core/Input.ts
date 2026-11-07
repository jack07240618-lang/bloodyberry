import { Vector2 } from './Vector2';

export class InputController {
  private keysDown: Set<string> = new Set();
  private keysJustPressed: Set<string> = new Set();
  public mouseScreenPos: Vector2 = new Vector2();
  public mouseWorldPos: Vector2 = new Vector2();
  public isMouseDown = false;
  public mouseJustClicked = false;

  // Virtual Joystick / Touch support
  public touchActive = false;
  public touchOrigin: Vector2 = new Vector2();
  public touchCurrent: Vector2 = new Vector2();
  private touchId: number | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.setupListeners();
  }

  private setupListeners(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.keysDown.has(e.code)) {
        this.keysJustPressed.add(e.code);
      }
      this.keysDown.add(e.code);

      // Prevent scrolling on Space / Arrow keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.keysDown.delete(e.code);
    });

    this.canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseScreenPos.set(e.clientX - rect.left, e.clientY - rect.top);
    });

    this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 0) {
        this.isMouseDown = true;
        this.mouseJustClicked = true;
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      }
    });

    // Touch events for mobile / tablet
    this.canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      if (this.touchId === null && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const rect = this.canvas.getBoundingClientRect();
        this.touchId = touch.identifier;
        this.touchActive = true;
        this.touchOrigin.set(touch.clientX - rect.left, touch.clientY - rect.top);
        this.touchCurrent.copy(this.touchOrigin);
        this.mouseScreenPos.copy(this.touchOrigin);
        this.mouseJustClicked = true;
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
      if (this.touchId !== null) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === this.touchId) {
            const rect = this.canvas.getBoundingClientRect();
            this.touchCurrent.set(touch.clientX - rect.left, touch.clientY - rect.top);
            this.mouseScreenPos.copy(this.touchCurrent);
            break;
          }
        }
      }
    }, { passive: false });

    const endTouch = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.touchId) {
          this.touchId = null;
          this.touchActive = false;
          break;
        }
      }
    };

    this.canvas.addEventListener('touchend', endTouch);
    this.canvas.addEventListener('touchcancel', endTouch);
  }

  public isKeyDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  public wasKeyPressed(code: string): boolean {
    return this.keysJustPressed.has(code);
  }

  public consumeClick(): boolean {
    if (this.mouseJustClicked) {
      this.mouseJustClicked = false;
      return true;
    }
    return false;
  }

  public getMovementVector(): Vector2 {
    const dir = new Vector2(0, 0);

    // Keyboard checks
    if (this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp')) dir.y -= 1;
    if (this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown')) dir.y += 1;
    if (this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft')) dir.x -= 1;
    if (this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight')) dir.x += 1;

    // Touch joystick check
    if (this.touchActive) {
      const touchDelta = this.touchCurrent.clone().sub(this.touchOrigin);
      const touchDist = touchDelta.length();
      const deadzone = 8;
      if (touchDist > deadzone) {
        touchDelta.normalize();
        dir.x += touchDelta.x;
        dir.y += touchDelta.y;
      }
    }

    if (dir.lengthSq() > 0.0001) {
      dir.normalize();
    }

    return dir;
  }

  public endFrame(): void {
    this.keysJustPressed.clear();
    this.mouseJustClicked = false;
  }
}
