export type PaletteColor = {
  id: string
  label: string
  hex: string
}

export const PALETTE: readonly PaletteColor[] = [
  { id: 'rose', label: '장미', hex: '#c4536a' },
  { id: 'forest', label: '숲', hex: '#2f6d4f' },
  { id: 'clay', label: '흙', hex: '#c46a32' },
  { id: 'indigo', label: '남색', hex: '#3d4f9e' },
  { id: 'teal', label: '청록', hex: '#1f7a78' },
  { id: 'plum', label: '자두', hex: '#7a4b8a' },
  { id: 'gold', label: '황금', hex: '#8d6410' },
  { id: 'sea', label: '회색', hex: '#5e6872' },
  { id: 'berry', label: '베리', hex: '#a33b5a' },
  { id: 'olive', label: '올리브', hex: '#5f6830' },
]

const byId = new Map(PALETTE.map((color) => [color.id, color]))

export function paletteColor(id: string): PaletteColor {
  return byId.get(id) ?? PALETTE[0]
}

export function inkFor(hex: string): string {
  const value = hex.replace('#', '')
  const parsed = Number.parseInt(value, 16)
  if (!Number.isFinite(parsed) || value.length !== 6) return '#ffffff'
  const channel = (shift: number) => {
    const raw = ((parsed >> shift) & 255) / 255
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4
  }
  const luminance =
    0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0)
  return luminance > 0.42 ? '#0f1419' : '#ffffff'
}

export function firstFreeColor(used: readonly string[]): string {
  const taken = new Set(used)
  return PALETTE.find((color) => !taken.has(color.id))?.id ?? PALETTE[0].id
}
