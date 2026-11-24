/**
 * Fundo líquido do login: porte do PixelLiquidBg. Simulação de fluido
 * Navier-Stokes com pontilhado Bayer, pixelização, granulado de filme e modo
 * automático que cede ao cursor. As cores saem dos tokens da paleta ativa e
 * acompanham a troca de paleta e de modo. Roda em WebGL puro desde a KAN-30
 * (antes, three.js: 544 kB só para este fundo).
 */

// ---------- shaders (iguais ao original) ----------
const face_vert = `
attribute vec3 position;
uniform vec2 px;
uniform vec2 boundarySpace;
varying vec2 uv;
precision highp float;
void main(){
  vec3 pos = position;
  vec2 scale = 1.0 - boundarySpace * 2.0;
  pos.xy = pos.xy * scale;
  uv = vec2(0.5) + pos.xy * 0.5;
  gl_Position = vec4(pos, 1.0);
}`

const line_vert = `
attribute vec3 position;
uniform vec2 px;
precision highp float;
varying vec2 uv;
void main(){
  vec3 pos = position;
  uv = 0.5 + pos.xy * 0.5;
  vec2 n = sign(pos.xy);
  pos.xy = abs(pos.xy) - px * 1.0;
  pos.xy *= n;
  gl_Position = vec4(pos, 1.0);
}`

