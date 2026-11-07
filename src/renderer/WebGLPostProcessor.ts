export class WebGLPostProcessor {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private buffer: WebGLBuffer | null = null;
  public enabled = true;

  // Uniform locations
  private uTimeLoc: WebGLUniformLocation | null = null;
  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uShockwaveLoc: WebGLUniformLocation | null = null; // center.x, center.y, radius, intensity
  private shockwaveData = new Float32Array([0.5, 0.5, 0.0, 0.0]);

  // Canvas
  public glCanvas: HTMLCanvasElement;

  constructor(width: number, height: number) {
    this.glCanvas = document.createElement('canvas');
    this.glCanvas.id = 'webgl-post-canvas';
    this.glCanvas.style.position = 'absolute';
    this.glCanvas.style.top = '0';
    this.glCanvas.style.left = '0';
    this.glCanvas.style.width = '100vw';
    this.glCanvas.style.height = '100vh';
    this.glCanvas.style.pointerEvents = 'none';

    this.resize(width, height);
    this.initGL();
  }

  public resize(width: number, height: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.glCanvas.width = width * dpr;
    this.glCanvas.height = height * dpr;
    if (this.gl) {
      this.gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
    }
  }

  private initGL(): void {
    try {
      this.gl = this.glCanvas.getContext('webgl', { premultipliedAlpha: true, alpha: true });
      if (!this.gl) {
        this.enabled = false;
        return;
      }

      const vsSource = `
        attribute vec2 a_position;
        varying vec2 v_uv;
        void main() {
          v_uv = (a_position + 1.0) * 0.5;
          v_uv.y = 1.0 - v_uv.y; // Flip Y for Canvas 2D texture
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;

      // GLSL Fragment Shader: Chromatic Aberration, Bloom Glow, Shockwave Ripple, CRT lines
      const fsSource = `
        precision mediump float;
        uniform sampler2D u_image;
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform vec4 u_shockwave; // x, y, radius, intensity
        varying vec2 v_uv;

        void main() {
          vec2 uv = v_uv;

          // Shockwave distortion
          if (u_shockwave.w > 0.001) {
            vec2 toCenter = uv - u_shockwave.xy;
            toCenter.x *= (u_resolution.x / u_resolution.y);
            float dist = length(toCenter);
            if (dist > u_shockwave.z - 0.08 && dist < u_shockwave.z + 0.08) {
              float diff = dist - u_shockwave.z;
              float powDiff = 1.0 - pow(abs(diff * 12.5), 0.8);
              float diffUV = diff * powDiff;
              vec2 dir = normalize(toCenter);
              uv -= dir * diffUV * u_shockwave.w;
            }
          }

          // Chromatic Aberration on screen edges
          vec2 centerDist = uv - 0.5;
          float distSq = dot(centerDist, centerDist);
          vec2 aberrationOffset = centerDist * (distSq * 0.012);

          vec4 colR = texture2D(u_image, uv - aberrationOffset);
          vec4 colG = texture2D(u_image, uv);
          vec4 colB = texture2D(u_image, uv + aberrationOffset);
          vec4 baseColor = vec4(colR.r, colG.g, colB.b, colG.a);

          // Subtle Bloom highlight
          vec4 bright = max(baseColor - 0.65, 0.0) * 0.7;

          // Subtle vintage scanline overlay
          float scanline = sin(uv.y * u_resolution.y * 1.5) * 0.02;

          vec3 finalColor = baseColor.rgb + bright.rgb - scanline;

          gl_FragColor = vec4(finalColor, baseColor.a);
        }
      `;

      const vs = this.compileShader(this.gl.VERTEX_SHADER, vsSource);
      const fs = this.compileShader(this.gl.FRAGMENT_SHADER, fsSource);
      if (!vs || !fs) {
        this.enabled = false;
        return;
      }

      this.program = this.gl.createProgram();
      if (!this.program) return;

      this.gl.attachShader(this.program, vs);
      this.gl.attachShader(this.program, fs);
      this.gl.linkProgram(this.program);

      if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
        console.warn('WebGL Link error:', this.gl.getProgramInfoLog(this.program));
        this.enabled = false;
        return;
      }

      this.uTimeLoc = this.gl.getUniformLocation(this.program, 'u_time');
      this.uResolutionLoc = this.gl.getUniformLocation(this.program, 'u_resolution');
      this.uShockwaveLoc = this.gl.getUniformLocation(this.program, 'u_shockwave');

      // Quad buffer [-1, -1] to [1, 1]
      this.buffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
      this.gl.bufferData(
        this.gl.ARRAY_BUFFER,
        new Float32Array([
          -1, -1,
           1, -1,
          -1,  1,
          -1,  1,
           1, -1,
           1,  1
        ]),
        this.gl.STATIC_DRAW
      );

      // Texture
      this.texture = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    } catch {
      this.enabled = false;
    }
  }

  private compileShader(type: number, src: string): WebGLShader | null {
    if (!this.gl) return null;
    const shader = this.gl.createShader(type);
    if (!shader) return null;
    this.gl.shaderSource(shader, src);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.warn('Shader compile err:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  public triggerShockwave(normalizedScreenX: number, normalizedScreenY: number): void {
    this.shockwaveData[0] = normalizedScreenX;
    this.shockwaveData[1] = normalizedScreenY;
    this.shockwaveData[2] = 0.0;
    this.shockwaveData[3] = 0.8;
  }

  public update(dt: number): void {
    if (this.shockwaveData[3] > 0.001) {
      this.shockwaveData[2] += dt * 1.5; // Radius expands
      this.shockwaveData[3] *= Math.pow(0.85, dt * 60); // Fade intensity
    }
  }

  public render(sourceCanvas: HTMLCanvasElement, timeSeconds: number): void {
    if (!this.enabled || !this.gl || !this.program || !this.texture) return;

    this.gl.useProgram(this.program);

    // Upload Canvas 2D image into WebGL texture
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, sourceCanvas);

    // Uniforms
    if (this.uTimeLoc) this.gl.uniform1f(this.uTimeLoc, timeSeconds);
    if (this.uResolutionLoc) this.gl.uniform2f(this.uResolutionLoc, this.glCanvas.width, this.glCanvas.height);
    if (this.uShockwaveLoc) this.gl.uniform4fv(this.uShockwaveLoc, this.shockwaveData);

    // Draw full-screen quad
    const posLoc = this.gl.getAttribLocation(this.program, 'a_position');
    this.gl.enableVertexAttribArray(posLoc);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }
}
