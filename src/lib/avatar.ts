const VIEW = 240

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('load'))
    }
    image.src = url
  })
}

export function cropAvatar(image: HTMLImageElement, offset: { x: number; y: number }, zoom: number): string {
  const cover = Math.max(VIEW / image.width, VIEW / image.height)
  const scale = cover * zoom
  const displayW = image.width * scale
  const displayH = image.height * scale
  const maxX = Math.max(0, (displayW - VIEW) / 2)
  const maxY = Math.max(0, (displayH - VIEW) / 2)
  const ox = Math.min(maxX, Math.max(-maxX, offset.x))
  const oy = Math.min(maxY, Math.max(-maxY, offset.y))
  const left = (VIEW - displayW) / 2 + ox
  const top = (VIEW - displayH) / 2 + oy
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) return ''
  context.drawImage(image, -left / scale, -top / scale, VIEW / scale, VIEW / scale, 0, 0, 256, 256)
  return canvas.toDataURL('image/jpeg', 0.72)
}

export function coverLayout(image: HTMLImageElement, offset: { x: number; y: number }, zoom: number) {
  const cover = Math.max(VIEW / image.width, VIEW / image.height)
  const scale = cover * zoom
  const displayW = image.width * scale
  const displayH = image.height * scale
  const maxX = Math.max(0, (displayW - VIEW) / 2)
  const maxY = Math.max(0, (displayH - VIEW) / 2)
  const ox = Math.min(maxX, Math.max(-maxX, offset.x))
  const oy = Math.min(maxY, Math.max(-maxY, offset.y))
  return {
    width: displayW,
    height: displayH,
    left: (VIEW - displayW) / 2 + ox,
    top: (VIEW - displayH) / 2 + oy,
    offset: { x: ox, y: oy },
  }
}
