"use client"

import { useEffect, useRef } from "react"
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
} from "postprocessing"
import * as THREE from "three"

// ─── Distortion uniforms ────────────────────────────────────────────────────

const mountainUniforms = {
  uFreq: { value: new THREE.Vector3(3, 6, 10) },
  uAmp: { value: new THREE.Vector3(30, 30, 20) },
}
const xyUniforms = {
  uFreq: { value: new THREE.Vector2(5, 2) },
  uAmp: { value: new THREE.Vector2(25, 15) },
}
const LongRaceUniforms = {
  uFreq: { value: new THREE.Vector2(2, 3) },
  uAmp: { value: new THREE.Vector2(35, 10) },
}
const turbulentUniforms = {
  uFreq: { value: new THREE.Vector4(4, 8, 8, 1) },
  uAmp: { value: new THREE.Vector4(25, 5, 10, 10) },
}
const deepUniforms = {
  uFreq: { value: new THREE.Vector2(4, 8) },
  uAmp: { value: new THREE.Vector2(10, 20) },
  uPowY: { value: new THREE.Vector2(20, 2) },
}

const nsin = (val: number) => Math.sin(val) * 0.5 + 0.5

const distortions: Record<string, { uniforms: Record<string, { value: unknown }>; getDistortion: string; getJS?: (p: number, t: number) => THREE.Vector3 }> = {
  mountainDistortion: {
    uniforms: mountainUniforms,
    getDistortion: `uniform vec3 uAmp;uniform vec3 uFreq;
#define PI 3.14159265358979
float nsin(float val){return sin(val)*0.5+0.5;}
vec3 getDistortion(float progress){
  float f=0.02;
  return vec3(
    cos(progress*PI*uFreq.x+uTime)*uAmp.x-cos(f*PI*uFreq.x+uTime)*uAmp.x,
    nsin(progress*PI*uFreq.y+uTime)*uAmp.y-nsin(f*PI*uFreq.y+uTime)*uAmp.y,
    nsin(progress*PI*uFreq.z+uTime)*uAmp.z-nsin(f*PI*uFreq.z+uTime)*uAmp.z
  );
}`,
    getJS: (p, t) => {
      const f = 0.02, u = mountainUniforms
      const d = new THREE.Vector3(
        Math.cos(p*Math.PI*u.uFreq.value.x+t)*u.uAmp.value.x - Math.cos(f*Math.PI*u.uFreq.value.x+t)*u.uAmp.value.x,
        nsin(p*Math.PI*u.uFreq.value.y+t)*u.uAmp.value.y - nsin(f*Math.PI*u.uFreq.value.y+t)*u.uAmp.value.y,
        nsin(p*Math.PI*u.uFreq.value.z+t)*u.uAmp.value.z - nsin(f*Math.PI*u.uFreq.value.z+t)*u.uAmp.value.z,
      )
      return d.multiply(new THREE.Vector3(2,2,2)).add(new THREE.Vector3(0,0,-5))
    },
  },
  xyDistortion: {
    uniforms: xyUniforms,
    getDistortion: `uniform vec2 uFreq;uniform vec2 uAmp;
#define PI 3.14159265358979
vec3 getDistortion(float progress){
  float f=0.02;
  return vec3(
    cos(progress*PI*uFreq.x+uTime)*uAmp.x-cos(f*PI*uFreq.x+uTime)*uAmp.x,
    sin(progress*PI*uFreq.y+PI/2.+uTime)*uAmp.y-sin(f*PI*uFreq.y+PI/2.+uTime)*uAmp.y,
    0.
  );
}`,
    getJS: (p, t) => {
      const f = 0.02, u = xyUniforms
      const d = new THREE.Vector3(
        Math.cos(p*Math.PI*u.uFreq.value.x+t)*u.uAmp.value.x - Math.cos(f*Math.PI*u.uFreq.value.x+t)*u.uAmp.value.x,
        Math.sin(p*Math.PI*u.uFreq.value.y+t+Math.PI/2)*u.uAmp.value.y - Math.sin(f*Math.PI*u.uFreq.value.y+t+Math.PI/2)*u.uAmp.value.y,
        0,
      )
      return d.multiply(new THREE.Vector3(2,0.4,1)).add(new THREE.Vector3(0,0,-3))
    },
  },
  LongRaceDistortion: {
    uniforms: LongRaceUniforms,
    getDistortion: `uniform vec2 uFreq;uniform vec2 uAmp;
#define PI 3.14159265358979
vec3 getDistortion(float progress){
  float c=0.0125;
  return vec3(
    sin(progress*PI*uFreq.x+uTime)*uAmp.x-sin(c*PI*uFreq.x+uTime)*uAmp.x,
    sin(progress*PI*uFreq.y+uTime)*uAmp.y-sin(c*PI*uFreq.y+uTime)*uAmp.y,
    0.
  );
}`,
    getJS: (p, t) => {
      const c = 0.0125, u = LongRaceUniforms
      const d = new THREE.Vector3(
        Math.sin(p*Math.PI*u.uFreq.value.x+t)*u.uAmp.value.x - Math.sin(c*Math.PI*u.uFreq.value.x+t)*u.uAmp.value.x,
        Math.sin(p*Math.PI*u.uFreq.value.y+t)*u.uAmp.value.y - Math.sin(c*Math.PI*u.uFreq.value.y+t)*u.uAmp.value.y,
        0,
      )
      return d.multiply(new THREE.Vector3(1,1,0)).add(new THREE.Vector3(0,0,-5))
    },
  },
  turbulentDistortion: {
    uniforms: turbulentUniforms,
    getDistortion: `uniform vec4 uFreq;uniform vec4 uAmp;
float nsin(float val){return sin(val)*0.5+0.5;}
#define PI 3.14159265358979
float getDistortionX(float p){
  return cos(PI*p*uFreq.r+uTime)*uAmp.r+pow(cos(PI*p*uFreq.g+uTime*(uFreq.g/uFreq.r)),2.)*uAmp.g;
}
float getDistortionY(float p){
  return -nsin(PI*p*uFreq.b+uTime)*uAmp.b-pow(nsin(PI*p*uFreq.a+uTime/(uFreq.b/uFreq.a)),5.)*uAmp.a;
}
vec3 getDistortion(float progress){
  return vec3(getDistortionX(progress)-getDistortionX(0.0125),getDistortionY(progress)-getDistortionY(0.0125),0.);
}`,
    getJS: (p, t) => {
      const u = turbulentUniforms
      const getX = (v: number) => Math.cos(Math.PI*v*u.uFreq.value.x+t)*u.uAmp.value.x + Math.pow(Math.cos(Math.PI*v*u.uFreq.value.y+t*(u.uFreq.value.y/u.uFreq.value.x)),2)*u.uAmp.value.y
      const getY = (v: number) => -nsin(Math.PI*v*u.uFreq.value.z+t)*u.uAmp.value.z - Math.pow(nsin(Math.PI*v*u.uFreq.value.w+t/(u.uFreq.value.z/u.uFreq.value.w)),5)*u.uAmp.value.w
      const d = new THREE.Vector3(getX(p)-getX(p+0.007), getY(p)-getY(p+0.007), 0)
      return d.multiply(new THREE.Vector3(-2,-5,0)).add(new THREE.Vector3(0,0,-10))
    },
  },
  deepDistortion: {
    uniforms: deepUniforms,
    getDistortion: `uniform vec2 uFreq;uniform vec2 uAmp;uniform vec2 uPowY;
float nsin(float val){return sin(val)*0.5+0.5;}
#define PI 3.14159265358979
float getDistortionX(float p){return sin(p*PI*uFreq.x+uTime)*uAmp.x;}
float getDistortionY(float p){return pow(abs(p*uPowY.x),uPowY.y)+sin(p*PI*uFreq.y+uTime)*uAmp.y;}
vec3 getDistortion(float progress){
  return vec3(getDistortionX(progress)-getDistortionX(0.02),getDistortionY(progress)-getDistortionY(0.02),0.);
}`,
    getJS: (p, t) => {
      const u = deepUniforms
      const getX = (v: number) => Math.sin(v*Math.PI*u.uFreq.value.x+t)*u.uAmp.value.x
      const getY = (v: number) => Math.pow(v*u.uPowY.value.x, u.uPowY.value.y) + Math.sin(v*Math.PI*u.uFreq.value.y+t)*u.uAmp.value.y
      const d = new THREE.Vector3(getX(p)-getX(p+0.01), getY(p)-getY(p+0.01), 0)
      return d.multiply(new THREE.Vector3(-2,-4,0)).add(new THREE.Vector3(0,0,-10))
    },
  },
}

