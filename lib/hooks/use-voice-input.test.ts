import { renderHook, act } from '@testing-library/react';
import { useVoiceInput } from './use-voice-input';

// --- Mocks ---

// Mock react-speech-recognition
const mockUseSpeechRecognition = jest.fn();
const mockStartListening = jest.fn(() => Promise.resolve());
const mockStopListening = jest.fn();
const mockResetTranscript = jest.fn();
let mockTranscript = '';
let mockIsListening = false;
let mockBrowserSupportsSpeechRecognition = true;

jest.mock('react-speech-recognition', () => ({
  useSpeechRecognition: () => mockUseSpeechRecognition(),
  default: {
    startListening: mockStartListening,
    stopListening: mockStopListening,
    browserSupportsSpeechRecognition: mockBrowserSupportsSpeechRecognition,
  },
}));

// Mock navigator.mediaDevices.getUserMedia
const mockGetUserMedia = jest.fn(() => Promise.resolve());
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
});

// Mock navigator.permissions.query
let mockPermissionState: PermissionState = 'prompt'; // 'granted', 'denied', 'prompt'
const mockPermissionStatus = {
    state: mockPermissionState,
    onchange: null as (() => void) | null, // Define type explicitly
};
const mockPermissionsQuery = jest.fn(async () => {
    // Update state before returning
    mockPermissionStatus.state = mockPermissionState;
    return Promise.resolve(mockPermissionStatus as unknown as PermissionStatus); // Cast to satisfy type, know it's simplified
});

Object.defineProperty(global.navigator, 'permissions', {
  value: {
    query: mockPermissionsQuery,
  },
  writable: true,
});

// Helper to simulate permission change
const simulatePermissionChange = (newState: PermissionState) => {
  mockPermissionState = newState;
  mockPermissionStatus.state = newState;
  if (mockPermissionStatus.onchange) {
    mockPermissionStatus.onchange();
  }
};

// Helper to reset mocks between tests
const resetAllMocks = () => {
  mockUseSpeechRecognition.mockReset();
  mockStartListening.mockClear();
  mockStopListening.mockClear();
  mockResetTranscript.mockClear();
  mockGetUserMedia.mockClear().mockResolvedValue(undefined); // Reset getUserMedia mock
  mockPermissionsQuery.mockClear();

  mockTranscript = '';
  mockIsListening = false;
  mockBrowserSupportsSpeechRecognition = true;
  mockPermissionState = 'prompt'; // Reset permission state
  mockPermissionStatus.onchange = null; // Clear listener

  // Reset the mock implementation for useSpeechRecognition for each test
  mockUseSpeechRecognition.mockImplementation(() => ({
    transcript: mockTranscript,
    listening: mockIsListening,
    resetTranscript: mockResetTranscript,
    browserSupportsSpeechRecognition: mockBrowserSupportsSpeechRecognition,
  }));
};

// --- Tests ---

