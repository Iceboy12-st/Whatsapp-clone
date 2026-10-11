import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase'
import { uuid } from './utils'

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

function extension(file: File | Blob, fallback: string): string {
  if (file instanceof File && file.name.includes('.')) return file.name.split('.').pop()!.toLowerCase()
  return fallback
}

export function buildPath(folder: string, file: File | Blob, fallbackExt = 'bin'): string {
  return `${folder}/${uuid()}.${extension(file, fallbackExt)}`
}

/** Uploads through the Storage REST endpoint so we can report real progress. */
export async function uploadWithProgress(
  bucket: string,
  path: string,
  file: File | Blob,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('File is larger than 50 MB')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else {
        let msg = `Upload failed (${xhr.status})`
        try {
          msg = JSON.parse(xhr.responseText).message || msg
        } catch {
          /* non-JSON body */
        }
        reject(new Error(msg))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(file)
  })
  return path
}

export async function uploadAvatar(folder: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image')
  const path = buildPath(folder, file, 'jpg')
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
  if (error) throw error
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

const signedCache = new Map<string, { url: string; expires: number }>()
const inflight = new Map<string, Promise<string | null>>()
const SIGN_SECONDS = 60 * 60

export function cachedSignedUrl(path: string): string | null {
  const hit = signedCache.get(path)
  return hit && hit.expires > Date.now() ? hit.url : null
}

export function getSignedUrl(path: string): Promise<string | null> {
  if (/^(https?:|blob:|data:)/.test(path)) return Promise.resolve(path)
  const hit = cachedSignedUrl(path)
  if (hit) return Promise.resolve(hit)
  const pending = inflight.get(path)
  if (pending) return pending
  const p = supabase.storage
    .from('chat-media')
    .createSignedUrl(path, SIGN_SECONDS)
    .then(({ data, error }) => {
      inflight.delete(path)
      if (error || !data) return null
      signedCache.set(path, { url: data.signedUrl, expires: Date.now() + (SIGN_SECONDS - 120) * 1000 })
      return data.signedUrl
    })
  inflight.set(path, p)
  return p
}
