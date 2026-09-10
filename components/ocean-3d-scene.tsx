'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Sliders, Eye, EyeOff, ExternalLink, ShieldCheck } from 'lucide-react'

type Location = {
  id: string
  name: string
  region: string
  code: string
  x?: number
  y?: number
  lat?: number
  lon?: number
}

type ProfilePoint = {
  depth: number
  temperature: number
  salinity?: number
}

type ArgoProfile = {
  id: string
  platform: string
  cycle: number
  date: string
  lat: number
  lon: number
  max_depth: number
  quality: string
}

type Ocean3DSceneProps = {
  selected: Location
  locations: Location[]
  onSelect: (loc: any) => void
  depth: number
  onDepthChange?: (depth: number) => void
  metric?: 'temperature' | 'salinity'
  onMetricChange?: (metric: 'temperature' | 'salinity') => void
  temperatureProfile?: ProfilePoint[]
  salinityProfile?: ProfilePoint[]
  argoProfiles?: ArgoProfile[]
  onViewProvenance?: (sourceKey: string, context?: any) => void
}

// Domain bounds
const LON_MIN = 45.0, LON_MAX = 105.0
const LAT_MIN = 5.0,  LAT_MAX = 30.0
const DEPTH_MAX = 1000.0

// Normalize to Three.js standard coordinates [-40, 40] x [-35, 0] x [-20, 20]
// X: Longitude [-40, 40] (East-West)
// Y: Depth [-35, 0] (Vertical downward: 0m at surface, -35 at 1000m)
// Z: Latitude [-20, 20] (North-South: North is -Z, South is +Z)
function toSceneCoords(lat: number, lon: number, depthM: number = 0): [number, number, number] {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN) - 0.5) * 80
  const y = -(depthM / DEPTH_MAX) * 35 // negative Y for depth downward into ocean
  const z = -((lat - LAT_MIN) / (LAT_MAX - LAT_MIN) - 0.5) * 40
  return [x, y, z]
}

// Colormap helpers with high luminance & vivid saturation
function getTemperatureColor(temp: number): THREE.Color {
  const norm = Math.max(0, Math.min(1, (temp - 5) / 25))
  if (norm < 0.5) {
    const t = norm * 2
    return new THREE.Color().setRGB(
      THREE.MathUtils.lerp(0.18, 1.0, t),
      THREE.MathUtils.lerp(0.88, 0.86, t),
      THREE.MathUtils.lerp(0.82, 0.45, t)
    )
  } else {
    const t = (norm - 0.5) * 2
    return new THREE.Color().setRGB(
      THREE.MathUtils.lerp(1.0, 1.0, t),
      THREE.MathUtils.lerp(0.86, 0.35, t),
      THREE.MathUtils.lerp(0.45, 0.4, t)
    )
  }
}

function getSalinityColor(sal: number): THREE.Color {
  const norm = Math.max(0, Math.min(1, (sal - 32) / 5))
  return new THREE.Color().setHSL(0.62 - norm * 0.35, 0.95, 0.6)
}

// Helper: 3D Text Billboard Sprite for Depth & Coordinate Markers
function createTextSprite(text: string, color: string = '#38bdf8', fontSize: number = 22): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 70
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = 'rgba(6, 25, 36, 0.85)'
    ctx.roundRect(4, 4, 312, 62, 8)
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.roundRect(4, 4, 312, 62, 8)
    ctx.stroke()

    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 160, 35)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(13.5, 3.2, 1)
  return sprite
}

