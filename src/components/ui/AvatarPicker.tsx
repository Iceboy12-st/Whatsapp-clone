import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { Avatar } from './Avatar'
import { Spinner } from './primitives'
import { uploadAvatar } from '@/lib/storage'
import { toastError } from '@/store/toast'

export function AvatarPicker({
  value,
  onChange,
  folder,
  size = 200,
  name,
  group,
}: {
  value: string | null
  onChange: (url: string | null) => void
  folder: string
  size?: number
  name?: string
  group?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      onChange(await uploadAvatar(folder, file))
    } catch (e) {
      toastError(e)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      className="group relative rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40"
      style={{ width: size, height: size }}
      aria-label={value ? 'Change photo' : 'Add photo'}
    >
      <Avatar src={value} name={name} size={size} group={group} />
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-full bg-black/50 text-xs uppercase text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {busy ? <Spinner className="border-white border-t-transparent" /> : <Camera className="h-6 w-6" aria-hidden />}
        {value ? 'Change photo' : 'Add photo'}
      </span>
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
          <Spinner className="border-white border-t-transparent" />
        </span>
      )}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
    </button>
  )
}
