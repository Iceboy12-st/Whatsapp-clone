import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import AuthScreen from '@/components/AuthScreen'
import Sidebar from '@/components/Sidebar'
import ChatView from '@/components/ChatView'
import EmptyState from '@/components/EmptyState'
import NewChatModal from '@/components/NewChatModal'
import ProfileSettings from '@/components/ProfileSettings'
import { Loader as Loader2 } from 'lucide-react'

export default function App() {
  const { user, loading } = useAuth()
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [showNewChat, setShowNewChat] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wa-bg-panel">
        <Loader2 className="w-8 h-8 text-wa-green animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - hidden on mobile when a conversation is selected */}
      <div className={selectedConversation ? 'hidden md:flex' : 'flex'}>
        <Sidebar
          selectedId={selectedConversation}
          onSelect={setSelectedConversation}
          onNewChat={() => setShowNewChat(true)}
          onOpenSettings={() => setShowSettings(true)}
        />
      </div>

      {/* Chat area */}
      <div className={selectedConversation ? 'flex flex-1' : 'hidden md:flex flex-1'}>
        {selectedConversation ? (
          <ChatView
            conversationId={selectedConversation}
            onBack={() => setSelectedConversation(null)}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Modals */}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onConversationCreated={(id) => {
            setSelectedConversation(id)
            setShowNewChat(false)
          }}
        />
      )}

      {showSettings && <ProfileSettings onClose={() => setShowSettings(false)} />}
    </div>
  )
}