// ─── Shaders ────────────────────────────────────────────────────────────────

const roadVertex = `
#define USE_FOG;
uniform float uTime;
${THREE.ShaderChunk["fog_pars_vertex"]}
uniform float uTravelLength;
varying vec2 vUv;
#include <getDistortion_vertex>
void main(){
  vec3 transformed=position.xyz;
  vec3 distortion=getDistortion((transformed.y+uTravelLength/2.)/uTravelLength);
  transformed.x+=distortion.x;transformed.z+=distortion.y;transformed.y+=-1.*distortion.z;
  vec4 mvPosition=modelViewMatrix*vec4(transformed,1.);
  gl_Position=projectionMatrix*mvPosition;
  vUv=uv;
  ${THREE.ShaderChunk["fog_vertex"]}
}`

const islandFragment = `
#define USE_FOG;
varying vec2 vUv;
uniform vec3 uColor;
uniform float uTime;
${THREE.ShaderChunk["fog_pars_fragment"]}
void main(){
  gl_FragColor=vec4(uColor,1.);
  ${THREE.ShaderChunk["fog_fragment"]}
}`

const roadFragment = `
#define USE_FOG;
varying vec2 vUv;
uniform vec3 uColor;
uniform float uTime;
uniform float uLanes;
uniform vec3 uBrokenLinesColor;
uniform vec3 uShoulderLinesColor;
uniform float uShoulderLinesWidthPercentage;
uniform float uBrokenLinesLengthPercentage;
uniform float uBrokenLinesWidthPercentage;
${THREE.ShaderChunk["fog_pars_fragment"]}
void main(){
  vec2 uv=vUv;
  uv.y=mod(uv.y+uTime*0.05,1.);
  vec3 color=vec3(uColor);
  float laneWidth=1.0/uLanes;
  float brokenLineWidth=laneWidth*uBrokenLinesWidthPercentage;
  float laneEmptySpace=1.-uBrokenLinesLengthPercentage;
  float brokenLines=step(1.0-brokenLineWidth,fract(uv.x*2.0))*step(laneEmptySpace,fract(uv.y*10.0));
  float sideLines=step(1.0-brokenLineWidth,fract((uv.x-laneWidth*(uLanes-1.0))*2.0))+step(brokenLineWidth,uv.x);
  brokenLines=mix(brokenLines,sideLines,uv.x);
  gl_FragColor=vec4(color,1.);
  ${THREE.ShaderChunk["fog_fragment"]}
}`

