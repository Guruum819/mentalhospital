import { loadImage } from './avatar.ts'

const MAX_EDGE = 600
const MAX_DATA_URL = 180_000

function render(image: HTMLImageElement, width: number, height: number, quality: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return ''
  context.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}

/** Resize a photo-album image to a JPEG that fits in the realtime database. */
export async function compressCover(file: File): Promise<string> {
  const image = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height))
  let width = Math.max(1, Math.round(image.width * scale))
  let height = Math.max(1, Math.round(image.height * scale))
  let quality = 0.72
  let url = render(image, width, height, quality)
  while (url.length > MAX_DATA_URL && quality > 0.42) {
    quality = Math.round((quality - 0.08) * 100) / 100
    url = render(image, width, height, quality)
  }
  while (url.length > MAX_DATA_URL && width > 200) {
    width = Math.max(1, Math.round(width * 0.8))
    height = Math.max(1, Math.round(height * 0.8))
    url = render(image, width, height, quality)
  }
  if (!url.startsWith('data:image/jpeg;base64,') || url.length > MAX_DATA_URL) {
    throw new Error('사진이 너무 커용. 다른 사진을 골라 주세용.')
  }
  return url
}
