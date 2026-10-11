export interface Profile {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  about: string
  created_at: string
  updated_at: string
  last_seen: string | null
  show_last_seen: boolean
  show_online: boolean
  read_receipts: boolean
  onboarded: boolean
}

export interface Conversation {
  id: string
  is_group: boolean
  name: string | null
  avatar_url: string | null
  description: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type MemberRole = 'admin' | 'member'

export interface ConversationParticipant {
  conversation_id: string
  user_id: string
  last_read_at: string | null
  created_at: string
  role: MemberRole
  is_pinned: boolean
  muted_until: string | null
  is_archived: boolean
  is_favourite: boolean
  cleared_at: string | null
  is_hidden: boolean
}

export type MessageType = 'text' | 'image' | 'video' | 'document' | 'audio' | 'system'

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  type: MessageType
  media_url: string | null
  media_name: string | null
  media_size: number | null
  media_mime: string | null
  duration: number | null
  reply_to_id: string | null
  forwarded: boolean
  edited_at: string | null
  deleted_for_everyone: boolean
  client_id: string | null
}

export type LocalStatus = 'pending' | 'failed'

export interface UIMessage extends Message {
  localStatus?: LocalStatus
  localUrl?: string
  localFile?: File
  progress?: number
}

export interface Reaction {
  message_id: string
  conversation_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface MessageRead {
  message_id: string
  conversation_id: string
  user_id: string
  delivered_at: string | null
  read_at: string | null
}

export type Tick = 'pending' | 'failed' | 'sent' | 'delivered' | 'read'

export interface Member {
  profile: Profile
  role: MemberRole
  joined_at: string
}

export interface ChatItem extends Conversation {
  me: ConversationParticipant
  members: Member[]
  other: Profile | null
  last_message: Message | null
  unread_count: number
}

export interface Status {
  id: string
  user_id: string
  type: 'text' | 'image'
  content: string
  media_url: string | null
  bg_color: string
  created_at: string
  expires_at: string
}

export interface StatusView {
  status_id: string
  viewer_id: string
  viewed_at: string
}