const carLightsVertex = `
#define USE_FOG;
${THREE.ShaderChunk["fog_pars_vertex"]}
attribute vec3 aOffset;
attribute vec3 aMetrics;
attribute vec3 aColor;
uniform float uTravelLength;
uniform float uTime;
varying vec2 vUv;
varying vec3 vColor;
#include <getDistortion_vertex>
void main(){
  vec3 transformed=position.xyz;
  float radius=aMetrics.r;float myLength=aMetrics.g;float speed=aMetrics.b;
  transformed.xy*=radius;transformed.z*=myLength;
  transformed.z+=myLength-mod(uTime*speed+aOffset.z,uTravelLength);
  transformed.xy+=aOffset.xy;
  float progress=abs(transformed.z/uTravelLength);
  transformed.xyz+=getDistortion(progress);
  vec4 mvPosition=modelViewMatrix*vec4(transformed,1.);
  gl_Position=projectionMatrix*mvPosition;
  vUv=uv;vColor=aColor;
  ${THREE.ShaderChunk["fog_vertex"]}
}`

const carLightsFragment = `
#define USE_FOG;
${THREE.ShaderChunk["fog_pars_fragment"]}
varying vec3 vColor;
varying vec2 vUv;
uniform vec2 uFade;
void main(){
  float alpha=smoothstep(uFade.x,uFade.y,vUv.x);
  gl_FragColor=vec4(vColor,alpha);
  if(gl_FragColor.a<0.0001)discard;
  ${THREE.ShaderChunk["fog_fragment"]}
}`