const mouse_vert = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform vec2 center;
uniform vec2 scale;
uniform vec2 px;
varying vec2 vUv;
void main(){
  vec2 pos = position.xy * scale * 2.0 * px + center;
  vUv = uv;
  gl_Position = vec4(pos, 0.0, 1.0);
}`

const advection_frag = `
precision highp float;
uniform sampler2D velocity;
uniform float dt;
uniform bool isBFECC;
uniform vec2 fboSize;
uniform vec2 px;
varying vec2 uv;
void main(){
  vec2 ratio = max(fboSize.x, fboSize.y) / fboSize;
  if(isBFECC == false){
    vec2 vel = texture2D(velocity, uv).xy;
    vec2 uv2 = uv - vel * dt * ratio;
    vec2 newVel = texture2D(velocity, uv2).xy;
    gl_FragColor = vec4(newVel, 0.0, 0.0);
  } else {
    vec2 spot_new = uv;
    vec2 vel_old = texture2D(velocity, uv).xy;
    vec2 spot_old = spot_new - vel_old * dt * ratio;
    vec2 vel_new1 = texture2D(velocity, spot_old).xy;
    vec2 spot_new2 = spot_old + vel_new1 * dt * ratio;
    vec2 error = spot_new2 - spot_new;
    vec2 spot_new3 = spot_new - error / 2.0;
    vec2 vel_2 = texture2D(velocity, spot_new3).xy;
    vec2 spot_old2 = spot_new3 - vel_2 * dt * ratio;
    vec2 newVel2 = texture2D(velocity, spot_old2).xy;
    gl_FragColor = vec4(newVel2, 0.0, 0.0);
  }
}`

const color_frag = `
precision highp float;
uniform sampler2D velocity;
uniform sampler2D palette;
uniform sampler2D uBayer;
uniform vec4 bgColor;
uniform float uTime;
uniform vec2 uRes;
uniform float uPixelSize;
varying vec2 uv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
void main(){
  vec2 pixGrid = uRes / uPixelSize;
  vec2 pixUV   = (floor(uv * pixGrid) + 0.5) / pixGrid;
  vec2 vel  = texture2D(velocity, pixUV).xy;
  float len = clamp(length(vel) * 2.2, 0.0, 1.0);
  vec2 bayerUV = (mod(floor(gl_FragCoord.xy), 4.0) + 0.5) / 4.0;
  float dither  = texture2D(uBayer, bayerUV).r - 0.5;
  float noiseVal = noise(uv * 6.0 + uTime * 0.15) * 0.06 - 0.03;
  float t = clamp(len + dither * 0.12 + noiseVal, 0.0, 1.0);
  vec3 fluidColor = texture2D(palette, vec2(t, 0.5)).rgb;
  vec3 col        = mix(bgColor.rgb, fluidColor, t);
  float grain = hash(gl_FragCoord.xy + vec2(uTime * 137.0, uTime * 91.0));
  col += (grain - 0.5) * 0.085;
  float alpha = mix(bgColor.a, 1.0, t);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), alpha);
}`

const divergence_frag = `
precision highp float;
uniform sampler2D velocity;
uniform float dt;
uniform vec2 px;
varying vec2 uv;
void main(){
  float x0 = texture2D(velocity, uv - vec2(px.x, 0.0)).x;
  float x1 = texture2D(velocity, uv + vec2(px.x, 0.0)).x;
  float y0 = texture2D(velocity, uv - vec2(0.0, px.y)).y;
  float y1 = texture2D(velocity, uv + vec2(0.0, px.y)).y;
  float divergence = (x1 - x0 + y1 - y0) / 2.0;
  gl_FragColor = vec4(divergence / dt);
}`

const externalForce_frag = `
precision highp float;
uniform vec2 force;
uniform vec2 center;
uniform vec2 scale;
uniform vec2 px;
varying vec2 vUv;
void main(){
  vec2 circle = (vUv - 0.5) * 2.0;
  float d = 1.0 - min(length(circle), 1.0);
  d *= d;
  gl_FragColor = vec4(force * d, 0.0, 1.0);
}`

const poisson_frag = `
precision highp float;
uniform sampler2D pressure;
uniform sampler2D divergence;
uniform vec2 px;
varying vec2 uv;
void main(){
  float p0 = texture2D(pressure, uv + vec2(px.x * 2.0, 0.0)).r;
  float p1 = texture2D(pressure, uv - vec2(px.x * 2.0, 0.0)).r;
  float p2 = texture2D(pressure, uv + vec2(0.0, px.y * 2.0)).r;
  float p3 = texture2D(pressure, uv - vec2(0.0, px.y * 2.0)).r;
  float div = texture2D(divergence, uv).r;
  float newP = (p0 + p1 + p2 + p3) / 4.0 - div;
  gl_FragColor = vec4(newP);
}`

const pressure_frag = `
precision highp float;
uniform sampler2D pressure;
uniform sampler2D velocity;
uniform vec2 px;
uniform float dt;
varying vec2 uv;
void main(){
  float p0 = texture2D(pressure, uv + vec2(px.x, 0.0)).r;
  float p1 = texture2D(pressure, uv - vec2(px.x, 0.0)).r;
  float p2 = texture2D(pressure, uv + vec2(0.0, px.y)).r;
  float p3 = texture2D(pressure, uv - vec2(0.0, px.y)).r;
  vec2 v      = texture2D(velocity, uv).xy;
  vec2 gradP  = vec2(p0 - p1, p2 - p3) * 0.5;
  v = v - gradP * dt;
  gl_FragColor = vec4(v, 0.0, 1.0);
}`

const viscous_frag = `
precision highp float;
uniform sampler2D velocity;
uniform sampler2D velocity_new;
uniform float v;
uniform vec2 px;
uniform float dt;
varying vec2 uv;
void main(){
  vec2 old  = texture2D(velocity, uv).xy;
  vec2 new0 = texture2D(velocity_new, uv + vec2(px.x * 2.0, 0.0)).xy;
  vec2 new1 = texture2D(velocity_new, uv - vec2(px.x * 2.0, 0.0)).xy;
  vec2 new2 = texture2D(velocity_new, uv + vec2(0.0, px.y * 2.0)).xy;
  vec2 new3 = texture2D(velocity_new, uv - vec2(0.0, px.y * 2.0)).xy;
  vec2 newv = 4.0 * old + v * dt * (new0 + new1 + new2 + new3);
  newv /= 4.0 * (1.0 + v * dt);
  gl_FragColor = vec4(newv, 0.0, 0.0);
}`

// ---------- cores: tokens da paleta ativa ----------
const isDark = () => document.documentElement.dataset.mode === 'dark'

function hexRGB(input: string): [number, number, number] {
  let h = input.trim()
  if (h.startsWith('rgb')) {
    const [r = 0, g = 0, b = 0] = (h.match(/[\d.]+/g) ?? []).map(Number)
    return [r, g, b]
  }
  if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

// fundo -> tom suave -> tom médio -> forte -> claro no pico
function paletteStops(): string[] {
  const cs = getComputedStyle(document.documentElement)
  const v = (n: string) => cs.getPropertyValue(n)
  return isDark()
    ? [v('--surface'), v('--brand-soft'), v('--chart'), v('--accent'), v('--brand')]
    : [v('--surface'), v('--brand-soft'), v('--chart'), v('--brand'), v('--accent')]
}

function writePaletteData(data: Uint8Array, stops: string[]): void {
  stops.forEach((s, i) => {
    const c = hexRGB(s)
    data[i * 4] = c[0]
    data[i * 4 + 1] = c[1]
    data[i * 4 + 2] = c[2]
    data[i * 4 + 3] = 255
  })
}

// ---------- WebGL puro (KAN-30): o que o three.js fazia pelo efeito ----------
// Os shaders acima são GLSL ES 1.0 crus; abaixo fica só a infraestrutura: contexto
// WebGL2, alvos de renderização RGBA16F, passes de tela cheia e as duas texturas
// de dados. Mesmo estado que o three usava: sem profundidade, sem limpar entre
// quadros, mistura aditiva na força do cursor e normal (não pré-multiplicada) na saída.

class Vec2 {
  x: number
  y: number
  constructor(x = 0, y = 0) {
    this.x = x
    this.y = y
  }
  set(x: number, y: number): this {
    this.x = x
    this.y = y
    return this
  }
  copy(v: Vec2): this {
    return this.set(v.x, v.y)
  }
  subVectors(a: Vec2, b: Vec2): this {
    return this.set(a.x - b.x, a.y - b.y)
  }
  multiplyScalar(s: number): this {
    return this.set(this.x * s, this.y * s)
  }
  addScaledVector(v: Vec2, s: number): this {
    return this.set(this.x + v.x * s, this.y + v.y * s)
  }
  length(): number {
    return Math.hypot(this.x, this.y)
  }
  normalize(): this {
    return this.multiplyScalar(1 / (this.length() || 1))
  }
}

class Vec4 {
  x: number
  y: number
  z: number
  w: number
  constructor(x = 0, y = 0, z = 0, w = 0) {
    this.x = x
    this.y = y
    this.z = z
    this.w = w
  }
  copy(v: Vec4): this {
    this.x = v.x
    this.y = v.y
    this.z = v.z
    this.w = v.w
    return this
  }
}

/** Referência estável a uma textura: o redimensionamento troca o `handle`, não o objeto. */
class Tex {
  handle: WebGLTexture
  constructor(handle: WebGLTexture) {
    this.handle = handle
  }
}

type UniformValue = number | boolean | Vec2 | Vec4 | Tex
type Uniforms = Record<string, { value: UniformValue }>

class Program {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private locs = new Map<string, WebGLUniformLocation | null>()
  readonly position: number
  readonly uv: number

  constructor(gl: WebGL2RenderingContext, vert: string, frag: string) {
    this.gl = gl
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    const p = gl.createProgram()!
    const vs = compile(gl.VERTEX_SHADER, vert)
    const fs = compile(gl.FRAGMENT_SHADER, frag)
    gl.attachShader(p, vs)
    gl.attachShader(p, fs)
    gl.linkProgram(p)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'program')
    this.program = p
    this.position = gl.getAttribLocation(p, 'position')
    this.uv = gl.getAttribLocation(p, 'uv')
  }

  private loc(name: string): WebGLUniformLocation | null {
    if (!this.locs.has(name)) this.locs.set(name, this.gl.getUniformLocation(this.program, name))
    return this.locs.get(name) ?? null
  }

  /** Liga o programa e envia os uniforms; os que o shader não usa ficam de fora. */
  use(uniforms: Uniforms): void {
    const gl = this.gl
    gl.useProgram(this.program)
    let unit = 0
    for (const [name, { value }] of Object.entries(uniforms)) {
      const l = this.loc(name)
      if (!l) continue
      if (value instanceof Tex) {
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_2D, value.handle)
        gl.uniform1i(l, unit++)
      } else if (value instanceof Vec2) gl.uniform2f(l, value.x, value.y)
      else if (value instanceof Vec4) gl.uniform4f(l, value.x, value.y, value.z, value.w)
      else if (typeof value === 'boolean') gl.uniform1i(l, value ? 1 : 0)
      else gl.uniform1f(l, value)
    }
  }

  dispose(): void {
    this.gl.deleteProgram(this.program)
  }
}

/** Geometria: posição (xy) e uv intercaladas, desenhada como tira de triângulos ou linhas. */
class Geometry {
  private gl: WebGL2RenderingContext
  private buffer: WebGLBuffer
  readonly mode: number
  readonly count: number

  constructor(gl: WebGL2RenderingContext, data: number[], mode: number, count: number) {
    this.gl = gl
    this.mode = mode
    this.count = count
    this.buffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW)
  }

  draw(program: Program): void {
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    for (let i = 0; i < 2; i++) gl.disableVertexAttribArray(i)
    if (program.position >= 0) {
      gl.enableVertexAttribArray(program.position)
      gl.vertexAttribPointer(program.position, 2, gl.FLOAT, false, 16, 0)
    }
    if (program.uv >= 0) {
      gl.enableVertexAttribArray(program.uv)
      gl.vertexAttribPointer(program.uv, 2, gl.FLOAT, false, 16, 8)
    }
    gl.drawArrays(this.mode, 0, this.count)
  }

  dispose(): void {
    this.gl.deleteBuffer(this.buffer)
  }
}

/** Plano centrado de lado `s` (o PlaneGeometry do three): x, y, u, v. */
function plane(gl: WebGL2RenderingContext, s: number): Geometry {
  const h = s / 2
  return new Geometry(gl, [-h, -h, 0, 0, h, -h, 1, 0, -h, h, 0, 1, h, h, 1, 1], gl.TRIANGLE_STRIP, 4)
}

class RenderTarget {
  readonly texture: Tex
  private gl: WebGL2RenderingContext
  private fb: WebGLFramebuffer
  width = 1
  height = 1

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
    this.gl = gl
    this.fb = gl.createFramebuffer()!
    this.texture = new Tex(gl.createTexture()!)
    this.setSize(width, height)
  }

  /** Recria a textura vazia (zerada), como o setSize do three. */
  setSize(width: number, height: number): void {
    const gl = this.gl
    this.width = width
    this.height = height
    gl.deleteTexture(this.texture.handle)
    this.texture.handle = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.texture.handle)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture.handle, 0)
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    if (!ok) throw new Error('RGBA16F sem suporte')
  }

  bind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fb)
    this.gl.viewport(0, 0, this.width, this.height)
  }

  dispose(): void {
    this.gl.deleteFramebuffer(this.fb)
    this.gl.deleteTexture(this.texture.handle)
  }
}

type Blend = 'none' | 'additive' | 'normal'

class CommonGL {
  width = 1
  height = 1
  time = 0
  delta = 0
  readonly canvas = document.createElement('canvas')
  readonly gl: WebGL2RenderingContext
  readonly quad: Geometry
  private last = performance.now()
  private container: HTMLElement

  constructor(container: HTMLElement) {
    this.container = container
    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
    })
    if (!gl) throw new Error('sem WebGL2')
    // Renderizar em RGBA16F precisa de uma destas extensões (o three pedia a mesma).
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float'))
      throw new Error('sem float')
    this.gl = gl
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.CULL_FACE)
    this.quad = plane(gl, 2)
    this.resize()
    const s = this.canvas.style
    s.width = '100%'
    s.height = '100%'
    s.display = 'block'
  }

  resize(): void {
    const r = this.container.getBoundingClientRect()
    this.width = Math.max(1, Math.floor(r.width))
    this.height = Math.max(1, Math.floor(r.height))
    this.canvas.width = this.width
    this.canvas.height = this.height
  }

  update(): void {
    const now = performance.now()
    this.delta = (now - this.last) / 1000
    this.last = now
    this.time += this.delta
  }

  /** Um passe: alvo (null = tela), programa, uniforms, geometria e mistura. */
  render(
    target: RenderTarget | null,
    program: Program,
    uniforms: Uniforms,
    geometry: Geometry = this.quad,
    blend: Blend = 'none',
  ): void {
    const gl = this.gl
    if (target) target.bind()
    else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, this.width, this.height)
    }
    if (blend === 'none') gl.disable(gl.BLEND)
    else {
      gl.enable(gl.BLEND)
      gl.blendEquation(gl.FUNC_ADD)
      if (blend === 'additive') gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
      else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    }
    program.use(uniforms)
    geometry.draw(program)
  }

  dispose(): void {
    this.quad.dispose()
    this.gl.getExtension('WEBGL_lose_context')?.loseContext()
    this.canvas.remove()
  }
}

class DataTex extends Tex {
  readonly data: Uint8Array
  private gl: WebGL2RenderingContext
  private width: number
  private height: number

  constructor(gl: WebGL2RenderingContext, data: Uint8Array, width: number, height: number, filter: number, wrap: number) {
    super(gl.createTexture()!)
    this.gl = gl
    this.data = data
    this.width = width
    this.height = height
    gl.bindTexture(gl.TEXTURE_2D, this.handle)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
    this.upload()
  }

  upload(): void {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.handle)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.data)
  }

  dispose(): void {
    this.gl.deleteTexture(this.handle)
  }
}

function makePaletteTexture(gl: WebGL2RenderingContext, stops: string[]): DataTex {
  const data = new Uint8Array(stops.length * 4)
  writePaletteData(data, stops)
  return new DataTex(gl, data, stops.length, 1, gl.LINEAR, gl.CLAMP_TO_EDGE)
}

function bgVec(stops: string[]): Vec4 {
  const c = hexRGB(stops[0] ?? '#ffffff')
  return new Vec4(c[0] / 255, c[1] / 255, c[2] / 255, 0)
}

function makeBayerTexture(gl: WebGL2RenderingContext): DataTex {
  const raw = [0, 136, 34, 170, 204, 68, 238, 102, 51, 187, 17, 153, 255, 119, 221, 85]
  const data = new Uint8Array(16 * 4)
  raw.forEach((r, i) => {
    data[i * 4] = r
    data[i * 4 + 1] = r
    data[i * 4 + 2] = r
    data[i * 4 + 3] = 255
  })
  return new DataTex(gl, data, 4, 4, gl.NEAREST, gl.REPEAT)
}

// ---------- infraestrutura (igual ao original) ----------
class MouseGL {
  coords = new Vec2()
  coordsOld = new Vec2()
  diff = new Vec2()
  mouseMoved = false
  isInside = false
  isAutoActive = false
  autoIntensity = 2.0
  onInteract: (() => void) | null = null
  private timer = 0
  private container: HTMLElement

  constructor(container: HTMLElement) {
    this.container = container
    window.addEventListener('mousemove', this.onMove)
    window.addEventListener('touchmove', this.onTouch, { passive: true })
    window.addEventListener('touchstart', this.onTouch, { passive: true })
    document.addEventListener('mouseleave', this.onLeave)
  }

  dispose(): void {
    window.removeEventListener('mousemove', this.onMove)
    window.removeEventListener('touchmove', this.onTouch)
    window.removeEventListener('touchstart', this.onTouch)
    document.removeEventListener('mouseleave', this.onLeave)
    clearTimeout(this.timer)
  }

  private onLeave = () => {
    this.isInside = false
  }

  private onMove = (e: MouseEvent) => {
    const r = this.container.getBoundingClientRect()
    this.isInside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    if (!this.isInside) return
    this.onInteract?.()
    this.set(e.clientX, e.clientY)
  }

  private onTouch = (e: TouchEvent) => {
    const t = e.touches[0]
    if (e.touches.length !== 1 || !t) return
    this.onInteract?.()
    this.set(t.clientX, t.clientY)
  }

  private set(cx: number, cy: number): void {
    clearTimeout(this.timer)
    const r = this.container.getBoundingClientRect()
    const nx = (cx - r.left) / r.width, ny = (cy - r.top) / r.height
    this.coords.set(nx * 2 - 1, -(ny * 2 - 1))
    this.mouseMoved = true
    this.timer = window.setTimeout(() => {
      this.mouseMoved = false
    }, 100)
  }

  setNormalized(x: number, y: number): void {
    this.coords.set(x, y)
    this.mouseMoved = true
  }

  update(): void {
    this.diff.subVectors(this.coords, this.coordsOld)
    this.coordsOld.copy(this.coords)
    if (this.coordsOld.x === 0 && this.coordsOld.y === 0) this.diff.set(0, 0)
    if (this.isAutoActive) this.diff.multiplyScalar(this.autoIntensity)
  }
}

class ShaderPass {
  readonly program: Program
  uniforms: Uniforms
  private common: CommonGL
  private output: RenderTarget | null

  constructor(common: CommonGL, vert: string, frag: string, uniforms: Uniforms, output: RenderTarget | null = null) {
    this.common = common
    this.uniforms = uniforms
    this.output = output
    this.program = new Program(common.gl, vert, frag)
  }

  render(to: RenderTarget | null = this.output): void {
    this.common.render(to, this.program, this.uniforms)
  }

  dispose(): void {
    this.program.dispose()
  }
}

class AutoDriver {
  current = new Vec2()
  target = new Vec2()
  lastTime = performance.now()
  private tmp = new Vec2()
  private mouse: MouseGL
  private lastInteraction: () => number
  private speed: number
  private resumeDelay: number

  constructor(mouse: MouseGL, lastInteraction: () => number, speed = 0.4, resumeDelay = 1200) {
    this.mouse = mouse
    this.lastInteraction = lastInteraction
    this.speed = speed
    this.resumeDelay = resumeDelay
    this.pickTarget()
  }

  private pickTarget(): void {
    this.target.set((Math.random() * 2 - 1) * 0.8, (Math.random() * 2 - 1) * 0.8)
  }

  update(): void {
    const now = performance.now()
    if (now - this.lastInteraction() < this.resumeDelay) {
      this.mouse.isAutoActive = false
      return
    }
    this.mouse.isAutoActive = true
    const dt = Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now
    const dir = this.tmp.subVectors(this.target, this.current)
    const dist = dir.length()
    if (dist < 0.02) {
      this.pickTarget()
      return
    }
    dir.normalize()
    this.current.addScaledVector(dir, Math.min(this.speed * dt, dist))
    this.mouse.setNormalized(this.current.x, this.current.y)
  }
}

interface SimOpts {
  resolution: number
  mouse_force: number
  cursor_size: number
  dt: number
  BFECC: boolean
  isBounce: boolean
  isViscous: boolean
  viscous: number
  iterations_viscous: number
  iterations_poisson: number
}

const FBO_NAMES = ['vel_0', 'vel_1', 'vel_v0', 'vel_v1', 'div', 'p0', 'p1'] as const
type Fbos = Record<(typeof FBO_NAMES)[number], RenderTarget>
type Pair = { pass: ShaderPass; output0: RenderTarget; output1: RenderTarget }

// Borda da advecção (modo "isBounce"): quatro segmentos no contorno; x, y, u, v.
const BORDA = [-1, -1, -1, 1, -1, 1, 1, 1, 1, 1, 1, -1, 1, -1, -1, -1].flatMap((v, i, a) =>
  i % 2 ? [] : [v, a[i + 1] ?? 0, 0, 0],
)

class FluidSim {
  opts: SimOpts
  fboSize = new Vec2()
  cellScale = new Vec2()
  boundarySpace = new Vec2()
  fbos: Fbos
  private gl: CommonGL
  private mouse: MouseGL
  private advection: { pass: ShaderPass; lineProgram: Program; line: Geometry }
  private externalForce: { program: Program; plane: Geometry; uniforms: Uniforms }
  private viscousPass: Pair
  private divergencePass: ShaderPass
  private poissonPass: Pair
  private pressurePass: ShaderPass

  constructor(gl: CommonGL, mouse: MouseGL, opts: Partial<SimOpts>) {
    this.gl = gl
    this.mouse = mouse
    this.opts = {
      resolution: 0.4,
      mouse_force: 10,
      cursor_size: 100,
      dt: 0.011,
      BFECC: true,
      isBounce: false,
      isViscous: false,
      viscous: 30,
      iterations_viscous: 32,
      iterations_poisson: 32,
      ...opts,
    }
    this.calcSize()
    this.fbos = Object.fromEntries(
      FBO_NAMES.map((n) => [n, new RenderTarget(gl.gl, this.fboSize.x, this.fboSize.y)]),
    ) as Fbos

    const { fbos, cellScale, fboSize } = this
    const o = this.opts
    const advUniforms: Uniforms = {
      boundarySpace: { value: cellScale },
      px: { value: cellScale },
      fboSize: { value: fboSize },
      velocity: { value: fbos.vel_0.texture },
      dt: { value: o.dt },
      isBFECC: { value: true },
    }
    this.advection = {
      pass: new ShaderPass(gl, face_vert, advection_frag, advUniforms, fbos.vel_1),
      lineProgram: new Program(gl.gl, line_vert, advection_frag),
      line: new Geometry(gl.gl, BORDA, gl.gl.LINES, 8),
    }

    this.externalForce = {
      program: new Program(gl.gl, mouse_vert, externalForce_frag),
      plane: plane(gl.gl, 1),
      uniforms: {
        px: { value: cellScale },
        force: { value: new Vec2() },
        center: { value: new Vec2() },
        scale: { value: new Vec2(o.cursor_size, o.cursor_size) },
      },
    }

    this.viscousPass = {
      pass: new ShaderPass(
        gl,
        face_vert,
        viscous_frag,
        {
          boundarySpace: { value: cellScale },
          velocity: { value: fbos.vel_1.texture },
          velocity_new: { value: fbos.vel_v0.texture },
          v: { value: o.viscous },
          px: { value: cellScale },
          dt: { value: o.dt },
        },
        fbos.vel_v1,
      ),
      output0: fbos.vel_v0,
      output1: fbos.vel_v1,
    }

    this.divergencePass = new ShaderPass(
      gl,
      face_vert,
      divergence_frag,
      { boundarySpace: { value: cellScale }, velocity: { value: fbos.vel_v0.texture }, px: { value: cellScale }, dt: { value: o.dt } },
      fbos.div,
    )

    this.poissonPass = {
      pass: new ShaderPass(
        gl,
        face_vert,
        poisson_frag,
        { boundarySpace: { value: cellScale }, pressure: { value: fbos.p0.texture }, divergence: { value: fbos.div.texture }, px: { value: cellScale } },
        fbos.p1,
      ),
      output0: fbos.p0,
      output1: fbos.p1,
    }

    this.pressurePass = new ShaderPass(
      gl,
      face_vert,
      pressure_frag,
      {
        boundarySpace: { value: cellScale },
        pressure: { value: fbos.p0.texture },
        velocity: { value: fbos.vel_v0.texture },
        px: { value: cellScale },
        dt: { value: o.dt },
      },
      fbos.vel_0,
    )
  }

  private calcSize(): void {
    const w = Math.max(1, Math.round(this.opts.resolution * this.gl.width))
    const h = Math.max(1, Math.round(this.opts.resolution * this.gl.height))
    this.cellScale.set(1 / w, 1 / h)
    this.fboSize.set(w, h)
  }

  resize(): void {
    this.calcSize()
    for (const n of FBO_NAMES) this.fbos[n].setSize(this.fboSize.x, this.fboSize.y)
  }

  dispose(): void {
    for (const n of FBO_NAMES) this.fbos[n].dispose()
    for (const p of [this.advection.pass, this.viscousPass.pass, this.divergencePass, this.poissonPass.pass, this.pressurePass])
      p.dispose()
    this.advection.lineProgram.dispose()
    this.advection.line.dispose()
    this.externalForce.program.dispose()
    this.externalForce.plane.dispose()
  }

  update(): void {
    const { opts, mouse, fbos } = this
    this.boundarySpace.copy(opts.isBounce ? new Vec2() : this.cellScale)

    const adv = this.advection
    adv.pass.uniforms.dt!.value = opts.dt
    adv.pass.uniforms.isBFECC!.value = opts.BFECC
    adv.pass.render()
    if (opts.isBounce) this.gl.render(fbos.vel_1, adv.lineProgram, adv.pass.uniforms, adv.line)

    const mf = opts.mouse_force, cs = opts.cursor_size, cx = this.cellScale.x, cy = this.cellScale.y
    const clampedX = Math.min(Math.max(mouse.coords.x, -1 + cs * cx * 2 + cx * 2), 1 - cs * cx * 2 - cx * 2)
    const clampedY = Math.min(Math.max(mouse.coords.y, -1 + cs * cy * 2 + cy * 2), 1 - cs * cy * 2 - cy * 2)
    const ef = this.externalForce
    ;(ef.uniforms.force!.value as Vec2).set((mouse.diff.x / 2) * mf, (mouse.diff.y / 2) * mf)
    ;(ef.uniforms.center!.value as Vec2).set(clampedX, clampedY)
    ;(ef.uniforms.scale!.value as Vec2).set(cs, cs)
    this.gl.render(fbos.vel_1, ef.program, ef.uniforms, ef.plane, 'additive')

    let velFBO = fbos.vel_1
    if (opts.isViscous) {
      const { pass, output0, output1 } = this.viscousPass
      pass.uniforms.v!.value = opts.viscous
      pass.uniforms.dt!.value = opts.dt
      let fboOut = output1
      for (let i = 0; i < opts.iterations_viscous; i++) {
        const fboIn = i % 2 === 0 ? output0 : output1
        fboOut = i % 2 === 0 ? output1 : output0
        pass.uniforms.velocity_new!.value = fboIn.texture
        pass.render(fboOut)
      }
      velFBO = fboOut
    }
    this.divergencePass.uniforms.velocity!.value = velFBO.texture
    this.divergencePass.render()

    const { pass, output0, output1 } = this.poissonPass
    let pOut = output1
    for (let i = 0; i < opts.iterations_poisson; i++) {
      const pIn = i % 2 === 0 ? output0 : output1
      pOut = i % 2 === 0 ? output1 : output0
      pass.uniforms.pressure!.value = pIn.texture
      pass.render(pOut)
    }
    this.pressurePass.uniforms.pressure!.value = pOut.texture
    this.pressurePass.uniforms.velocity!.value = velFBO.texture
    this.pressurePass.render()
  }
}

/**
 * Liga o fundo no `container` e devolve a função que desliga (para o unmount).
 * Com movimento reduzido, ou sem WebGL2, não liga nada: o fundo fica liso.
 */
export function startLiquido(
  container: HTMLElement,
  { pixelSize = 18, resolution = 0.4, mouseForce = 8, cursorSize = 110, autoDemo = true } = {},
): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}

  const mouse = new MouseGL(container)
  let stops = paletteStops()
  let gl: CommonGL | null = null
  let parts: { sim: FluidSim; output: Program; palette: DataTex; bayerTex: DataTex }
  try {
    gl = new CommonGL(container)
    parts = {
      palette: makePaletteTexture(gl.gl, stops),
      bayerTex: makeBayerTexture(gl.gl),
      sim: new FluidSim(gl, mouse, {
        resolution,
        mouse_force: mouseForce,
        cursor_size: cursorSize,
        dt: 0.008,
        BFECC: false,
        isBounce: false,
        isViscous: false,
        iterations_poisson: 8,
      }),
      output: new Program(gl.gl, face_vert, color_frag),
    }
  } catch {
    mouse.dispose()
    gl?.dispose()
    return () => {}
  }
  const common = gl
  const { sim, output, palette, bayerTex } = parts
  container.prepend(common.canvas)
  mouse.autoIntensity = 2.4

  const outputUniforms = {
    velocity: { value: sim.fbos.vel_0.texture },
    palette: { value: palette },
    uBayer: { value: bayerTex },
    bgColor: { value: bgVec(stops) },
    uTime: { value: 0 },
    uRes: { value: new Vec2(common.width, common.height) },
    uPixelSize: { value: pixelSize },
    boundarySpace: { value: new Vec2() },
    px: { value: new Vec2() },
  }

  // troca de paleta ou tema: regrava as cores
  const themeObs = new MutationObserver(() => {
    stops = paletteStops()
    writePaletteData(palette.data, stops)
    palette.upload()
    outputUniforms.bgColor.value.copy(bgVec(stops))
  })
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-palette', 'data-mode'] })

  let lastInteraction = performance.now()
  mouse.onInteract = () => {
    lastInteraction = performance.now()
  }
  const driver = autoDemo ? new AutoDriver(mouse, () => lastInteraction, 0.45, 1200) : null

  const sizeObs = new ResizeObserver(() => {
    common.resize()
    sim.resize()
    outputUniforms.uRes.value.set(common.width, common.height)
  })
  sizeObs.observe(container)

  let raf = 0
  let running = true
  const loop = () => {
    if (!running) return
    raf = requestAnimationFrame(loop)
    driver?.update()
    mouse.update()
    common.update()
    outputUniforms.uTime.value = common.time
    sim.update()
    common.render(null, output, outputUniforms, common.quad, 'normal')
  }
  loop()

  const onVisibility = () => {
    if (document.hidden) {
      running = false
      cancelAnimationFrame(raf)
    } else if (!running) {
      running = true
      loop()
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    running = false
    cancelAnimationFrame(raf)
    document.removeEventListener('visibilitychange', onVisibility)
    themeObs.disconnect()
    sizeObs.disconnect()
    mouse.dispose()
    sim.dispose()
    output.dispose()
    palette.dispose()
    bayerTex.dispose()
    common.dispose()
  }
}
