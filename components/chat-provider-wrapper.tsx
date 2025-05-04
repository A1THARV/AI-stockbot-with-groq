'use client'

import React, { useEffect, useState, ReactNode } from 'react'
import { AI } from '@/lib/chat/actions'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import { Message } from '@/lib/types'

interface ChatProviderWrapperProps {
  chatId: string
  children: ReactNode
}

export function ChatProviderWrapper({ chatId, children }: ChatProviderWrapperProps) {
  const [storedMessages, setStoredMessages] = useLocalStorage<Message[]>(
    'chat_' + chatId,
    []
  )
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Set isLoaded to true only on the client side after initial mount/hydration
    setIsLoaded(true)
  }, []) // Empty dependency array ensures this runs only once after mount

  if (!isLoaded) {
    // Return null or a loading indicator during SSR or before hydration is complete
    // This prevents rendering the AI provider with potentially incorrect initial state
    return null
  }

  return (
    <AI initialAIState={{ chatId: chatId, messages: storedMessages }}>
      {children}
    </AI>
  )
}
