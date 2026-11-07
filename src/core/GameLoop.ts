export class GameLoop {
  private lastTime = 0;
  private accumulator = 0;
  private isRunning = false;
  private rafId: number | null = null;

  public readonly fixedStep: number;
  public readonly maxSubSteps: number;

  constructor(
    private updateFn: (dt: number) => void,
    private renderFn: (alpha: number) => void,
    fps = 60,
    maxSubSteps = 4
  ) {
    this.fixedStep = 1 / fps;
    this.maxSubSteps = maxSubSteps;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.loop);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;

    let frameTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Clamp huge frame delays (e.g. tab switch) to avoid spiral of death
    if (frameTime > 0.25) {
      frameTime = 0.25;
    }

    this.accumulator += frameTime;

    let subSteps = 0;
    while (this.accumulator >= this.fixedStep && subSteps < this.maxSubSteps) {
      this.updateFn(this.fixedStep);
      this.accumulator -= this.fixedStep;
      subSteps++;
    }

    const alpha = this.accumulator / this.fixedStep;
    this.renderFn(alpha);

    this.rafId = requestAnimationFrame(this.loop);
  };
}
