'use client'

import * as React from 'react'
import Textarea from 'react-textarea-autosize'

import { useActions, useUIState } from 'ai/rsc'

import { UserMessage } from './stocks/message'
import { type AI } from '@/lib/chat/actions'
import { Button } from '@/components/ui/button'
import { IconArrowDown, IconPlus } from '@/components/ui/icons'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useEnterSubmit } from '@/lib/hooks/use-enter-submit'
import { cn } from '@/lib/utils' // Import cn for conditional classes
import { nanoid } from 'nanoid'
import { useRouter } from 'next/navigation'
import { useVoiceInput } from '@/lib/hooks/use-voice-input'; // Import the hook
// Import Stop icon and Plus (as Mic placeholder)
import { IconStop, IconPlus } from '@/components/ui/icons'; 

import { useLocalStorage } from '@/lib/hooks/use-local-storage';
import { toast } from 'sonner'; // Import toast

export function PromptForm({
  input,
  setInput
}: {
  input: string
  setInput: (value: string) => void
}) {
  const router = useRouter()
  const { formRef, onKeyDown } = useEnterSubmit()
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const { submitUserMessage } = useActions()
  const [_, setMessages] = useUIState<typeof AI>()
  const [apiKey, setApiKey] = useLocalStorage('groqKey', '')
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    browserSupportsSpeechRecognition,
    microphonePermissionGranted,
    error // Get the error state
  } = useVoiceInput();
  const [prevIsListening, setPrevIsListening] = React.useState(isListening);

  // Effect to update input with the final transcript when listening stops
  React.useEffect(() => {
    // Check if listening just stopped
    if (prevIsListening && !isListening && transcript) {
      setInput(prevInput => prevInput + (prevInput ? ' ' : '') + transcript); // Append transcript
    }
    // Update previous listening state for next render
    setPrevIsListening(isListening);
  }, [isListening, prevIsListening, transcript, setInput]);

  // Effect to show toast notifications for errors
  React.useEffect(() => {
    if (error) {
      // Check for specific permission error message
      if (error.toLowerCase().includes('permission denied')) {
        toast.error('Microphone access denied.', {
          description: 'Please enable microphone access in your browser settings to use voice input.',
          duration: 5000 // Show for longer
        });
      } else {
        // Show generic error toast
        toast.error('Voice Input Error', {
          description: error,
          duration: 4000
        });
      }
      // Optionally, clear the error in the hook after showing the toast
      // This requires modifying the hook to expose an error clearing function,
      // or simply relying on the error state being reset on the next action (like startListening).
      // For now, we won't clear it automatically.
    }
  }, [error]); // Run this effect when the error state changes


  // Automatically focus the input on component mount
  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  return (
    <form
      ref={formRef}
      onSubmit={async (e: any) => {
        e.preventDefault()

        // Blur focus on mobile
        if (window.innerWidth < 600) {
          e.target['message']?.blur()
        }

        const value = input.trim()
        setInput('')
        if (!value) return

        // Optimistically add user message UI
        setMessages(currentMessages => [
          ...currentMessages,
          {
            id: nanoid(),
            display: <UserMessage>{value}</UserMessage>
          }
        ])

        // Submit and get response message
        const responseMessage = await submitUserMessage(value, apiKey)
        setMessages(currentMessages => [...currentMessages, responseMessage])
      }}
    >
      <div className="relative flex max-h-60 w-full grow flex-col overflow-hidden bg-background px-8 sm:border sm:px-12">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-0 top-[14px] size-8 rounded-full bg-background p-0 sm:left-4"
              onClick={() => {
                router.push('/new')
              }}
            >
              <IconPlus />
              <span className="sr-only">New Chat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Chat</TooltipContent>
        </Tooltip>
        <Textarea
          ref={inputRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          placeholder="Send a message."
          className="min-h-[60px] w-full resize-none bg-transparent px-4 py-[1.3rem] focus-within:outline-none sm:text-sm"
          autoFocus
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          name="message"
          rows={1}
          value={input}
          onChange={e => {
             setInput(e.target.value);
             // If user types manually while listening, maybe stop listening?
             // if (isListening) {
             //   stopListening();
             // }
          }}
        />
        <div className="absolute right-0 top-[13px] flex items-center space-x-2 sm:right-4">
          {/* Microphone Button - Conditionally render if supported */}
          {browserSupportsSpeechRecognition && (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Using IconPlus as placeholder for Mic icon */}
                <Button
                    type="button"
                    size="icon"
                    variant={"outline"} // Keep outline variant
                    onClick={async () => {
                      if (isListening) {
                        stopListening();
                      } else {
                        await startListening(); // It's async
                      }
                    }}
                    // Disable only if permission is explicitly denied (false). Null means not yet requested.
                    disabled={microphonePermissionGranted === false}
                    className={cn(
                      'transition-colors duration-200',
                      // Add a visual cue for listening state, e.g., red ring or background
                      isListening ? 'ring-2 ring-red-500 bg-red-100 dark:bg-red-900' : '',
                      // Dim if permission denied
                      microphonePermissionGranted === false ? 'opacity-50 cursor-not-allowed' : ''
                    )}
                >
                   {/* TODO: Replace IconPlus with a real Microphone icon when available */}
                  {isListening ? <IconStop className="size-5 text-red-500" /> : <IconPlus className="size-5" />}
                  <span className="sr-only">{isListening ? 'Stop listening' : 'Start listening'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {microphonePermissionGranted === false
                  ? 'Microphone permission denied. Check browser settings.'
                  : error // Display specific error from the hook
                  ? error
                  : isListening
                  ? 'Stop listening'
                  : 'Start listening'}
              </TooltipContent>
            </Tooltip>
          )}
          {/* Tooltip for browsers that don't support speech recognition */}
          {!browserSupportsSpeechRecognition && (
             <Tooltip>
                <TooltipTrigger asChild>
                    <div className="inline-flex items-center justify-center size-9 opacity-50 cursor-not-allowed border border-input bg-background shadow-sm rounded-md">
                         {/* Using IconPlus as placeholder for Mic icon */}
                        <IconPlus className="size-5" />
                    </div>
                </TooltipTrigger>
                <TooltipContent>Voice input not supported by your browser</TooltipContent>
             </Tooltip>
          )}

          {/* Submit Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Disable submit while listening to prevent submitting partial transcript */}
              <Button type="submit" size="icon" disabled={input === '' || isListening}>
                <div className="rotate-180">
                  <IconArrowDown />
                </div>
                <span className="sr-only">Send message</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isListening ? 'Stop voice input before sending' : 'Send message'}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </form>
  )
}
