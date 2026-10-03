import { REPORTS_BUCKET, supabase } from './supabase'

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const MAX_BYTES = 10 * 1024 * 1024

// Phone photos are often 4–8 MB. Shrink them to a sharp, readable JPEG before upload.
export async function compressImage(file: File, maxSide = 2200, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 800 * 1024) return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

export function checkFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Only photos (JPG, PNG, WEBP) and PDF files can be uploaded.'
  if (file.size > MAX_BYTES) return 'File is too large. Upload a file under 10 MB.'
  return null
}

export async function uploadReportFile(userId: string, original: File) {
  const file = await compressImage(original)
  const problem = checkFile(file)
  if (problem) throw new Error(problem)
  const ext = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1].replace('jpeg', 'jpg')
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(REPORTS_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return { file_path: path, file_name: original.name.slice(0, 200), mime_type: file.type, size_bytes: file.size }
}

// Opens a stored file in a new tab without ever making it public.
export async function openFile(client: typeof supabase, path: string, name?: string | null) {
  const win = window.open('', '_blank')
  const { data, error } = await client.storage.from(REPORTS_BUCKET).download(path)
  if (error || !data) {
    win?.close()
    throw error ?? new Error('Could not open the file')
  }
  const url = URL.createObjectURL(data)
  if (win) win.location.href = url
  else {
    const a = document.createElement('a')
    a.href = url
    a.download = name ?? 'report'
    a.click()
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
