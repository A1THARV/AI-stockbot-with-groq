import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PromptForm } from './prompt-form';
import { useVoiceInput } from '@/lib/hooks/use-voice-input'; // The hook to mock
import { toast } from 'sonner'; // To mock toast calls

// --- Mocks ---

// Mock the useVoiceInput hook
jest.mock('@/lib/hooks/use-voice-input');
const mockUseVoiceInput = useVoiceInput as jest.MockedFunction<typeof useVoiceInput>;

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(), // Mock other methods if needed
    info: jest.fn(),
    warning: jest.fn(),
  },
}));
const mockToastError = toast.error as jest.Mock;

// Mock other dependencies used by PromptForm (if necessary)
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('ai/rsc', () => ({
  useActions: () => ({
    submitUserMessage: jest.fn().mockResolvedValue({ id: 'response-id', display: 'Mock response' }),
  }),
  useUIState: () => [
    [], // Initial messages
    jest.fn(), // Mock setMessages
  ],
}));

// Mock useLocalStorage (optional, provide default value)
jest.mock('@/lib/hooks/use-local-storage', () => ({
    useLocalStorage: jest.fn().mockReturnValue(['mock-api-key', jest.fn()]),
}));


// Helper to set mock return values for useVoiceInput
const setMockVoiceInputState = (state: Partial<ReturnType<typeof useVoiceInput>>) => {
  mockUseVoiceInput.mockReturnValue({
    // Defaults
    isListening: false,
    transcript: '',
    startListening: jest.fn().mockResolvedValue(undefined),
    stopListening: jest.fn(),
    browserSupportsSpeechRecognition: true,
    microphonePermissionGranted: true,
    error: null,
    // Override with provided state
    ...state,
  });
};

// --- Tests ---

