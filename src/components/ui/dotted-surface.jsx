import { cn } from '@/lib/utils'
import { useTheme } from '@/context/ThemeContext'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function DottedSurface({ className, forceDark = false, ...props }) {
  const { darkMode } = useTheme()
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const SEPARATION = 150
    const AMOUNTX = 40
    const AMOUNTY = 60

    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      1,
      10000,
    )
    camera.position.set(0, 355, 1220)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    // Build initial flat positions
    const posArray = []
    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        posArray.push(
          ix * SEPARATION - (AMOUNTX * SEPARATION) / 2,
          0,
          iy * SEPARATION - (AMOUNTY * SEPARATION) / 2,
        )
      }
    }

    const posAttr = new THREE.Float32BufferAttribute(posArray, 3)
    posAttr.setUsage(THREE.DynamicDrawUsage)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', posAttr)

    // Vertex colors: Three.js expects 0-1 range
    const dotBrightness = darkMode || forceDark ? 0.78 : 0.0
    const colorArray = new Float32Array(AMOUNTX * AMOUNTY * 3).fill(dotBrightness)
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorArray, 3))

    const material = new THREE.PointsMaterial({
      size: 8,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    let count = 0
    let rafId

    const animate = () => {
      rafId = requestAnimationFrame(animate)

      const pos = posAttr.array
      let i = 0
      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          pos[i * 3 + 1] =
            Math.sin((ix + count) * 0.3) * 50 +
            Math.sin((iy + count) * 0.5) * 50
          i++
        }
      }
      posAttr.needsUpdate = true
      renderer.render(scene, camera)
      count += 0.025
    }

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }

    window.addEventListener('resize', handleResize)
    animate()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(rafId)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [darkMode, forceDark])

  return (
    <div
      ref={containerRef}
      className={cn('pointer-events-none absolute inset-0 z-0', className)}
      {...props}
    />
  )
}