describe('useVoiceInput Hook', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should initialize with default states', async () => {
    const { result } = renderHook(() => useVoiceInput());

    expect(result.current.isListening).toBe(false);
    expect(result.current.transcript).toBe('');
    expect(result.current.browserSupportsSpeechRecognition).toBe(true);
    expect(result.current.microphonePermissionGranted).toBe(null); // Initially null until query resolves
    expect(result.current.error).toBe(null);

    // Wait for the initial permission query effect
    await act(async () => {});

    // After query resolves (defaulting to 'prompt', so permission is not granted)
    expect(result.current.microphonePermissionGranted).toBe(false);
  });

  it('should reflect browser support status', () => {
    mockBrowserSupportsSpeechRecognition = false;
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.browserSupportsSpeechRecognition).toBe(false);
  });

  it('should handle microphone permission granted initially', async () => {
     mockPermissionState = 'granted';
     const { result } = renderHook(() => useVoiceInput());
     await act(async () => {}); // Wait for permission query
     expect(result.current.microphonePermissionGranted).toBe(true);
     expect(result.current.error).toBe(null);
  });

   it('should handle microphone permission denied initially', async () => {
     mockPermissionState = 'denied';
     const { result } = renderHook(() => useVoiceInput());
     await act(async () => {}); // Wait for permission query
     expect(result.current.microphonePermissionGranted).toBe(false);
     expect(result.current.error).toBe(null); // No error just from initial state
   });

   it('should update permission status on change', async () => {
     mockPermissionState = 'prompt';
     const { result } = renderHook(() => useVoiceInput());
     await act(async () => {}); // Initial query
     expect(result.current.microphonePermissionGranted).toBe(false);

     // Simulate permission change event
     await act(async () => {
       simulatePermissionChange('granted');
     });
     expect(result.current.microphonePermissionGranted).toBe(true);

      await act(async () => {
       simulatePermissionChange('denied');
     });
     expect(result.current.microphonePermissionGranted).toBe(false);
   });


  it('should request permission and start listening when startListening is called and permission is prompt', async () => {
    mockPermissionState = 'prompt';
    const { result } = renderHook(() => useVoiceInput());
    await act(async () => {}); // Initial query

    expect(result.current.isListening).toBe(false);

    await act(async () => {
      // Mock getUserMedia success
      mockGetUserMedia.mockResolvedValueOnce(undefined);
      // Simulate granting permission after prompt
      mockPermissionState = 'granted';
      await result.current.startListening();
    });

    expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
    expect(mockStartListening).toHaveBeenCalledTimes(1);
    expect(result.current.microphonePermissionGranted).toBe(true);
    expect(result.current.isListening).toBe(true); // Should reflect library state if successful
    expect(result.current.error).toBe(null);
    expect(mockResetTranscript).toHaveBeenCalled(); // Should reset transcript
  });

  it('should not call getUserMedia if permission is already granted', async () => {
    mockPermissionState = 'granted';
    const { result } = renderHook(() => useVoiceInput());
    await act(async () => {}); // Initial query

    await act(async () => {
      await result.current.startListening();
    });

    expect(mockPermissionsQuery).toHaveBeenCalledTimes(2); // Initial + inside requestPermission
    expect(mockGetUserMedia).not.toHaveBeenCalled(); // Should not be called
    expect(mockStartListening).toHaveBeenCalledTimes(1);
    expect(result.current.isListening).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('should set error and not start listening if permission is denied', async () => {
    mockPermissionState = 'denied';
    const { result } = renderHook(() => useVoiceInput());
    await act(async () => {}); // Initial query

    await act(async () => {
      await result.current.startListening();
    });

    expect(mockPermissionsQuery).toHaveBeenCalledTimes(2); // Initial + inside requestPermission
    expect(mockGetUserMedia).not.toHaveBeenCalled();
    expect(mockStartListening).not.toHaveBeenCalled();
    expect(result.current.microphonePermissionGranted).toBe(false);
    expect(result.current.isListening).toBe(false);
    expect(result.current.error).toContain('permission denied');
  });

   it('should set error if getUserMedia fails', async () => {
    mockPermissionState = 'prompt';
    const { result } = renderHook(() => useVoiceInput());
    await act(async () => {}); // Initial query

    const permissionError = new Error('Test permission error');
    mockGetUserMedia.mockRejectedValueOnce(permissionError); // Simulate getUserMedia failure

    await act(async () => {
      await result.current.startListening();
    });

    expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
    expect(mockStartListening).not.toHaveBeenCalled();
    expect(result.current.microphonePermissionGranted).toBe(false);
    expect(result.current.isListening).toBe(false);
    expect(result.current.error).toContain('permission denied'); // Hook sets this message on catch
   });


  it('should set error if browser does not support speech recognition', async () => {
    mockBrowserSupportsSpeechRecognition = false;
    const { result } = renderHook(() => useVoiceInput());
    await act(async () => {}); // Allow effects to run

     await act(async () => {
      await result.current.startListening();
    });

    expect(mockStartListening).not.toHaveBeenCalled();
    expect(result.current.isListening).toBe(false);
    expect(result.current.error).toContain('not supported');
  });

  it('should stop listening when stopListening is called', async () => {
    // Simulate already listening state
    mockPermissionState = 'granted';
    mockIsListening = true; // Directly set the library's state via mock
     mockUseSpeechRecognition.mockImplementation(() => ({
        transcript: 'hello',
        listening: true, // Mock listening state from useSpeechRecognition
        resetTranscript: mockResetTranscript,
        browserSupportsSpeechRecognition: true,
     }));

    const { result } = renderHook(() => useVoiceInput());
    await act(async () => {}); // Allow effects to run

    expect(result.current.isListening).toBe(true); // Initial state based on mock

    await act(async () => {
      result.current.stopListening();
    });

    expect(mockStopListening).toHaveBeenCalledTimes(1);
    // The hook's internal state should update, but the test needs to reflect the library's change too
    // Let's simulate the library stopping
     act(() => {
        mockIsListening = false; // Update the mock value that the hook reads
     });
     // Re-rendering or checking again might be needed depending on timing
     // For simplicity, we check the internal state update triggered by stopListening call
     expect(result.current.isListening).toBe(false);
     expect(result.current.error).toBe(null);
  });


  it('should update transcript when speech recognition provides it', async () => {
     const { result, rerender } = renderHook(() => useVoiceInput());
     await act(async () => {}); // Initial effects

     expect(result.current.transcript).toBe('');

     // Simulate transcript update from the library
     act(() => {
        mockTranscript = 'hello world';
        // Rerender the hook as if the library caused an update
        mockUseSpeechRecognition.mockImplementation(() => ({
            transcript: mockTranscript, // New transcript
            listening: mockIsListening,
            resetTranscript: mockResetTranscript,
            browserSupportsSpeechRecognition: mockBrowserSupportsSpeechRecognition,
        }));
     });
     rerender(); // Trigger rerender to pick up new mock value

     expect(result.current.transcript).toBe('hello world');
  });

   it('should reset transcript when starting to listen', async () => {
     mockPermissionState = 'granted';
     mockTranscript = 'previous text'; // Set an initial transcript
     mockUseSpeechRecognition.mockImplementation(() => ({
        transcript: mockTranscript,
        listening: false,
        resetTranscript: mockResetTranscript,
        browserSupportsSpeechRecognition: true,
     }));

     const { result } = renderHook(() => useVoiceInput());
     await act(async () => {}); // Initial effects

     await act(async () => {
       await result.current.startListening();
     });

     expect(mockResetTranscript).toHaveBeenCalled();
   });

    it('should handle errors during startListening call from the library', async () => {
        mockPermissionState = 'granted';
        const startError = new Error('Library failed to start');
        mockStartListening.mockRejectedValueOnce(startError);

        const { result } = renderHook(() => useVoiceInput());
        await act(async () => {}); // Initial effects

        await act(async () => {
            await result.current.startListening();
        });

        expect(mockStartListening).toHaveBeenCalledTimes(1);
        expect(result.current.isListening).toBe(false);
        expect(result.current.error).toContain('Error starting speech recognition');
        expect(result.current.error).toContain('Library failed to start');
        expect(mockStopListening).toHaveBeenCalled(); // Should attempt to stop if start fails partially
    });

    it('should handle errors during stopListening call from the library', async () => {
        mockPermissionState = 'granted';
        mockIsListening = true;
        mockUseSpeechRecognition.mockImplementation(() => ({
            transcript: 'test',
            listening: true,
            resetTranscript: mockResetTranscript,
            browserSupportsSpeechRecognition: true,
        }));
        const stopError = new Error('Library failed to stop');
        mockStopListening.mockImplementationOnce(() => { throw stopError; }); // Throw error on stop

        const { result } = renderHook(() => useVoiceInput());
        await act(async () => {}); // Initial effects

        expect(result.current.isListening).toBe(true);

        await act(async () => {
            result.current.stopListening();
        });

        expect(mockStopListening).toHaveBeenCalledTimes(1);
        expect(result.current.isListening).toBe(false); // State is forced to false even on error
        expect(result.current.error).toContain('Error stopping speech recognition');
        expect(result.current.error).toContain('Library failed to stop');
    });

});