const sideSticksVertex = `
#define USE_FOG;
${THREE.ShaderChunk["fog_pars_vertex"]}
attribute float aOffset;
attribute vec3 aColor;
attribute vec2 aMetrics;
uniform float uTravelLength;
uniform float uTime;
varying vec3 vColor;
mat4 rotationY(in float angle){return mat4(cos(angle),0,sin(angle),0,0,1,0,0,-sin(angle),0,cos(angle),0,0,0,0,1);}
#include <getDistortion_vertex>
void main(){
  vec3 transformed=position.xyz;
  float width=aMetrics.x;float height=aMetrics.y;
  transformed.xy*=vec2(width,height);
  float time=mod(uTime*60.*2.+aOffset,uTravelLength);
  transformed=(rotationY(3.14/2.)*vec4(transformed,1.)).xyz;
  transformed.z+=-uTravelLength+time;
  float progress=abs(transformed.z/uTravelLength);
  transformed.xyz+=getDistortion(progress);
  transformed.y+=height/2.;transformed.x+=-width/2.;
  vec4 mvPosition=modelViewMatrix*vec4(transformed,1.);
  gl_Position=projectionMatrix*mvPosition;
  vColor=aColor;
  ${THREE.ShaderChunk["fog_vertex"]}
}`

const sideSticksFragment = `
#define USE_FOG;
${THREE.ShaderChunk["fog_pars_fragment"]}
varying vec3 vColor;
void main(){
  gl_FragColor=vec4(vColor,1.);
  ${THREE.ShaderChunk["fog_fragment"]}
}`

// ─── Helpers ────────────────────────────────────────────────────────────────

const random = (base: number | [number, number]): number =>
  Array.isArray(base) ? Math.random() * (base[1] - base[0]) + base[0] : Math.random() * base

const pickRandom = <T,>(arr: T | T[]): T =>
  Array.isArray(arr) ? arr[Math.floor(Math.random() * arr.length)] : arr

const lerp = (current: number, target: number, speed = 0.1, limit = 0.001) => {
  let change = (target - current) * speed
  if (Math.abs(change) < limit) change = target - current
  return change
}

