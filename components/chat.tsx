'use client'

import { cn } from '@/lib/utils'
import { ChatList } from '@/components/chat-list'
import { ChatPanel } from '@/components/chat-panel'
import { EmptyScreen } from '@/components/empty-screen'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import { useEffect, useState, useRef } from 'react' // Added useRef
import { useUIState, useAIState, useActions } from 'ai/rsc' // Added useActions
import { Message, Session } from '@/lib/types'
import { usePathname, useRouter } from 'next/navigation'
import { useScrollAnchor } from '@/lib/hooks/use-scroll-anchor'
import { toast } from 'sonner'
import { TickerTape } from '@/components/tradingview/ticker-tape'
import { MissingApiKeyBanner } from '@/components/missing-api-key-banner'

export interface ChatProps extends React.ComponentProps<'div'> {
  initialMessages?: Message[]
  id?: string
  session?: Session
  missingKeys: string[]
}

export function Chat({ id, className, session, missingKeys }: ChatProps) {
  const router = useRouter()
  const path = usePathname()
  // Removed duplicate router/path declarations
  const [input, setInput] = useState('')

  // State Hooks
  const [messages, setMessages] = useUIState()
  const [aiState, setAIState] = useAIState() // Keep setAIState for other potential uses if needed
  const { restoreChatHistory } = useActions() // Get the action
  const [_, saveMessages] = useLocalStorage<Message[]>('chat_' + id, []) // Keep useLocalStorage primarily for saving
  const [isLoadingFromStorage, setIsLoadingFromStorage] = useState(true)
  const aiStateRef = useRef(aiState) // Ref for latest AI state in initial effect
  const [___, setNewChatId] = useLocalStorage('newChatId', id) // Keep existing newChatId logic

  // Effect to keep AI state ref updated (Keep this)
  useEffect(() => {
    aiStateRef.current = aiState
  }, [aiState])

  // Effect to load messages from local storage on initial mount
  useEffect(() => {
    if (isLoadingFromStorage && id) {
      console.log('Attempting to load messages from localStorage for chat:', id)
      const storedMessagesJson = localStorage.getItem('chat_' + id)
      let parsedMessages: Message[] | null = null

      if (storedMessagesJson) {
        try {
          parsedMessages = JSON.parse(storedMessagesJson)
          console.log('Parsed messages from storage:', parsedMessages)
        } catch (error) {
          console.error('Failed to parse messages from localStorage:', error)
          // Optionally clear invalid storage item: localStorage.removeItem('chat_' + id);
        }
      }

      // Use ref to get the latest messages length, even if aiState isn't updated yet
      const currentMessagesLength = aiStateRef.current?.messages?.length ?? 0
      console.log('Current AI state messages length (via ref):', currentMessagesLength)

      if (parsedMessages && parsedMessages.length > 0 && currentMessagesLength === 0) {
        console.log('Restoring chat history from storage using action.')
        // Use the action to restore history instead of directly setting state
        restoreChatHistory(parsedMessages)
      } else {
        console.log('Skipping history restoration (no stored messages, storage invalid, or AI state already populated).')
      }
      setIsLoadingFromStorage(false) // Mark loading as complete
    }
    // Dependencies: id, isLoadingFromStorage, and the restoreChatHistory action
  }, [id, isLoadingFromStorage, restoreChatHistory]) // Updated dependencies

  // Effect to save messages to local storage when AI state changes
  useEffect(() => {
    // Only save if loading from storage is complete to avoid overwriting loaded state
    if (!isLoadingFromStorage && id) {
      console.log('Saving messages to storage:', aiState.messages)
      saveMessages(aiState.messages ?? []) // Save current AI state messages using the hook's setter
    }
    // Dependencies: AI messages, the save function, id, and loading flag
  }, [aiState.messages, saveMessages, id, isLoadingFromStorage])


  // Existing Effects (keep)
  useEffect(() => {
    if (session?.user) {
      if (!path.includes('chat') && messages.length === 1) { // Use UI messages here for URL update logic
        window.history.replaceState({}, '', `/chat/${id}`)
      }
    }
  }, [id, path, session?.user, messages])

  useEffect(() => {
    const messagesLength = aiState.messages?.length
    if (messagesLength === 2) {
      router.refresh()
    }
    console.log('Current AI State Value: ', aiState.messages) // Keep for debugging
  }, [aiState.messages, router]) // Keep this effect

  // Keep this effect
  useEffect(() => {
    setNewChatId(id)
  })

  useEffect(() => {
    missingKeys.map(key => {
      toast.error(`Missing ${key} environment variable!`)
    })
  }, [missingKeys])

  const { messagesRef, scrollRef, visibilityRef, isAtBottom, scrollToBottom } =
    useScrollAnchor()

  return (
    <div
      className="group w-full overflow-auto pl-0 peer-[[data-state=open]]:lg:pl-[250px] peer-[[data-state=open]]:xl:pl-[300px]"
      ref={scrollRef}
    >
      {messages.length ? (
        <MissingApiKeyBanner missingKeys={missingKeys} />
      ) : (
        <TickerTape />
      )}

      <div
        className={cn(
          messages.length ? 'pb-[200px] pt-4 md:pt-6' : 'pb-[200px] pt-0',
          className
        )}
        ref={messagesRef}
      >
        {messages.length ? (
          <ChatList messages={messages} isShared={false} session={session} />
        ) : (
          <EmptyScreen />
        )}
        <div className="w-full h-px" ref={visibilityRef} />
      </div>
      <ChatPanel
        id={id}
        input={input}
        setInput={setInput}
        isAtBottom={isAtBottom}
        scrollToBottom={scrollToBottom}
      />
    </div>
  )
}
