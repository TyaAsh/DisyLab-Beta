import { useEffect, useRef } from 'react'

type Props = {
  imageUrl: string
  yaw: number
  pitch: number
  intensity: number
  temperatureK: number
  view: 'perspective' | 'front'
  onChange: (yaw: number, pitch: number) => void
}

type PreviewValues = Omit<Props, 'imageUrl'>

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export default function LightingSpherePreview(props: Props) {
  const { imageUrl, yaw, pitch, intensity, temperatureK, view, onChange } = props
  const hostRef = useRef<HTMLDivElement>(null)
  const valuesRef = useRef<PreviewValues>({ yaw, pitch, intensity, temperatureK, view, onChange })
  const renderRef = useRef<() => void>(() => undefined)
  valuesRef.current = { yaw, pitch, intensity, temperatureK, view, onChange }

  useEffect(() => renderRef.current(), [yaw, pitch, intensity, temperatureK, view])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let cleanup = () => undefined

    void import('three').then((THREE) => {
      if (disposed) return

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
      renderer.setClearColor(0x000000, 0)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.05
      host.replaceChildren(renderer.domElement)

      const globe = new THREE.Mesh(
        new THREE.SphereGeometry(2.12, 32, 22),
        new THREE.MeshBasicMaterial({ color: 0x8b8e9b, wireframe: true, transparent: true, opacity: 0.38, depthWrite: false }),
      )
      scene.add(globe)

      const equator = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, index) => {
          const angle = index / 96 * Math.PI * 2
          return new THREE.Vector3(Math.cos(angle) * 2.13, 0, Math.sin(angle) * 2.13)
        })),
        new THREE.LineBasicMaterial({ color: 0xa1a4ae, transparent: true, opacity: 0.18 }),
      )
      scene.add(equator)

      const planeMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.34,
        roughness: 0.82,
        metalness: 0,
        side: THREE.DoubleSide,
      })
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.55), planeMaterial)
      plane.position.z = 0.02
      scene.add(plane)

      const textureLoader = new THREE.TextureLoader()
      textureLoader.load(imageUrl, (texture) => {
        if (disposed) {
          texture.dispose()
          return
        }
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
        planeMaterial.map = texture
        planeMaterial.emissiveMap = texture
        planeMaterial.needsUpdate = true
        const source = texture.image as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number }
        const ratio = Math.max(0.05, (source.naturalWidth || source.width || 1) / (source.naturalHeight || source.height || 1))
        plane.scale.set(ratio >= 1 ? 1 : ratio, ratio >= 1 ? 1 / ratio : 1, 1)
        renderRef.current()
      })

      const ambient = new THREE.AmbientLight(0xffffff, 0.28)
      const light = new THREE.PointLight(0xffffff, 4, 9, 1.5)
      const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xff8a32 })
      const lightBall = new THREE.Mesh(new THREE.SphereGeometry(0.23, 24, 18), lightMaterial)
      const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xff8a32, transparent: true, opacity: 0.44, side: THREE.DoubleSide, depthWrite: false })
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.31, 0.44, 40), haloMaterial)
      const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xffc880, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false })
      const beam = new THREE.Mesh(new THREE.ConeGeometry(0.72, 2.3, 32, 1, true), beamMaterial)
      scene.add(ambient, light, beam, halo, lightBall)

      const render = () => {
        if (disposed) return
        const current = valuesRef.current
        const yawRad = THREE.MathUtils.degToRad(current.yaw)
        const pitchRad = THREE.MathUtils.degToRad(current.pitch)
        // Keep the handle inside the globe so the complete interaction field
        // remains visible even in short or narrow dialog layouts.
        const radius = 1.98
        const position = new THREE.Vector3(
          radius * Math.sin(yawRad) * Math.cos(pitchRad),
          radius * Math.sin(pitchRad),
          radius * Math.cos(yawRad) * Math.cos(pitchRad),
        )
        light.position.copy(position)
        lightBall.position.copy(position)
        halo.position.copy(position)

        const beamDirection = position.clone().negate().normalize()
        beam.position.copy(position.clone().multiplyScalar(0.53))
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDirection)

        const normalizedIntensity = clamp(current.intensity / 100, 0.1, 1)
        light.intensity = 1 + normalizedIntensity * 6.4
        ambient.intensity = 0.16 + normalizedIntensity * 0.22
        planeMaterial.emissiveIntensity = 0.2 + normalizedIntensity * 0.2
        beamMaterial.opacity = 0.055 + normalizedIntensity * 0.12
        haloMaterial.opacity = 0.28 + normalizedIntensity * 0.34
        renderer.toneMappingExposure = 0.76 + normalizedIntensity * 0.48

        const kelvin = clamp(current.temperatureK, 3200, 7600)
        light.color.set(new THREE.Color().setHSL(
          THREE.MathUtils.mapLinear(kelvin, 3200, 7600, 0.075, 0.61),
          THREE.MathUtils.mapLinear(Math.abs(kelvin - 5600), 0, 2400, 0.06, 0.34),
          0.72,
        ))
        lightMaterial.color.copy(light.color)
        haloMaterial.color.copy(light.color)
        beamMaterial.color.copy(light.color)

        // Fit the complete globe with a stable 11%+ safety margin. Using the
        // tighter of the horizontal and vertical FOV makes this responsive to
        // both portrait and landscape containers rather than relying on a
        // fixed camera distance that can crop the sphere.
        const verticalTangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
        const limitingTangent = Math.min(verticalTangent, verticalTangent * camera.aspect)
        const framingRadius = 2.22
        const cameraDistance = framingRadius / (Math.max(0.08, limitingTangent) * 0.78)
        const cameraDirection = current.view === 'front'
          ? new THREE.Vector3(0, 0.01, 1)
          : new THREE.Vector3(0.53, 0.31, 0.79)
        camera.position.copy(cameraDirection.normalize().multiplyScalar(cameraDistance))
        camera.lookAt(0, 0, 0)
        halo.quaternion.copy(camera.quaternion)
        renderer.render(scene, camera)
      }
      renderRef.current = render

      const resize = () => {
        const width = Math.max(1, host.clientWidth)
        const height = Math.max(1, host.clientHeight)
        renderer.setSize(width, height, false)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        render()
      }
      const observer = new ResizeObserver(resize)
      observer.observe(host)
      resize()

      let dragging = false
      const setFromPointer = (event: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        const diameter = Math.min(rect.width, rect.height) * 0.78
        let x = (event.clientX - centerX) / (diameter / 2)
        let y = (centerY - event.clientY) / (diameter / 2)
        const length = Math.hypot(x, y)
        if (length > 1) {
          x /= length
          y /= length
        }
        const nextPitch = clamp(Math.round(THREE.MathUtils.radToDeg(Math.asin(y)) * 0.9), -80, 80)
        const horizontalRadius = Math.max(0.08, Math.cos(THREE.MathUtils.degToRad(nextPitch)))
        const nextYaw = clamp(Math.round(THREE.MathUtils.radToDeg(Math.asin(clamp(x / horizontalRadius, -1, 1)))), -90, 90)
        valuesRef.current.onChange(nextYaw, nextPitch)
      }
      const down = (event: PointerEvent) => {
        dragging = true
        renderer.domElement.setPointerCapture(event.pointerId)
        setFromPointer(event)
      }
      const move = (event: PointerEvent) => { if (dragging) setFromPointer(event) }
      const up = (event: PointerEvent) => {
        dragging = false
        if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId)
      }
      renderer.domElement.addEventListener('pointerdown', down)
      renderer.domElement.addEventListener('pointermove', move)
      renderer.domElement.addEventListener('pointerup', up)
      renderer.domElement.addEventListener('pointercancel', up)

      cleanup = () => {
        observer.disconnect()
        renderRef.current = () => undefined
        renderer.domElement.removeEventListener('pointerdown', down)
        renderer.domElement.removeEventListener('pointermove', move)
        renderer.domElement.removeEventListener('pointerup', up)
        renderer.domElement.removeEventListener('pointercancel', up)
        scene.traverse((object) => {
          const mesh = object as InstanceType<typeof THREE.Mesh>
          mesh.geometry?.dispose()
          const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
          materials.forEach((material) => {
            const mapped = material as InstanceType<typeof THREE.MeshStandardMaterial>
            mapped.map?.dispose()
            if (mapped.emissiveMap && mapped.emissiveMap !== mapped.map) mapped.emissiveMap.dispose()
            material.dispose()
          })
        })
        renderer.renderLists.dispose()
        renderer.dispose()
        renderer.forceContextLoss()
        renderer.domElement.remove()
      }
    })

    return () => {
      disposed = true
      cleanup()
    }
  }, [imageUrl])

  return <div ref={hostRef} className="lighting-three-preview" role="application" aria-label="三维打光预览，拖动橙色光源调整方向" />
}
