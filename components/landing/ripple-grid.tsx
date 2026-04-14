"use client"

import { useRef, useEffect } from "react"
import { Renderer, Program, Triangle, Mesh } from "ogl"

interface RippleGridProps {
  enableRainbow?: boolean
  gridColor?: string
  rippleIntensity?: number
  gridSize?: number
  gridThickness?: number
  fadeDistance?: number
  vignetteStrength?: number
  glowIntensity?: number
  opacity?: number
  gridRotation?: number
  mouseInteraction?: boolean
  mouseInteractionRadius?: number
}

const vert = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`

const frag = `
precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform bool enableRainbow;
uniform vec3 gridColor;
uniform float rippleIntensity;
uniform float gridSize;
uniform float gridThickness;
uniform float fadeDistance;
uniform float vignetteStrength;
uniform float glowIntensity;
uniform float opacity;
uniform float gridRotation;
uniform bool mouseInteraction;
uniform vec2 mousePosition;
uniform float mouseInfluence;
uniform float mouseInteractionRadius;
varying vec2 vUv;

float pi = 3.141592;
mat2 rotate(float angle) {
  float s = sin(angle); float c = cos(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y;
  if (gridRotation != 0.0) uv = rotate(gridRotation * pi / 180.0) * uv;

  float dist = length(uv);
  float func = sin(pi * (iTime - dist));
  vec2 rippleUv = uv + uv * func * rippleIntensity;

  if (mouseInteraction && mouseInfluence > 0.0) {
    vec2 mouseUv = (mousePosition * 2.0 - 1.0);
    mouseUv.x *= iResolution.x / iResolution.y;
    float mouseDist = length(uv - mouseUv);
    float influence = mouseInfluence * exp(-mouseDist * mouseDist / (mouseInteractionRadius * mouseInteractionRadius));
    float mouseWave = sin(pi * (iTime * 2.0 - mouseDist * 3.0)) * influence;
    rippleUv += normalize(uv - mouseUv) * mouseWave * rippleIntensity * 0.3;
  }

  vec2 a = sin(gridSize * 0.5 * pi * rippleUv - pi / 2.0);
  vec2 b = abs(a);
  float aaWidth = 0.5;
  vec2 smoothB = vec2(smoothstep(0.0, aaWidth, b.x), smoothstep(0.0, aaWidth, b.y));

  vec3 color = vec3(0.0);
  color += exp(-gridThickness * smoothB.x * (0.8 + 0.5 * sin(pi * iTime)));
  color += exp(-gridThickness * smoothB.y);
  color += 0.5 * exp(-(gridThickness / 4.0) * sin(smoothB.x));
  color += 0.5 * exp(-(gridThickness / 3.0) * smoothB.y);
  if (glowIntensity > 0.0) {
    color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.x);
    color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.y);
  }

  float ddd = exp(-2.0 * clamp(pow(dist, fadeDistance), 0.0, 1.0));
  vec2 vignetteCoords = vUv - 0.5;
  float vignette = 1.0 - pow(length(vignetteCoords) * 2.0, vignetteStrength);
  vignette = clamp(vignette, 0.0, 1.0);

  vec3 t = enableRainbow
    ? vec3(uv.x * 0.5 + 0.5 * sin(iTime), uv.y * 0.5 + 0.5 * cos(iTime), pow(cos(iTime), 4.0)) + 0.5
    : gridColor;

  float finalFade = ddd * vignette;
  float alpha = length(color) * finalFade * opacity;
  gl_FragColor = vec4(color * t * finalFade * opacity, alpha);
}`

const hexToRgb = (hex: string): [number, number, number] => {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r
    ? [parseInt(r[1], 16) / 255, parseInt(r[2], 16) / 255, parseInt(r[3], 16) / 255]
    : [1, 1, 1]
}

export default function RippleGrid({
  enableRainbow = false,
  gridColor = "#ffffff",
  rippleIntensity = 0.05,
  gridSize = 10,
  gridThickness = 15,
  fadeDistance = 1.5,
  vignetteStrength = 2.0,
  glowIntensity = 0.1,
  opacity = 1.0,
  gridRotation = 0,
  mouseInteraction = true,
  mouseInteractionRadius = 1,
}: RippleGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mousePositionRef = useRef({ x: 0.5, y: 0.5 })
  const targetMouseRef = useRef({ x: 0.5, y: 0.5 })
  const mouseInfluenceRef = useRef(0)
  const uniformsRef = useRef<Record<string, { value: unknown }> | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 2), alpha: true })
    const gl = renderer.gl
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.canvas.style.width = "100%"
    gl.canvas.style.height = "100%"
    container.appendChild(gl.canvas)

    const uniforms: Record<string, { value: unknown }> = {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },
      enableRainbow: { value: enableRainbow },
      gridColor: { value: hexToRgb(gridColor) },
      rippleIntensity: { value: rippleIntensity },
      gridSize: { value: gridSize },
      gridThickness: { value: gridThickness },
      fadeDistance: { value: fadeDistance },
      vignetteStrength: { value: vignetteStrength },
      glowIntensity: { value: glowIntensity },
      opacity: { value: opacity },
      gridRotation: { value: gridRotation },
      mouseInteraction: { value: mouseInteraction },
      mousePosition: { value: [0.5, 0.5] },
      mouseInfluence: { value: 0 },
      mouseInteractionRadius: { value: mouseInteractionRadius },
    }
    uniformsRef.current = uniforms

    const geometry = new Triangle(gl)
    const program = new Program(gl, { vertex: vert, fragment: frag, uniforms })
    const mesh = new Mesh(gl, { geometry, program })

    const resize = () => {
      renderer.setSize(container.clientWidth, container.clientHeight)
      uniforms.iResolution.value = [container.clientWidth, container.clientHeight]
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      targetMouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: 1.0 - (e.clientY - rect.top) / rect.height,
      }
    }
    const handleMouseEnter = () => { mouseInfluenceRef.current = 1.0 }
    const handleMouseLeave = () => { mouseInfluenceRef.current = 0.0 }

    window.addEventListener("resize", resize)
    if (mouseInteraction) {
      container.addEventListener("mousemove", handleMouseMove)
      container.addEventListener("mouseenter", handleMouseEnter)
      container.addEventListener("mouseleave", handleMouseLeave)
    }
    resize()

    let animId: number
    const render = (t: number) => {
      animId = requestAnimationFrame(render)
      uniforms.iTime.value = t * 0.001
      const lf = 0.1
      mousePositionRef.current.x += (targetMouseRef.current.x - mousePositionRef.current.x) * lf
      mousePositionRef.current.y += (targetMouseRef.current.y - mousePositionRef.current.y) * lf
      const cur = uniforms.mouseInfluence.value as number
      uniforms.mouseInfluence.value = cur + (mouseInfluenceRef.current - cur) * 0.05
      uniforms.mousePosition.value = [mousePositionRef.current.x, mousePositionRef.current.y]
      renderer.render({ scene: mesh })
    }
    animId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", resize)
      if (mouseInteraction) {
        container.removeEventListener("mousemove", handleMouseMove)
        container.removeEventListener("mouseenter", handleMouseEnter)
        container.removeEventListener("mouseleave", handleMouseLeave)
      }
      renderer.gl.getExtension("WEBGL_lose_context")?.loseContext()
      if (container.contains(gl.canvas)) container.removeChild(gl.canvas)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!uniformsRef.current) return
    uniformsRef.current.enableRainbow.value = enableRainbow
    uniformsRef.current.gridColor.value = hexToRgb(gridColor)
    uniformsRef.current.rippleIntensity.value = rippleIntensity
    uniformsRef.current.gridSize.value = gridSize
    uniformsRef.current.gridThickness.value = gridThickness
    uniformsRef.current.fadeDistance.value = fadeDistance
    uniformsRef.current.vignetteStrength.value = vignetteStrength
    uniformsRef.current.glowIntensity.value = glowIntensity
    uniformsRef.current.opacity.value = opacity
    uniformsRef.current.gridRotation.value = gridRotation
    uniformsRef.current.mouseInteraction.value = mouseInteraction
    uniformsRef.current.mouseInteractionRadius.value = mouseInteractionRadius
  }, [enableRainbow, gridColor, rippleIntensity, gridSize, gridThickness, fadeDistance, vignetteStrength, glowIntensity, opacity, gridRotation, mouseInteraction, mouseInteractionRadius])

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
}
