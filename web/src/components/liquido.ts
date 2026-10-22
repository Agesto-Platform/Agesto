/**
 * Fundo líquido do login: porte do PixelLiquidBg (three.js). Simulação de fluido
 * Navier-Stokes com pontilhado Bayer, pixelização, granulado de filme e modo
 * automático que cede ao cursor. As cores saem dos tokens da paleta ativa e
 * acompanham a troca de paleta e de modo.
 */
import * as THREE from 'three'

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

function makePaletteTexture(stops: string[]): THREE.DataTexture {
  const data = new Uint8Array(stops.length * 4)
  writePaletteData(data, stops)
  const tex = new THREE.DataTexture(data, stops.length, 1, THREE.RGBAFormat)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

function bgVec(stops: string[]): THREE.Vector4 {
  const c = hexRGB(stops[0] ?? '#ffffff')
  return new THREE.Vector4(c[0] / 255, c[1] / 255, c[2] / 255, 0)
}

function makeBayerTexture(): THREE.DataTexture {
  const raw = [0, 136, 34, 170, 204, 68, 238, 102, 51, 187, 17, 153, 255, 119, 221, 85]
  const data = new Uint8Array(16 * 4)
  raw.forEach((r, i) => {
    data[i * 4] = r
    data[i * 4 + 1] = r
    data[i * 4 + 2] = r
    data[i * 4 + 3] = 255
  })
  const tex = new THREE.DataTexture(data, 4, 4, THREE.RGBAFormat)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

// ---------- infraestrutura (igual ao original) ----------
class CommonGL {
  width = 1
  height = 1
  pixelRatio = 1
  time = 0
  delta = 0
  renderer: THREE.WebGLRenderer
  clock = new THREE.Clock()
  private container: HTMLElement

  constructor(container: HTMLElement) {
    this.container = container
    this.measure()
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    this.renderer.autoClear = false
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setPixelRatio(this.pixelRatio)
    this.renderer.setSize(this.width, this.height, false)
    const el = this.renderer.domElement
    el.style.width = '100%'
    el.style.height = '100%'
    el.style.display = 'block'
    this.clock.start()
  }

  private measure(): void {
    const r = this.container.getBoundingClientRect()
    this.width = Math.max(1, Math.floor(r.width))
    this.height = Math.max(1, Math.floor(r.height))
  }

  resize(): void {
    this.measure()
    this.renderer.setSize(this.width, this.height, false)
  }

  update(): void {
    this.delta = this.clock.getDelta()
    this.time += this.delta
  }
}

class MouseGL {
  coords = new THREE.Vector2()
  coordsOld = new THREE.Vector2()
  diff = new THREE.Vector2()
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

type Uniforms = Record<string, THREE.IUniform>

class ShaderPass {
  scene = new THREE.Scene()
  camera = new THREE.Camera()
  material: THREE.RawShaderMaterial
  uniforms: Uniforms
  private renderer: THREE.WebGLRenderer
  private output: THREE.WebGLRenderTarget | null

  constructor(renderer: THREE.WebGLRenderer, vert: string, frag: string, uniforms: Uniforms, output: THREE.WebGLRenderTarget | null = null) {
    this.renderer = renderer
    this.uniforms = uniforms
    this.output = output
    this.material = new THREE.RawShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms })
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material))
  }

  render(to: THREE.WebGLRenderTarget | null = this.output): void {
    this.renderer.setRenderTarget(to)
    this.renderer.render(this.scene, this.camera)
    this.renderer.setRenderTarget(null)
  }
}

class AutoDriver {
  current = new THREE.Vector2()
  target = new THREE.Vector2()
  lastTime = performance.now()
  private tmp = new THREE.Vector2()
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
type Fbos = Record<(typeof FBO_NAMES)[number], THREE.WebGLRenderTarget>
type Pair = { pass: ShaderPass; output0: THREE.WebGLRenderTarget; output1: THREE.WebGLRenderTarget }

class FluidSim {
  opts: SimOpts
  fboSize = new THREE.Vector2()
  cellScale = new THREE.Vector2()
  boundarySpace = new THREE.Vector2()
  fbos: Fbos
  private gl: CommonGL
  private mouse: MouseGL
  private advection: { pass: ShaderPass; line: THREE.LineSegments }
  private externalForce: { scene: THREE.Scene; camera: THREE.Camera; uniforms: Uniforms }
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
    this.fbos = Object.fromEntries(FBO_NAMES.map((n) => [n, this.makeFBO()])) as Fbos

