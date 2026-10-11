export interface Profile {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  about: string
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  is_group: boolean
  name: string | null
  avatar_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ConversationParticipant {
  conversation_id: string
  user_id: string
  last_read_at: string | null
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

export interface ConversationWithDetails extends Conversation {
  participants: Profile[]
  last_message: Message | null
  unread_count: number
}

export interface MessageWithSender extends Message {
  sender: Profile | null
}