export function Ocean3DScene({
  selected,
  locations,
  onSelect,
  depth,
  onDepthChange,
  metric = 'temperature',
  onMetricChange,
  temperatureProfile = [],
  salinityProfile = [],
  argoProfiles = [],
  onViewProvenance,
}: Ocean3DSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [advancedView, setAdvancedView] = useState(false)
  const [inspectedPoint, setInspectedPoint] = useState<{
    lat: number
    lon: number
    depth: number
    value: number | null
    unit: string
    source: string
    sourceKey: string
    type: '🟢 OBSERVED' | '🔵 MODEL / REANALYSIS' | '🟡 AI RECONSTRUCTED'
    date?: string
  } | null>(null)

  const [cameraPreset, setCameraPreset] = useState<'3d' | 'top' | 'side'>('3d')

  // Scene references
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const depthPlaneRef = useRef<THREE.Mesh | null>(null)
  const profileGroupRef = useRef<THREE.Group | null>(null)
  const argoGroupRef = useRef<THREE.Group | null>(null)
  const advancedGroupRef = useRef<THREE.Group | null>(null)
  const pointerDownPos = useRef({ x: 0, y: 0 })

  // Set Camera View Presets
  const setView = (view: '3d' | 'top' | 'side') => {
    setCameraPreset(view)
    if (!cameraRef.current || !controlsRef.current) return

    // Explicitly lock Y-axis as vertical
    cameraRef.current.up.set(0, 1, 0)

    if (view === '3d') {
      cameraRef.current.position.set(0, 68, 120)
      controlsRef.current.target.set(0, -10, 0)
    } else if (view === 'top') {
      cameraRef.current.position.set(0.001, 110, 0.001)
      controlsRef.current.target.set(0, -10, 0)
    } else if (view === 'side') {
      cameraRef.current.position.set(0, 5, 110)
      controlsRef.current.target.set(0, -10, 0)
    }

    controlsRef.current.update()
  }

  // Zoom controls
  const handleZoom = (delta: number) => {
    if (!cameraRef.current || !controlsRef.current) return
    const dir = new THREE.Vector3().subVectors(cameraRef.current.position, controlsRef.current.target).normalize()
    cameraRef.current.position.addScaledVector(dir, delta)
    controlsRef.current.update()
  }

  // Reset function for the 3D view: upright isometric block with perfect zoom
  const handleReset = () => {
    if (!cameraRef.current || !controlsRef.current) return
    // Explicitly lock Y-axis as vertical
    cameraRef.current.up.set(0, 1, 0)
    // Set default camera position and control target for optimal zoom framing
    cameraRef.current.position.set(0, 68, 120)
    controlsRef.current.target.set(0, -10, 0)
    // Call controls.update() immediately
    controlsRef.current.update()
    setCameraPreset('3d')
  }

  // Sync Advanced Group Visibility
  useEffect(() => {
    if (advancedGroupRef.current) {
      advancedGroupRef.current.visible = advancedView
    }
  }, [advancedView])

  // Initialize Three.js scene & OrbitControls
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth || 800
    const height = container.clientHeight || 560

    // 1. Scene with Deep Oceanic Atmosphere
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a2230)
    scene.fog = new THREE.Fog(0x0a2230, 180, 420)
    sceneRef.current = scene

    // 2. Camera with explicit vertical Y-axis lock and upright perspective
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.up.set(0, 1, 0)             // Lock Y-axis as vertical
    camera.position.set(0, 68, 120)    // Perfectly framed upright isometric zoom
    cameraRef.current = camera

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    rendererRef.current = renderer
    container.appendChild(renderer.domElement)

    // 4. OrbitControls with strict configuration & optimal distance limits
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.maxPolarAngle = Math.PI / 2 - 0.01  // Prevent going below horizontal plane
    controls.minPolarAngle = 0.05                // Prevent top zenith flip
    controls.minDistance = 25
    controls.maxDistance = 250
    controls.target.set(0, -10, 0)               // Center of ocean volume bounding box
    controls.update()
    controlsRef.current = controls

    // 5. Illumination Rig
    const ambientLight = new THREE.AmbientLight(0xe0f7fa, 1.4)
    scene.add(ambientLight)

    const hemiLight = new THREE.HemisphereLight(0x7ee7dc, 0x103042, 1.4)
    hemiLight.position.set(0, 80, 0)
    scene.add(hemiLight)

    const keySunLight = new THREE.DirectionalLight(0xffffff, 2.0)
    keySunLight.position.set(60, 120, 80)
    scene.add(keySunLight)

    const subsurfaceFillLight = new THREE.DirectionalLight(0x38bdf8, 1.3)
    subsurfaceFillLight.position.set(-60, -60, -60)
    scene.add(subsurfaceFillLight)

    // 6. ADVANCED GROUP: Contains technical wireframes, surface grids, and corner badges
    const advancedGroup = new THREE.Group()
    advancedGroup.visible = false
    advancedGroupRef.current = advancedGroup
    scene.add(advancedGroup)

    // Neon Bounding Box Volume (80 x 35 x 40)
    const boxGeo = new THREE.BoxGeometry(80, 35, 40)
    const wireframeGeo = new THREE.WireframeGeometry(boxGeo)
    const boxLine = new THREE.LineSegments(
      wireframeGeo,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 })
    )
    boxLine.position.set(0, -17.5, 0)
    advancedGroup.add(boxLine)

    // Horizontal Surface Grid (Advanced View Only)
    const gridHelper = new THREE.GridHelper(80, 8, 0x2dd4bf, 0x164654)
    gridHelper.position.set(0, 0, 0)
    advancedGroup.add(gridHelper)

    // Corner Coordinate Badges (Advanced View Only)
    const cornerBadges = [
      { text: '45°E, 5°N (SW)', pos: [-40, 1.5, 20] as [number, number, number] },
      { text: '105°E, 5°N (SE)', pos: [40, 1.5, 20] as [number, number, number] },
      { text: '45°E, 30°N (NW)', pos: [-40, 1.5, -20] as [number, number, number] },
      { text: '105°E, 30°N (NE)', pos: [40, 1.5, -20] as [number, number, number] },
    ]
    cornerBadges.forEach((b) => {
      const sprite = createTextSprite(b.text, '#2dd4bf', 18)
      sprite.position.set(...b.pos)
      advancedGroup.add(sprite)
    })

    // 7. CLEAN DEFAULT DEPTH STRATA MARKERS (Surface, 50m, 100m, 200m, 500m, 1000m)
    const strataDepths = [
      { depth: 0, color: 0x2dd4bf, opacity: 0.95, label: 'Surface (0 m)' },
      { depth: 50, color: 0x34d399, opacity: 0.75, label: 'Euphotic (50 m)' },
      { depth: 100, color: 0xfbbf24, opacity: 0.85, label: 'Thermocline (100 m)' },
      { depth: 200, color: 0x38bdf8, opacity: 0.7, label: 'Epipelagic (200 m)' },
      { depth: 500, color: 0x60a5fa, opacity: 0.65, label: 'Mesopelagic (500 m)' },
      { depth: 1000, color: 0x818cf8, opacity: 0.85, label: 'Deep Ocean (1000 m)' },
    ]

    strataDepths.forEach((strata) => {
      const yPos = -(strata.depth / DEPTH_MAX) * 35

      // Perimeter line for strata boundary in X-Z plane
      const gridPlaneGeo = new THREE.BufferGeometry()
      const pts = [
        new THREE.Vector3(-40, yPos, 20),
        new THREE.Vector3(40, yPos, 20),
        new THREE.Vector3(40, yPos, -20),
        new THREE.Vector3(-40, yPos, -20),
        new THREE.Vector3(-40, yPos, 20),
      ]
      gridPlaneGeo.setFromPoints(pts)
      const line = new THREE.Line(
        gridPlaneGeo,
        new THREE.LineBasicMaterial({ color: strata.color, transparent: true, opacity: strata.opacity * 0.5 })
      )
      scene.add(line)

      // 3D Depth Sprite Marker along corner vertical pillar
      const depthSprite = createTextSprite(strata.label, `#${strata.color.toString(16).padStart(6, '0')}`, 20)
      depthSprite.position.set(-44, yPos, 21)
      scene.add(depthSprite)
    })

    // 8. Active Depth Slice Plane (Smooth Horizontal Cutting Plane synced to depth slider)
    const sliceGeo = new THREE.PlaneGeometry(80, 40)
    const sliceMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const sliceMesh = new THREE.Mesh(sliceGeo, sliceMat)
    sliceMesh.rotation.x = -Math.PI / 2 // Lie horizontally in X-Z
    sliceMesh.position.set(0, -(depth / DEPTH_MAX) * 35, 0)
    depthPlaneRef.current = sliceMesh
    scene.add(sliceMesh)

    // Slice plane border line (glowing neon cyan border)
    const sliceBorderGeo = new THREE.BufferGeometry()
    sliceBorderGeo.setFromPoints([
      new THREE.Vector3(-40, 0, -20),
      new THREE.Vector3(40, 0, -20),
      new THREE.Vector3(40, 0, 20),
      new THREE.Vector3(-40, 0, 20),
      new THREE.Vector3(-40, 0, -20),
    ])
    const sliceBorder = new THREE.Line(
      sliceBorderGeo,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95 })
    )
    sliceMesh.add(sliceBorder)

    // Groups for dynamic points
    const profileGroup = new THREE.Group()
    profileGroupRef.current = profileGroup
    scene.add(profileGroup)

    const argoGroup = new THREE.Group()
    argoGroupRef.current = argoGroup
    scene.add(argoGroup)

    // Animation Loop
    let animId: number
    const animate = () => {
      animId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Resize Observer
    const resizeObserver = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      const h = entry.contentRect.height
      if (w > 0 && h > 0) {
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }
    })
    resizeObserver.observe(container)

    return () => {
      cancelAnimationFrame(animId)
      resizeObserver.disconnect()
      controls.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  // Update Depth Slice Plane position when slider changes
  useEffect(() => {
    if (depthPlaneRef.current) {
      const yPos = -(depth / DEPTH_MAX) * 35
      depthPlaneRef.current.position.y = yPos
    }
  }, [depth])

  // Render Selected Location Vertical Water Column & Profile Points
  useEffect(() => {
    const group = profileGroupRef.current
    if (!group) return

    while (group.children.length > 0) {
      const obj = group.children[0]
      group.remove(obj)
    }

    const lat = selected.lat ?? 8.5
    const lon = selected.lon ?? 74.2
    const [scX, , scZ] = toSceneCoords(lat, lon, 0)

    // 1. Vertical profile guide pillar from surface to -1000m
    const pillarGeo = new THREE.BufferGeometry()
    pillarGeo.setFromPoints([
      new THREE.Vector3(scX, 0, scZ),
      new THREE.Vector3(scX, -35, scZ),
    ])
    const pillarLine = new THREE.Line(
      pillarGeo,
      new THREE.LineDashedMaterial({
        color: 0x2dd4bf,
        dashSize: 1.5,
        gapSize: 0.8,
        transparent: true,
        opacity: 0.95,
      })
    )
    pillarLine.computeLineDistances()
    group.add(pillarLine)

    // 2. Surface beacon marker + Halo Ring
    const beaconGeo = new THREE.SphereGeometry(2.2, 20, 20)
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x2dd4bf,
      emissiveIntensity: 1.0,
      roughness: 0.2,
    })
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat)
    beaconMesh.position.set(scX, 0, scZ)
    group.add(beaconMesh)

    // Pulsing halo ring on surface (in X-Z plane)
    const haloGeo = new THREE.RingGeometry(2.6, 3.6, 32)
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x63d9d0,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    })
    const haloMesh = new THREE.Mesh(haloGeo, haloMat)
    haloMesh.rotation.x = -Math.PI / 2
    haloMesh.position.set(scX, 0.05, scZ)
    group.add(haloMesh)

    // Local Beacon PointLight
    const beaconLight = new THREE.PointLight(0x2dd4bf, 2.5, 35)
    beaconLight.position.set(scX, 2, scZ)
    group.add(beaconLight)

    // 3. Subsurface Depth Profile Beads (Model & Reanalysis with Provenance)
    const profile = metric === 'temperature' ? temperatureProfile : salinityProfile
    if (profile && profile.length > 0) {
      profile.forEach((pt) => {
        const [, scY, ] = toSceneCoords(lat, lon, pt.depth)
        const val = metric === 'temperature' ? pt.temperature : (pt.salinity ?? 35)
        const color = metric === 'temperature' ? getTemperatureColor(val) : getSalinityColor(val)

        // Large, luminous depth beads with vibrant emission
        const beadGeo = new THREE.SphereGeometry(1.6, 16, 16)
        const beadMat = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.75,
          roughness: 0.15,
          metalness: 0.1,
        })
        const bead = new THREE.Mesh(beadGeo, beadMat)
        bead.position.set(scX, scY, scZ)
        bead.userData = {
          lat,
          lon,
          depth: pt.depth,
          value: val,
          unit: metric === 'temperature' ? '°C' : 'PSU',
          source: 'Copernicus GLORYS12V1 & OceanProfileNet AI',
          sourceKey: 'glorys',
          type: '🔵 MODEL / REANALYSIS',
          date: '2024-01-07',
        }
        group.add(bead)
      })
    }
  }, [selected, metric, temperatureProfile, salinityProfile])

  // Render Argo Profile Pillars across Indian Ocean
  useEffect(() => {
    const group = argoGroupRef.current
    if (!group) return

    while (group.children.length > 0) {
      group.remove(group.children[0])
    }

    argoProfiles.slice(0, 150).forEach((argo) => {
      const [ax, , az] = toSceneCoords(argo.lat, argo.lon, 0)
      const maxY = -(Math.min(1000, argo.max_depth) / DEPTH_MAX) * 35

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(ax, 0, az),
        new THREE.Vector3(ax, maxY, az),
      ])
      const line = new THREE.Line(
        lineGeo,
        new THREE.LineBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.85 })
      )
      group.add(line)

      // Argo surface buoy (vibrant gold cylinder)
      const floatGeo = new THREE.CylinderGeometry(1.2, 1.2, 2.0, 12)
      const floatMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.7,
        roughness: 0.3,
      })
      const floatMesh = new THREE.Mesh(floatGeo, floatMat)
      floatMesh.position.set(ax, 0, az)
      floatMesh.userData = {
        lat: argo.lat,
        lon: argo.lon,
        depth: argo.max_depth,
        value: null,
        unit: '',
        source: `Global Argo GDAC float ${argo.platform} (Cycle ${argo.cycle})`,
        sourceKey: 'argo',
        type: '🟢 OBSERVED',
        date: argo.date,
      }
      group.add(floatMesh)
    })
  }, [argoProfiles])

  // Click Raycaster for Point Inspection (distinguishing click from orbit drag)
  const handlePointerDown = (e: React.PointerEvent) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const dx = Math.abs(e.clientX - pointerDownPos.current.x)
    const dy = Math.abs(e.clientY - pointerDownPos.current.y)
    if (dx > 6 || dy > 6) return // User was orbiting, not clicking

    const container = mountRef.current
    if (!container || !cameraRef.current || !sceneRef.current) return

    const rect = container.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, cameraRef.current)

    const interactables = [
      ...(profileGroupRef.current?.children ?? []),
      ...(argoGroupRef.current?.children ?? []),
    ]
    const intersects = raycaster.intersectObjects(interactables, false)

    if (intersects.length > 0 && intersects[0].object.userData.source) {
      setInspectedPoint(intersects[0].object.userData as any)
    }
  }

  return (
    <div
      className="ocean-3d-wrapper"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '560px',
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid #38bdf855',
      }}
    >
      {/* Three.js canvas mount */}
      <div
        ref={mountRef}
        style={{ width: '100%', height: '100%', cursor: 'grab' }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Top Left HUD: Clean Prominent Depth Indicator & Parameter Switcher */}
      <div style={{ position: 'absolute', top: '14px', left: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap', zIndex: 10, alignItems: 'center' }}>
        {/* Prominent Active Depth Indicator */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(8, 28, 38, 0.96) 0%, rgba(14, 116, 144, 0.4) 100%)',
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid #38bdf8',
            fontSize: '12px',
            color: '#f0fdfa',
            fontWeight: 700,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>CURRENT DEPTH:</span>
          <span style={{ color: '#38bdf8', fontSize: '14px' }}>{depth} m</span>
        </div>

        {/* Metric Selector (Temperature vs Salinity) */}
        {onMetricChange && (
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(8, 28, 38, 0.92)', padding: '4px', borderRadius: '8px', border: '1px solid #2d6b79', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
            <button
              style={{
                background: metric === 'temperature' ? '#2dd4bf' : 'transparent',
                color: metric === 'temperature' ? '#04151f' : '#94a3b8',
                border: 0,
                borderRadius: '5px',
                padding: '5px 11px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => onMetricChange('temperature')}
            >
              🌡️ Temperature (°C)
            </button>
            <button
              style={{
                background: metric === 'salinity' ? '#38bdf8' : 'transparent',
                color: metric === 'salinity' ? '#04151f' : '#94a3b8',
                border: 0,
                borderRadius: '5px',
                padding: '5px 11px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => onMetricChange('salinity')}
            >
              🧂 Salinity (PSU)
            </button>
          </div>
        )}
      </div>

      {/* Top Right HUD: ADVANCED VIEW Toggle & Camera Controls */}
      <div style={{ position: 'absolute', top: '14px', right: '14px', display: 'flex', gap: '6px', zIndex: 10, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
        {/* ADVANCED VIEW Toggle Button */}
        <button
          style={{
            background: advancedView ? '#38bdf8' : 'rgba(8, 28, 38, 0.92)',
            color: advancedView ? '#04151f' : '#e6f0f0',
            border: '1px solid #38bdf8',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
          onClick={() => setAdvancedView(!advancedView)}
          title="Toggle technical coordinate wireframes, surface grids, and projection presets"
        >
          {advancedView ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>{advancedView ? 'HIDE ADVANCED' : 'ADVANCED VIEW'}</span>
        </button>

        {/* Technical Presets: Shown only when Advanced View is active */}
        {advancedView && (
          <>
            <button
              style={{
                background: cameraPreset === '3d' ? '#38bdf8' : 'rgba(8, 28, 38, 0.9)',
                color: cameraPreset === '3d' ? '#04151f' : '#e6f0f0',
                border: '1px solid #2d6b79',
                borderRadius: '5px',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              onClick={() => setView('3d')}
            >
              3D
            </button>
            <button
              style={{
                background: cameraPreset === 'top' ? '#38bdf8' : 'rgba(8, 28, 38, 0.9)',
                color: cameraPreset === 'top' ? '#04151f' : '#e6f0f0',
                border: '1px solid #2d6b79',
                borderRadius: '5px',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              onClick={() => setView('top')}
            >
              Top (XZ)
            </button>
            <button
              style={{
                background: cameraPreset === 'side' ? '#38bdf8' : 'rgba(8, 28, 38, 0.9)',
                color: cameraPreset === 'side' ? '#04151f' : '#e6f0f0',
                border: '1px solid #2d6b79',
                borderRadius: '5px',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              onClick={() => setView('side')}
            >
              Section (XY)
            </button>
          </>
        )}

        <button
          style={{
            background: 'rgba(8, 28, 38, 0.9)',
            color: '#38bdf8',
            border: '1px solid #2d6b79',
            borderRadius: '5px',
            padding: '6px 9px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
          title="Zoom in"
          onClick={() => handleZoom(-15)}
        >
          +
        </button>
        <button
          style={{
            background: 'rgba(8, 28, 38, 0.9)',
            color: '#38bdf8',
            border: '1px solid #2d6b79',
            borderRadius: '5px',
            padding: '6px 9px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
          title="Zoom out"
          onClick={() => handleZoom(15)}
        >
          −
        </button>
        <button
          style={{
            background: 'rgba(8, 28, 38, 0.9)',
            color: '#e6f0f0',
            border: '1px solid #2d6b79',
            borderRadius: '5px',
            padding: '6px 10px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onClick={handleReset}
        >
          Reset View
        </button>
      </div>

      {/* Bottom Left HUD: High-Contrast Color Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: '14px',
          left: '14px',
          background: 'rgba(8, 28, 38, 0.94)',
          padding: '9px 14px',
          borderRadius: '7px',
          border: '1px solid #2d6b79',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 10,
          boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
        }}
      >
        <span><strong>{metric === 'temperature' ? 'Temperature (°C)' : 'Salinity (PSU)'}:</strong></span>
        {metric === 'temperature' ? (
          <>
            <span style={{ color: '#2dd4bf', fontWeight: 600 }}>5°C (Deep)</span>
            <span style={{ width: '48px', height: '8px', borderRadius: '4px', background: 'linear-gradient(90deg, #2dd4bf, #fde047, #ff4d5a)', display: 'inline-block' }} />
            <span style={{ color: '#ff4d5a', fontWeight: 600 }}>30°C (Surface)</span>
          </>
        ) : (
          <>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>32 PSU</span>
            <span style={{ width: '48px', height: '8px', borderRadius: '4px', background: 'linear-gradient(90deg, #38bdf8, #60a5fa, #c084fc)', display: 'inline-block' }} />
            <span style={{ color: '#c084fc', fontWeight: 600 }}>37 PSU</span>
          </>
        )}
        <span style={{ marginLeft: '10px', color: '#fde047', fontWeight: 600 }}>● Argo Floats (In-situ)</span>
        <span style={{ color: '#2dd4bf', fontWeight: 600 }}>◉ Selected Station</span>
      </div>

      {/* Interactive Point Inspection Tooltip with VIEW DATA SOURCE Button */}
      {inspectedPoint && (
        <div
          style={{
            position: 'absolute',
            bottom: '14px',
            right: '14px',
            background: 'rgba(6, 22, 31, 0.96)',
            border: '1px solid #38bdf8',
            borderRadius: '8px',
            padding: '14px 16px',
            maxWidth: '320px',
            fontSize: '11px',
            zIndex: 20,
            boxShadow: '0 8px 28px rgba(0,0,0,0.6)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '10px',
                padding: '3px 7px',
                borderRadius: '4px',
                background:
                  inspectedPoint.type.includes('OBSERVED')
                    ? 'rgba(34, 197, 94, 0.25)'
                    : inspectedPoint.type.includes('RECONSTRUCTED')
                    ? 'rgba(250, 204, 21, 0.25)'
                    : 'rgba(56, 189, 248, 0.25)',
                color:
                  inspectedPoint.type.includes('OBSERVED')
                    ? '#22c55e'
                    : inspectedPoint.type.includes('RECONSTRUCTED')
                    ? '#facc15'
                    : '#38bdf8',
                fontWeight: 'bold',
                letterSpacing: '0.04em',
                border: '1px solid currentColor',
              }}
            >
              {inspectedPoint.type}
            </span>
            <button
              style={{ background: 'transparent', border: 0, color: '#94a3b8', cursor: 'pointer', fontSize: '15px' }}
              onClick={() => setInspectedPoint(null)}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 8px', color: '#e6f0f0' }}>
            <span>Latitude:</span><strong>{inspectedPoint.lat.toFixed(3)}°N</strong>
            <span>Longitude:</span><strong>{inspectedPoint.lon.toFixed(3)}°E</strong>
            <span>Depth:</span><strong style={{ color: '#38bdf8' }}>{inspectedPoint.depth.toFixed(1)} m</strong>
            {inspectedPoint.value !== null && (
              <>
                <span>{metric === 'temperature' ? 'Temperature:' : 'Salinity:'}</span>
                <strong style={{ color: '#fde047' }}>{inspectedPoint.value.toFixed(2)} {inspectedPoint.unit}</strong>
              </>
            )}
            {inspectedPoint.date && (
              <>
                <span>Obs Date:</span><strong style={{ color: '#cbd5e1' }}>{inspectedPoint.date.slice(0, 10)}</strong>
              </>
            )}
          </div>
          <div style={{ borderTop: '1px solid #1f4e5c', marginTop: '8px', paddingTop: '6px', fontSize: '10px', color: '#94a3b8' }}>
            Source: {inspectedPoint.source}
          </div>

          {/* VIEW DATA SOURCE Button */}
          <button
            onClick={() => {
              if (onViewProvenance) {
                onViewProvenance(inspectedPoint.sourceKey || 'glorys', {
                  lat: inspectedPoint.lat,
                  lon: inspectedPoint.lon,
                  depth: inspectedPoint.depth,
                  value: inspectedPoint.value,
                  unit: inspectedPoint.unit,
                  name: inspectedPoint.source,
                  classification: inspectedPoint.type,
                })
              }
            }}
            style={{
              marginTop: '10px',
              width: '100%',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              border: '1px solid #38bdf8',
              borderRadius: '5px',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <ShieldCheck size={14} />
            <span>VIEW DATA SOURCE</span>
          </button>
        </div>
      )}
    </div>
  )
}