function resizeRendererToDisplaySize(renderer: THREE.WebGLRenderer, setSize: (w: number, h: number, s: boolean) => void) {
  const canvas = renderer.domElement
  const w = canvas.clientWidth, h = canvas.clientHeight
  if (w <= 0 || h <= 0) return false
  if (canvas.width !== w || canvas.height !== h) setSize(w, h, false)
  return canvas.width !== w || canvas.height !== h
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HyperspeedOptions {
  onSpeedUp?: (e: Event) => void
  onSlowDown?: (e: Event) => void
  distortion?: string
  length?: number
  roadWidth?: number
  islandWidth?: number
  lanesPerRoad?: number
  fov?: number
  fovSpeedUp?: number
  speedUp?: number
  carLightsFade?: number
  totalSideLightSticks?: number
  lightPairsPerRoadWay?: number
  shoulderLinesWidthPercentage?: number
  brokenLinesWidthPercentage?: number
  brokenLinesLengthPercentage?: number
  lightStickWidth?: [number, number]
  lightStickHeight?: [number, number]
  movingAwaySpeed?: [number, number]
  movingCloserSpeed?: [number, number]
  carLightsLength?: [number, number]
  carLightsRadius?: [number, number]
  carWidthPercentage?: [number, number]
  carShiftX?: [number, number]
  carFloorSeparation?: [number, number]
  colors?: {
    roadColor?: number
    islandColor?: number
    background?: number
    shoulderLines?: number
    brokenLines?: number
    leftCars?: number[]
    rightCars?: number[]
    sticks?: number
  }
}

const DEFAULT_OPTIONS: Required<HyperspeedOptions> = {
  onSpeedUp: () => {},
  onSlowDown: () => {},
  distortion: "turbulentDistortion",
  length: 400,
  roadWidth: 10,
  islandWidth: 2,
  lanesPerRoad: 3,
  fov: 90,
  fovSpeedUp: 150,
  speedUp: 2,
  carLightsFade: 0.4,
  totalSideLightSticks: 20,
  lightPairsPerRoadWay: 40,
  shoulderLinesWidthPercentage: 0.05,
  brokenLinesWidthPercentage: 0.1,
  brokenLinesLengthPercentage: 0.5,
  lightStickWidth: [0.12, 0.5],
  lightStickHeight: [1.3, 1.7],
  movingAwaySpeed: [60, 80],
  movingCloserSpeed: [-120, -160],
  carLightsLength: [400 * 0.03, 400 * 0.2],
  carLightsRadius: [0.05, 0.14],
  carWidthPercentage: [0.3, 0.5],
  carShiftX: [-0.8, 0.8],
  carFloorSeparation: [0, 5],
  colors: {
    roadColor: 0x080808,
    islandColor: 0x0a0a0a,
    background: 0x000000,
    shoulderLines: 0x131318,
    brokenLines: 0x131318,
    leftCars: [0xd856bf, 0x6750a2, 0xc247ac],
    rightCars: [0x03b3c3, 0x0e5ea5, 0x324555],
    sticks: 0x03b3c3,
  },
}

// ─── App class ───────────────────────────────────────────────────────────────

type DistortionObject = { uniforms: Record<string, { value: unknown }>; getDistortion: string; getJS?: (p: number, t: number) => THREE.Vector3 }
type ResolvedOptions = Omit<Required<HyperspeedOptions>, 'distortion'> & { distortion: DistortionObject }

class App {
  options: ResolvedOptions
  container: HTMLElement
  renderer: THREE.WebGLRenderer
  composer: EffectComposer
  camera: THREE.PerspectiveCamera
  scene: THREE.Scene
  fogUniforms: Record<string, { value: unknown }>
  clock: THREE.Clock
  disposed: boolean
  hasValidSize: boolean
  road!: Road
  leftCarLights!: CarLights
  rightCarLights!: CarLights
  leftSticks!: LightsSticks
  fovTarget: number
  speedUpTarget: number
  speedUp: number
  timeOffset: number
  renderPass!: RenderPass
  bloomPass!: EffectPass

  constructor(container: HTMLElement, options: Required<HyperspeedOptions>) {
    const distortion = distortions[options.distortion as string] ?? distortions.turbulentDistortion
    this.options = { ...options, distortion } as ResolvedOptions
    this.container = container
    this.hasValidSize = false
    const w = Math.max(1, container.offsetWidth)
    const h = Math.max(1, container.offsetHeight)
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    this.renderer.setSize(w, h, false)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.composer = new EffectComposer(this.renderer)
    container.append(this.renderer.domElement)
    this.camera = new THREE.PerspectiveCamera(options.fov, w / h, 0.1, 10000)
    this.camera.position.set(0, 8, -5)
    this.scene = new THREE.Scene()
    this.scene.background = null
    const fog = new THREE.Fog(options.colors.background!, options.length * 0.2, options.length * 500)
    this.scene.fog = fog
    this.fogUniforms = {
      fogColor: { value: fog.color },
      fogNear: { value: fog.near },
      fogFar: { value: fog.far },
    }
    this.clock = new THREE.Clock()
    this.disposed = false
    this.fovTarget = options.fov
    this.speedUpTarget = 0
    this.speedUp = 0
    this.timeOffset = 0
    this.tick = this.tick.bind(this)
    this.init = this.init.bind(this)
    this.setSize = this.setSize.bind(this)
    this.onMouseDown = this.onMouseDown.bind(this)
    this.onMouseUp = this.onMouseUp.bind(this)
    this.onTouchStart = this.onTouchStart.bind(this)
    this.onTouchEnd = this.onTouchEnd.bind(this)
    this.onWindowResize = this.onWindowResize.bind(this)
    window.addEventListener("resize", this.onWindowResize)
    if (w > 0 && h > 0) this.hasValidSize = true
  }

  onWindowResize() {
    const w = this.container.offsetWidth, h = this.container.offsetHeight
    if (w <= 0 || h <= 0) { this.hasValidSize = false; return }
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.composer.setSize(w, h)
    this.hasValidSize = true
  }

  initPasses() {
    this.renderPass = new RenderPass(this.scene, this.camera)
    this.bloomPass = new EffectPass(this.camera, new BloomEffect({ luminanceThreshold: 0.2, luminanceSmoothing: 0, resolutionScale: 1 }))
    const smaaPass = new EffectPass(this.camera, new SMAAEffect({ preset: SMAAPreset.MEDIUM }))
    this.renderPass.renderToScreen = false
    this.bloomPass.renderToScreen = false
    smaaPass.renderToScreen = true
    this.composer.addPass(this.renderPass)
    this.composer.addPass(this.bloomPass)
    this.composer.addPass(smaaPass)
  }

  init() {
    this.initPasses()
    const o = this.options
    this.road = new Road(this, o)
    this.leftCarLights = new CarLights(this, o, o.colors.leftCars!, o.movingAwaySpeed, new THREE.Vector2(0, 1 - o.carLightsFade))
    this.rightCarLights = new CarLights(this, o, o.colors.rightCars!, o.movingCloserSpeed, new THREE.Vector2(1, 0 + o.carLightsFade))
    this.leftSticks = new LightsSticks(this, o)
    this.road.init()
    this.leftCarLights.init()
    this.leftCarLights.mesh.position.setX(-o.roadWidth / 2 - o.islandWidth / 2)
    this.rightCarLights.init()
    this.rightCarLights.mesh.position.setX(o.roadWidth / 2 + o.islandWidth / 2)
    this.leftSticks.init()
    this.leftSticks.mesh.position.setX(-(o.roadWidth + o.islandWidth / 2))
    this.container.addEventListener("mousedown", this.onMouseDown)
    this.container.addEventListener("mouseup", this.onMouseUp)
    this.container.addEventListener("mouseout", this.onMouseUp)
    this.container.addEventListener("touchstart", this.onTouchStart, { passive: true })
    this.container.addEventListener("touchend", this.onTouchEnd, { passive: true })
    this.tick()
  }

  onMouseDown(ev: Event) { this.options.onSpeedUp(ev); this.fovTarget = this.options.fovSpeedUp; this.speedUpTarget = this.options.speedUp }
  onMouseUp(ev: Event) { this.options.onSlowDown(ev); this.fovTarget = this.options.fov; this.speedUpTarget = 0 }
  onTouchStart(ev: Event) { this.options.onSpeedUp(ev); this.fovTarget = this.options.fovSpeedUp; this.speedUpTarget = this.options.speedUp }
  onTouchEnd(ev: Event) { this.options.onSlowDown(ev); this.fovTarget = this.options.fov; this.speedUpTarget = 0 }

  update(delta: number) {
    const lp = Math.exp(-(-60 * Math.log2(1 - 0.1)) * delta)
    this.speedUp += lerp(this.speedUp, this.speedUpTarget, lp, 0.00001)
    this.timeOffset += this.speedUp * delta
    const time = this.clock.elapsedTime + this.timeOffset
    this.rightCarLights.update(time)
    this.leftCarLights.update(time)
    this.leftSticks.update(time)
    this.road.update(time)
    let updateCamera = false
    const fovChange = lerp(this.camera.fov, this.fovTarget, lp)
    if (fovChange !== 0) { this.camera.fov += fovChange * delta * 6; updateCamera = true }
    if (this.options.distortion.getJS) {
      const d = this.options.distortion.getJS(0.025, time)
      this.camera.lookAt(new THREE.Vector3(this.camera.position.x + d.x, this.camera.position.y + d.y, this.camera.position.z + d.z))
      updateCamera = true
    }
    if (updateCamera) this.camera.updateProjectionMatrix()
  }

  render(delta: number) { this.composer.render(delta) }

  dispose() {
    this.disposed = true
    this.scene.traverse((obj) => {
      const o = obj as THREE.Mesh
      if (!o.isMesh) return
      o.geometry?.dispose()
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose())
      else (o.material as THREE.Material)?.dispose()
    })
    this.scene.clear()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.renderer.domElement.parentNode?.removeChild(this.renderer.domElement)
    this.composer.dispose()
    window.removeEventListener("resize", this.onWindowResize)
    this.container.removeEventListener("mousedown", this.onMouseDown)
    this.container.removeEventListener("mouseup", this.onMouseUp)
    this.container.removeEventListener("mouseout", this.onMouseUp)
    this.container.removeEventListener("touchstart", this.onTouchStart)
    this.container.removeEventListener("touchend", this.onTouchEnd)
  }

  setSize(w: number, h: number, s: boolean) {
    if (w <= 0 || h <= 0) { this.hasValidSize = false; return }
    this.composer.setSize(w, h, s)
    this.hasValidSize = true
  }

  tick() {
    if (this.disposed) return
    if (!this.hasValidSize) {
      const w = this.container.offsetWidth, h = this.container.offsetHeight
      if (w > 0 && h > 0) {
        this.renderer.setSize(w, h, false)
        this.camera.aspect = w / h
        this.camera.updateProjectionMatrix()
        this.composer.setSize(w, h)
        this.hasValidSize = true
      } else { requestAnimationFrame(this.tick); return }
    }
    resizeRendererToDisplaySize(this.renderer, this.setSize)
    const delta = this.clock.getDelta()
    this.render(delta)
    this.update(delta)
    requestAnimationFrame(this.tick)
  }
}

