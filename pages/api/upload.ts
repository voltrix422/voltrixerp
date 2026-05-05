import { NextApiRequest, NextApiResponse } from 'next'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const file = req.body.file
    
    if (!file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    // For now, we'll handle base64 encoded files
    // In a production environment, you might want to use multer or similar
    const base64Data = file.replace(/^data:.*?;base64,/, '')
    const fileName = `petty-cash-${Date.now()}.jpg`
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }
    
    const filePath = join(uploadsDir, fileName)
    await writeFile(filePath, Buffer.from(base64Data, 'base64'))
    
    return res.status(200).json({ 
      url: `/uploads/${fileName}`,
      fileName 
    })
  } catch (error) {
    console.error('Upload error:', error)
    return res.status(500).json({ error: 'Upload failed' })
  }
}
