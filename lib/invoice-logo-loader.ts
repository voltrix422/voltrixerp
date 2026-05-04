import fs from 'fs'
import path from 'path'

export function loadLogoAsBase64(): string | null {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.png')
    if (fs.existsSync(logoPath)) {
      const logoData = fs.readFileSync(logoPath)
      return `data:image/png;base64,${logoData.toString('base64')}`
    }
    return null
  } catch (error) {
    console.error('Error loading logo:', error)
    return null
  }
}