    const { fbos, cellScale, fboSize } = this
    const o = this.opts
    const r = this.gl.renderer
    const advUniforms: Uniforms = {
      boundarySpace: { value: cellScale },
      px: { value: cellScale },
      fboSize: { value: fboSize },
      velocity: { value: fbos.vel_0.texture },
      dt: { value: o.dt },
      isBFECC: { value: true },
    }
    const advPass = new ShaderPass(r, face_vert, advection_frag, advUniforms, fbos.vel_1)
    const bGeo = new THREE.BufferGeometry()
    bGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, -1, 1, 0, -1, 1, 0, 1, 1, 0, 1, 1, 0, 1, -1, 0, 1, -1, 0, -1, -1, 0]), 3),
    )
    const bLine = new THREE.LineSegments(
      bGeo,
      new THREE.RawShaderMaterial({ vertexShader: line_vert, fragmentShader: advection_frag, uniforms: advUniforms }),
    )
    advPass.scene.add(bLine)
    this.advection = { pass: advPass, line: bLine }

    const efUniforms: Uniforms = {
      px: { value: cellScale },
      force: { value: new THREE.Vector2() },
      center: { value: new THREE.Vector2() },
      scale: { value: new THREE.Vector2(o.cursor_size, o.cursor_size) },
    }
    const efScene = new THREE.Scene()
    efScene.add(
      new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.RawShaderMaterial({
          vertexShader: mouse_vert,
          fragmentShader: externalForce_frag,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          uniforms: efUniforms,
        }),
      ),
    )
    this.externalForce = { scene: efScene, camera: new THREE.Camera(), uniforms: efUniforms }

    this.viscousPass = {
      pass: new ShaderPass(
        r,
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
      r,
      face_vert,
      divergence_frag,
      { boundarySpace: { value: cellScale }, velocity: { value: fbos.vel_v0.texture }, px: { value: cellScale }, dt: { value: o.dt } },
      fbos.div,
    )

    this.poissonPass = {
      pass: new ShaderPass(
        r,
        face_vert,
        poisson_frag,
        { boundarySpace: { value: cellScale }, pressure: { value: fbos.p0.texture }, divergence: { value: fbos.div.texture }, px: { value: cellScale } },
        fbos.p1,
      ),
      output0: fbos.p0,
      output1: fbos.p1,
    }

    this.pressurePass = new ShaderPass(
      r,
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

  private makeFBO(): THREE.WebGLRenderTarget {
    return new THREE.WebGLRenderTarget(this.fboSize.x, this.fboSize.y, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    })
  }

  resize(): void {
    this.calcSize()
    for (const n of FBO_NAMES) this.fbos[n].setSize(this.fboSize.x, this.fboSize.y)
  }

  dispose(): void {
    for (const n of FBO_NAMES) this.fbos[n].dispose()
  }

  update(): void {
    const { opts, mouse, fbos } = this
    const r = this.gl.renderer
    this.boundarySpace.copy(opts.isBounce ? new THREE.Vector2() : this.cellScale)

    const adv = this.advection.pass.uniforms
    adv.dt!.value = opts.dt
    adv.isBFECC!.value = opts.BFECC
    this.advection.line.visible = opts.isBounce
    this.advection.pass.render()

    const mf = opts.mouse_force, cs = opts.cursor_size, cx = this.cellScale.x, cy = this.cellScale.y
    const clampedX = Math.min(Math.max(mouse.coords.x, -1 + cs * cx * 2 + cx * 2), 1 - cs * cx * 2 - cx * 2)
    const clampedY = Math.min(Math.max(mouse.coords.y, -1 + cs * cy * 2 + cy * 2), 1 - cs * cy * 2 - cy * 2)
    const ef = this.externalForce.uniforms
    ;(ef.force!.value as THREE.Vector2).set((mouse.diff.x / 2) * mf, (mouse.diff.y / 2) * mf)
    ;(ef.center!.value as THREE.Vector2).set(clampedX, clampedY)
    ;(ef.scale!.value as THREE.Vector2).set(cs, cs)
    r.setRenderTarget(fbos.vel_1)
    r.render(this.externalForce.scene, this.externalForce.camera)
    r.setRenderTarget(null)

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
 * Com movimento reduzido, ou sem WebGL, não liga nada: o fundo fica liso.
 */
export function startLiquido(
  container: HTMLElement,
  { pixelSize = 18, resolution = 0.4, mouseForce = 8, cursorSize = 110, autoDemo = true } = {},
): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}

  let gl: CommonGL
  try {
    gl = new CommonGL(container)
  } catch {
    return () => {}
  }
  container.prepend(gl.renderer.domElement)

  const mouse = new MouseGL(container)
  mouse.autoIntensity = 2.4

  let stops = paletteStops()
  const palette = makePaletteTexture(stops)
  const bayerTex = makeBayerTexture()

  const sim = new FluidSim(gl, mouse, {
    resolution,
    mouse_force: mouseForce,
    cursor_size: cursorSize,
    dt: 0.008,
    BFECC: false,
    isBounce: false,
    isViscous: false,
    iterations_poisson: 8,
  })

  const outputUniforms = {
    velocity: { value: sim.fbos.vel_0.texture },
    palette: { value: palette },
    uBayer: { value: bayerTex },
    bgColor: { value: bgVec(stops) },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(gl.width, gl.height) },
    uPixelSize: { value: pixelSize },
    boundarySpace: { value: new THREE.Vector2() },
    px: { value: new THREE.Vector2() },
  }
  const outputScene = new THREE.Scene()
  const outputCam = new THREE.Camera()
  outputScene.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.RawShaderMaterial({
        vertexShader: face_vert,
        fragmentShader: color_frag,
        transparent: true,
        depthWrite: false,
        uniforms: outputUniforms,
      }),
    ),
  )

  // troca de paleta ou tema: regrava as cores
  const themeObs = new MutationObserver(() => {
    stops = paletteStops()
    writePaletteData(palette.image.data as unknown as Uint8Array, stops)
    palette.needsUpdate = true
    outputUniforms.bgColor.value.copy(bgVec(stops))
  })
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-palette', 'data-mode'] })

  let lastInteraction = performance.now()
  mouse.onInteract = () => {
    lastInteraction = performance.now()
  }
  const driver = autoDemo ? new AutoDriver(mouse, () => lastInteraction, 0.45, 1200) : null

  const sizeObs = new ResizeObserver(() => {
    gl.resize()
    sim.resize()
    outputUniforms.uRes.value.set(gl.width, gl.height)
  })
  sizeObs.observe(container)

  let raf = 0
  let running = true
  const loop = () => {
    if (!running) return
    raf = requestAnimationFrame(loop)
    driver?.update()
    mouse.update()
    gl.update()
    outputUniforms.uTime.value = gl.time
    sim.update()
    gl.renderer.setRenderTarget(null)
    gl.renderer.render(outputScene, outputCam)
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
    palette.dispose()
    bayerTex.dispose()
    gl.renderer.dispose()
    gl.renderer.domElement.remove()
  }
}