describe('PromptForm Integration Tests', () => {
  beforeEach(() => {
    // Reset mocks for each test
    jest.clearAllMocks();
    // Set default mock state before each test
    setMockVoiceInputState({});
  });

  it('renders the prompt form correctly', () => {
    render(<PromptForm input="" setInput={jest.fn()} />);
    expect(screen.getByPlaceholderText('Send a message.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument();
  });

  it('renders the microphone button when supported and permission granted', () => {
    setMockVoiceInputState({ browserSupportsSpeechRecognition: true, microphonePermissionGranted: true });
    render(<PromptForm input="" setInput={jest.fn()} />);
    expect(screen.getByRole('button', { name: /start listening/i })).toBeInTheDocument();
  });

  it('does not render the microphone button when not supported', () => {
     setMockVoiceInputState({ browserSupportsSpeechRecognition: false });
     render(<PromptForm input="" setInput={jest.fn()} />);
     expect(screen.queryByRole('button', { name: /start listening/i })).not.toBeInTheDocument();
     // Check for the disabled placeholder
     const placeholder = screen.getByRole('tooltip', { name: /voice input not supported/i });
     expect(placeholder).toBeInTheDocument();
  });

  it('renders the microphone button disabled with tooltip when permission is denied', () => {
    setMockVoiceInputState({ browserSupportsSpeechRecognition: true, microphonePermissionGranted: false });
    render(<PromptForm input="" setInput={jest.fn()} />);
    const micButton = screen.getByRole('button', { name: /start listening/i });
    expect(micButton).toBeInTheDocument();
    expect(micButton).toBeDisabled();

    // Check tooltip content (may require hovering simulation if Tooltip uses it)
    fireEvent.mouseEnter(micButton); // Or focus, depending on TooltipTrigger setup
    expect(screen.getByRole('tooltip', { name: /microphone permission denied/i })).toBeInTheDocument();

  });

   it('calls startListening when microphone button is clicked and not listening', async () => {
     const mockStartListening = jest.fn().mockResolvedValue(undefined);
     setMockVoiceInputState({
       isListening: false,
       startListening: mockStartListening,
       browserSupportsSpeechRecognition: true,
       microphonePermissionGranted: true,
     });
     render(<PromptForm input="" setInput={jest.fn()} />);
     const micButton = screen.getByRole('button', { name: /start listening/i });
     fireEvent.click(micButton);
     await waitFor(() => expect(mockStartListening).toHaveBeenCalledTimes(1));
   });

   it('calls stopListening when microphone button is clicked and listening', () => {
    const mockStopListening = jest.fn();
    setMockVoiceInputState({
        isListening: true,
        stopListening: mockStopListening,
        browserSupportsSpeechRecognition: true,
        microphonePermissionGranted: true,
    });
    render(<PromptForm input="" setInput={jest.fn()} />);
    const micButton = screen.getByRole('button', { name: /stop listening/i }); // Name changes when listening
    fireEvent.click(micButton);
    expect(mockStopListening).toHaveBeenCalledTimes(1);
   });

   it('displays the stop icon and correct tooltip when listening', () => {
     setMockVoiceInputState({ isListening: true, browserSupportsSpeechRecognition: true, microphonePermissionGranted: true });
     render(<PromptForm input="" setInput={jest.fn()} />);
     const micButton = screen.getByRole('button', { name: /stop listening/i });
     expect(micButton).toBeInTheDocument();
     // Ideally, check for the IconStop component or its specific path data, but checking name is simpler
     expect(screen.getByRole('button', { name: /stop listening/i })).toBeInTheDocument();

     // Check tooltip
     fireEvent.mouseEnter(micButton);
     expect(screen.getByRole('tooltip', { name: /stop listening/i })).toBeInTheDocument();
   });

   it('disables submit button when listening', () => {
     setMockVoiceInputState({ isListening: true, browserSupportsSpeechRecognition: true, microphonePermissionGranted: true });
     render(<PromptForm input="some text" setInput={jest.fn()} />); // Input is not empty
     expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();

     // Check tooltip for submit button
     fireEvent.mouseEnter(screen.getByRole('button', { name: /send message/i }));
     expect(screen.getByRole('tooltip', { name: /stop voice input before sending/i })).toBeInTheDocument();
   });

    it('appends transcript to input when listening stops', () => {
        const mockSetInput = jest.fn();
        const initialInput = "initial text";
        const transcript = "appended transcript";

        // Initial render (not listening)
        const { rerender } = render(<PromptForm input={initialInput} setInput={mockSetInput} />);

        // Simulate starting and then stopping listening with a transcript
        setMockVoiceInputState({ isListening: true }); // Start listening
        rerender(<PromptForm input={initialInput} setInput={mockSetInput} />);

        setMockVoiceInputState({ isListening: false, transcript: transcript }); // Stop listening, provide transcript
        rerender(<PromptForm input={initialInput} setInput={mockSetInput} />); // Rerender to trigger effect

        // Check if setInput was called correctly
        expect(mockSetInput).toHaveBeenCalledTimes(1);
        expect(mockSetInput).toHaveBeenCalledWith(`${initialInput} ${transcript}`); // Expect space appended
    });

    it('appends transcript to empty input when listening stops', () => {
        const mockSetInput = jest.fn();
        const initialInput = "";
        const transcript = "transcript";

        // Initial render (not listening)
        const { rerender } = render(<PromptForm input={initialInput} setInput={mockSetInput} />);

        // Simulate starting and then stopping listening
        setMockVoiceInputState({ isListening: true });
        rerender(<PromptForm input={initialInput} setInput={mockSetInput} />);

        setMockVoiceInputState({ isListening: false, transcript: transcript });
        rerender(<PromptForm input={initialInput} setInput={mockSetInput} />);

        expect(mockSetInput).toHaveBeenCalledTimes(1);
        expect(mockSetInput).toHaveBeenCalledWith(transcript); // No leading space for empty initial input
    });

   it('shows error toast when hook provides an error', async () => {
     const errorMessage = 'Something went wrong';
     setMockVoiceInputState({ error: errorMessage });

     render(<PromptForm input="" setInput={jest.fn()} />);

     // Wait for the useEffect hook that triggers the toast
     await waitFor(() => {
       expect(mockToastError).toHaveBeenCalledTimes(1);
       expect(mockToastError).toHaveBeenCalledWith(
           expect.stringContaining('Voice Input Error'), // Title
           expect.objectContaining({ description: errorMessage }) // Description in options
       );
     });
   });

    it('shows specific permission error toast when hook provides permission error', async () => {
        const errorMessage = 'Microphone permission denied.';
        setMockVoiceInputState({ error: errorMessage });

        render(<PromptForm input="" setInput={jest.fn()} />);

        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledTimes(1);
            expect(mockToastError).toHaveBeenCalledWith(
                expect.stringContaining('Microphone access denied'),
                expect.objectContaining({ description: expect.stringContaining('enable microphone access') })
            );
        });
    });

});