// ─── Road ────────────────────────────────────────────────────────────────────

class Road {
  webgl: App
  options: Required<HyperspeedOptions> & { distortion: typeof distortions[string] }
  uTime: { value: number }
  leftRoadWay!: THREE.Mesh
  rightRoadWay!: THREE.Mesh
  island!: THREE.Mesh

  constructor(webgl: App, options: typeof webgl.options) {
    this.webgl = webgl; this.options = options; this.uTime = { value: 0 }
  }

  createPlane(side: number, _width: number, isRoad: boolean) {
    const o = this.options
    const geometry = new THREE.PlaneGeometry(isRoad ? o.roadWidth : o.islandWidth, o.length, 20, 100)
    let uniforms: Record<string, { value: unknown }> = {
      uTravelLength: { value: o.length },
      uColor: { value: new THREE.Color(isRoad ? o.colors.roadColor : o.colors.islandColor) },
      uTime: this.uTime,
      ...this.webgl.fogUniforms,
      ...o.distortion.uniforms,
    }
    if (isRoad) {
      uniforms = { ...uniforms,
        uLanes: { value: o.lanesPerRoad },
        uBrokenLinesColor: { value: new THREE.Color(o.colors.brokenLines) },
        uShoulderLinesColor: { value: new THREE.Color(o.colors.shoulderLines) },
        uShoulderLinesWidthPercentage: { value: o.shoulderLinesWidthPercentage },
        uBrokenLinesLengthPercentage: { value: o.brokenLinesLengthPercentage },
        uBrokenLinesWidthPercentage: { value: o.brokenLinesWidthPercentage },
      }
    }
    const material = new THREE.ShaderMaterial({
      fragmentShader: isRoad ? roadFragment : islandFragment,
      vertexShader: roadVertex,
      side: THREE.DoubleSide,
      uniforms,
    })
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace("#include <getDistortion_vertex>", o.distortion.getDistortion)
    }
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.z = -o.length / 2
    mesh.position.x += (o.islandWidth / 2 + o.roadWidth / 2) * side
    this.webgl.scene.add(mesh)
    return mesh
  }

  init() {
    this.leftRoadWay = this.createPlane(-1, this.options.roadWidth, true)
    this.rightRoadWay = this.createPlane(1, this.options.roadWidth, true)
    this.island = this.createPlane(0, this.options.islandWidth, false)
  }

  update(time: number) { this.uTime.value = time }
}

