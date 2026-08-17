import { useEffect, useRef } from 'react'

export type LightingPreviewLight = { id: string; name: string; yaw: number; pitch: number; intensity: number; temperatureK: number; enabled: boolean }
type Props = { imageUrl: string; lights: LightingPreviewLight[]; activeLightId: string; exposure: number; view: 'perspective' | 'front'; onSelectLight: (id: string) => void; onChange: (id: string, yaw: number, pitch: number) => void }
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export default function LightingSpherePreview(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const valuesRef = useRef(props)
  const renderRef = useRef<() => void>(() => undefined)
  valuesRef.current = props
  useEffect(() => renderRef.current(), [props.lights, props.activeLightId, props.exposure, props.view])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let cleanup = () => undefined
    void import('three').then((THREE) => {
      if (disposed) return
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(34, 1, .1, 100)
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
      renderer.setClearColor(0x000000, 0)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      host.replaceChildren(renderer.domElement)

      const ringMaterial = new THREE.LineBasicMaterial({ color: 0xd8dcdf, transparent: true, opacity: .09 })
      const makeRing = (axis: 'x' | 'y' | 'z') => new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(Array.from({ length: 128 }, (_, index) => {
          const angle = index / 128 * Math.PI * 2, a = Math.cos(angle) * 2.02, b = Math.sin(angle) * 2.02
          return axis === 'x' ? new THREE.Vector3(0, a, b) : axis === 'y' ? new THREE.Vector3(a, 0, b) : new THREE.Vector3(a, b, 0)
        })), ringMaterial.clone())
      scene.add(makeRing('x'), makeRing('y'), makeRing('z'))
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(2.04, 64, 40), new THREE.MeshPhysicalMaterial({ color: 0x9da1a5, transparent: true, opacity: .08, roughness: .72, metalness: 0, transmission: .12, side: THREE.BackSide, depthWrite: false })))

      const frame = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 1.72), new THREE.MeshBasicMaterial({ color: 0x080b10, transparent: true, opacity: .96 }))
      frame.position.z = -.015
      const planeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .72, metalness: .02, side: THREE.DoubleSide })
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.58, 1.58), planeMaterial)
      scene.add(frame, plane)
      new THREE.TextureLoader().load(props.imageUrl, (texture) => {
        if (disposed) return texture.dispose()
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
        planeMaterial.map = texture
        planeMaterial.needsUpdate = true
        const source = texture.image as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number }
        const ratio = Math.max(.05, (source.naturalWidth || source.width || 1) / (source.naturalHeight || source.height || 1))
        plane.scale.set(ratio >= 1 ? 1 : ratio, ratio >= 1 ? 1 / ratio : 1, 1)
        frame.scale.copy(plane.scale).multiplyScalar(1.06)
        renderRef.current()
      })
      const ambient = new THREE.AmbientLight(0xb9c8df, .34)
      scene.add(ambient)
      type Visual = { light: InstanceType<typeof THREE.PointLight>; handle: InstanceType<typeof THREE.Mesh>; halo: InstanceType<typeof THREE.Mesh>; beam: InstanceType<typeof THREE.Mesh> }
      const visuals = new Map<string, Visual>()
      const kelvinColor = (kelvin: number) => {
        const t = clamp(kelvin, 2800, 8000), warm = new THREE.Color('#ff9a55'), neutral = new THREE.Color('#fff7e9'), cool = new THREE.Color('#8fc9ff')
        return t <= 5600 ? warm.lerp(neutral, (t - 2800) / 2800) : neutral.lerp(cool, (t - 5600) / 2400)
      }
      const createVisual = (id: string) => {
        const visual = {
          light: new THREE.PointLight(0xffffff, 4, 9, 1.5),
          handle: new THREE.Mesh(new THREE.SphereGeometry(.12, 24, 18), new THREE.MeshBasicMaterial()),
          halo: new THREE.Mesh(new THREE.RingGeometry(.18, .27, 42), new THREE.MeshBasicMaterial({ transparent: true, opacity: .52, side: THREE.DoubleSide, depthWrite: false })),
          beam: new THREE.Mesh(new THREE.ConeGeometry(.62, 1.9, 32, 1, true), new THREE.MeshBasicMaterial({ transparent: true, opacity: .08, side: THREE.DoubleSide, depthWrite: false })),
        }
        scene.add(visual.light, visual.beam, visual.halo, visual.handle)
        visuals.set(id, visual)
        return visual
      }
      const render = () => {
        if (disposed) return
        const current = valuesRef.current, liveIds = new Set(current.lights.map((item) => item.id))
        visuals.forEach((visual, id) => { if (!liveIds.has(id)) { scene.remove(visual.light, visual.handle, visual.halo, visual.beam); visuals.delete(id) } })
        current.lights.forEach((item) => {
          const visual = visuals.get(item.id) ?? createVisual(item.id)
          const yaw = THREE.MathUtils.degToRad(item.yaw), pitch = THREE.MathUtils.degToRad(item.pitch)
          const position = new THREE.Vector3(1.88 * Math.sin(yaw) * Math.cos(pitch), 1.88 * Math.sin(pitch), 1.88 * Math.cos(yaw) * Math.cos(pitch))
          const color = kelvinColor(item.temperatureK), active = item.id === current.activeLightId
          visual.light.position.copy(position); visual.handle.position.copy(position); visual.halo.position.copy(position)
          visual.beam.position.copy(position.clone().multiplyScalar(.52)); visual.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), position.clone().negate().normalize())
          visual.light.color.copy(color); visual.light.intensity = item.enabled ? .6 + item.intensity / 100 * 5.8 : 0
          visual.handle.scale.setScalar(active ? 1.35 : .92)
          ;(visual.handle.material as InstanceType<typeof THREE.MeshBasicMaterial>).color.set(active ? 0xf7f8f8 : 0x050606)
          ;[visual.halo.material, visual.beam.material].forEach((material) => (material as InstanceType<typeof THREE.MeshBasicMaterial>).color.copy(active ? new THREE.Color(0xffffff) : color))
          ;(visual.halo.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = item.enabled ? (active ? .72 : .36) : .12
          ;(visual.beam.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = item.enabled ? .07 + item.intensity / 100 * .13 : 0
          visual.handle.visible = visual.halo.visible = visual.beam.visible = item.enabled
        })
        ambient.intensity = .18 + current.exposure / 100 * .32
        renderer.toneMappingExposure = .72 + current.exposure / 100 * .56
        const verticalTangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), limitingTangent = Math.min(verticalTangent, verticalTangent * camera.aspect)
        const distance = 2.2 / (Math.max(.08, limitingTangent) * .79)
        camera.position.copy((current.view === 'front' ? new THREE.Vector3(0, .01, 1) : new THREE.Vector3(.52, .3, .8)).normalize().multiplyScalar(distance)); camera.lookAt(0, 0, 0)
        visuals.forEach((visual) => visual.halo.quaternion.copy(camera.quaternion))
        renderer.render(scene, camera)
      }
      renderRef.current = render
      const resize = () => { const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); render() }
      const observer = new ResizeObserver(resize); observer.observe(host); resize()

      let draggingId: string | null = null
      const setFromPointer = (event: PointerEvent, id: string) => {
        const rect = renderer.domElement.getBoundingClientRect()
        let x = (event.clientX - rect.left - rect.width / 2) / (Math.min(rect.width, rect.height) * .39), y = (rect.height / 2 - (event.clientY - rect.top)) / (Math.min(rect.width, rect.height) * .39)
        const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length }
        const nextPitch = clamp(Math.round(THREE.MathUtils.radToDeg(Math.asin(y)) * .9), -80, 80), horizontalRadius = Math.max(.08, Math.cos(THREE.MathUtils.degToRad(nextPitch)))
        valuesRef.current.onChange(id, clamp(Math.round(THREE.MathUtils.radToDeg(Math.asin(clamp(x / horizontalRadius, -1, 1)))), -90, 90), nextPitch)
      }
      const down = (event: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top
	        const hits = Array.from(visuals.entries()).map(([id, visual]) => { const point = visual.handle.position.clone().project(camera); return { id, distance: Math.hypot(x - (point.x + 1) * rect.width / 2, y - (-point.y + 1) * rect.height / 2) } }).filter((hit) => hit.distance < 30).sort((a, b) => a.distance - b.distance)
	        const selectedId = hits[0]?.id ?? valuesRef.current.activeLightId
	        draggingId = selectedId
	        valuesRef.current.onSelectLight(selectedId); renderer.domElement.setPointerCapture(event.pointerId); setFromPointer(event, selectedId)
      }
      const move = (event: PointerEvent) => draggingId && setFromPointer(event, draggingId)
      const up = (event: PointerEvent) => { draggingId = null; if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId) }
      renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move); renderer.domElement.addEventListener('pointerup', up); renderer.domElement.addEventListener('pointercancel', up)
      cleanup = () => {
        observer.disconnect(); renderRef.current = () => undefined
        renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointercancel', up)
        scene.traverse((object) => { const mesh = object as InstanceType<typeof THREE.Mesh>; mesh.geometry?.dispose(); const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []; materials.forEach((material) => { const mapped = material as InstanceType<typeof THREE.MeshStandardMaterial>; mapped.map?.dispose(); material.dispose() }) })
        renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove()
      }
    })
    return () => { disposed = true; cleanup() }
  }, [props.imageUrl])
  return <div ref={hostRef} className="lighting-three-preview" role="application" aria-label="多光源三维预览，可拖动光点改变选中光源方向" />
}