// ─── CarLights ───────────────────────────────────────────────────────────────

class CarLights {
  webgl: App
  options: typeof App.prototype.options
  colors: number | number[]
  speed: [number, number]
  fade: THREE.Vector2
  mesh!: THREE.Mesh

  constructor(webgl: App, options: typeof webgl.options, colors: number | number[], speed: [number, number], fade: THREE.Vector2) {
    this.webgl = webgl; this.options = options; this.colors = colors; this.speed = speed; this.fade = fade
  }

  init() {
    const o = this.options
    const curve = new THREE.LineCurve3(new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1))
    const geometry = new THREE.TubeGeometry(curve, 40, 1, 8, false)
    const instanced = new THREE.InstancedBufferGeometry().copy(geometry)
    instanced.instanceCount = o.lightPairsPerRoadWay * 2
    const laneWidth = o.roadWidth / o.lanesPerRoad
    const aOffset: number[] = [], aMetrics: number[] = [], aColor: number[] = []
    let colors = Array.isArray(this.colors) ? this.colors.map(c => new THREE.Color(c)) : new THREE.Color(this.colors)
    for (let i = 0; i < o.lightPairsPerRoadWay; i++) {
      const radius = random(o.carLightsRadius)
      const length = random(o.carLightsLength)
      const speed = random(this.speed)
      const carLane = i % o.lanesPerRoad
      let laneX = carLane * laneWidth - o.roadWidth / 2 + laneWidth / 2
      laneX += random(o.carShiftX) * laneWidth
      const offsetY = random(o.carFloorSeparation) + radius * 1.3
      const offsetZ = -random(o.length)
      const carWidth = random(o.carWidthPercentage) * laneWidth
      aOffset.push(laneX - carWidth/2, offsetY, offsetZ, laneX + carWidth/2, offsetY, offsetZ)
      aMetrics.push(radius, length, speed, radius, length, speed)
      const color = pickRandom(colors) as THREE.Color
      aColor.push(color.r, color.g, color.b, color.r, color.g, color.b)
    }
    instanced.setAttribute("aOffset", new THREE.InstancedBufferAttribute(new Float32Array(aOffset), 3, false))
    instanced.setAttribute("aMetrics", new THREE.InstancedBufferAttribute(new Float32Array(aMetrics), 3, false))
    instanced.setAttribute("aColor", new THREE.InstancedBufferAttribute(new Float32Array(aColor), 3, false))
    const material = new THREE.ShaderMaterial({
      fragmentShader: carLightsFragment, vertexShader: carLightsVertex, transparent: true,
      uniforms: { uTime: { value: 0 }, uTravelLength: { value: o.length }, uFade: { value: this.fade }, ...this.webgl.fogUniforms, ...o.distortion.uniforms },
    })
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace("#include <getDistortion_vertex>", o.distortion.getDistortion)
    }
    this.mesh = new THREE.Mesh(instanced, material)
    this.mesh.frustumCulled = false
    this.webgl.scene.add(this.mesh)
  }

  update(time: number) { (this.mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = time }
}

// ─── LightsSticks ────────────────────────────────────────────────────────────

class LightsSticks {
  webgl: App
  options: typeof App.prototype.options
  mesh!: THREE.Mesh

  constructor(webgl: App, options: typeof webgl.options) { this.webgl = webgl; this.options = options }

  init() {
    const o = this.options
    const geometry = new THREE.PlaneGeometry(1, 1)
    const instanced = new THREE.InstancedBufferGeometry().copy(geometry)
    instanced.instanceCount = o.totalSideLightSticks
    const stickOffset = o.length / (o.totalSideLightSticks - 1)
    const aOffset: number[] = [], aColor: number[] = [], aMetrics: number[] = []
    let colors = Array.isArray(o.colors.sticks) ? (o.colors.sticks as number[]).map(c => new THREE.Color(c)) : new THREE.Color(o.colors.sticks)
    for (let i = 0; i < o.totalSideLightSticks; i++) {
      aOffset.push((i - 1) * stickOffset * 2 + stickOffset * Math.random())
      const color = pickRandom(colors) as THREE.Color
      aColor.push(color.r, color.g, color.b)
      aMetrics.push(random(o.lightStickWidth), random(o.lightStickHeight))
    }
    instanced.setAttribute("aOffset", new THREE.InstancedBufferAttribute(new Float32Array(aOffset), 1, false))
    instanced.setAttribute("aColor", new THREE.InstancedBufferAttribute(new Float32Array(aColor), 3, false))
    instanced.setAttribute("aMetrics", new THREE.InstancedBufferAttribute(new Float32Array(aMetrics), 2, false))
    const material = new THREE.ShaderMaterial({
      fragmentShader: sideSticksFragment, vertexShader: sideSticksVertex, side: THREE.DoubleSide,
      uniforms: { uTravelLength: { value: o.length }, uTime: { value: 0 }, ...this.webgl.fogUniforms, ...o.distortion.uniforms },
    })
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace("#include <getDistortion_vertex>", o.distortion.getDistortion)
    }
    this.mesh = new THREE.Mesh(instanced, material)
    this.mesh.frustumCulled = false
    this.webgl.scene.add(this.mesh)
  }

  update(time: number) { (this.mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = time }
}

// ─── React component ─────────────────────────────────────────────────────────

interface HyperspeedProps {
  effectOptions?: HyperspeedOptions
}

export default function Hyperspeed({ effectOptions = {} }: HyperspeedProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<App | null>(null)

  useEffect(() => {
    if (appRef.current) { appRef.current.dispose(); appRef.current = null }
    const container = containerRef.current
    if (!container) return

    const merged: Required<HyperspeedOptions> = {
      ...DEFAULT_OPTIONS,
      ...effectOptions,
      colors: { ...DEFAULT_OPTIONS.colors, ...effectOptions.colors },
    }

    const app = new App(container, merged)
    appRef.current = app
    app.init()

    return () => { app.dispose(); appRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "hidden" }}
    />
  )
}
