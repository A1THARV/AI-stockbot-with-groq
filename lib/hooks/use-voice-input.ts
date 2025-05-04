import { useState, useEffect, useCallback } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

interface UseVoiceInputResult {
  isListening: boolean;
  transcript: string;
  startListening: () => Promise<void>;
  stopListening: () => void;
  browserSupportsSpeechRecognition: boolean;
  microphonePermissionGranted: boolean | null; // null means permission not yet requested or pending
  error: string | null;
}

export const useVoiceInput = (): UseVoiceInputResult => {
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const [microphonePermissionGranted, setMicrophonePermissionGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [internalIsListening, setInternalIsListening] = useState<boolean>(false); // Separate state to manage listening initiation

  // Effect to sync internal listening state with the library's listening state
  useEffect(() => {
    setInternalIsListening(listening);
  }, [listening]);

  // Check initial permission status if possible (though usually requires interaction)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((permissionStatus) => {
        setMicrophonePermissionGranted(permissionStatus.state === 'granted');
        permissionStatus.onchange = () => {
          setMicrophonePermissionGranted(permissionStatus.state === 'granted');
        };
      }).catch((err) => {
         // Handle potential errors querying permission, e.g., browser doesn't support Permissions API
         console.warn("Could not query microphone permission status:", err);
         // We might not be able to determine the initial state, leave as null
      });
    }
  }, []);


  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    if (!browserSupportsSpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      setMicrophonePermissionGranted(false);
      return false;
    }
    try {
      // Check current permission status first
       if (typeof navigator !== 'undefined' && navigator.permissions) {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (permissionStatus.state === 'granted') {
             setMicrophonePermissionGranted(true);
             setError(null);
             return true;
        }
        if (permissionStatus.state === 'denied') {
            setError('Microphone permission denied. Please enable it in your browser settings.');
            setMicrophonePermissionGranted(false);
            return false;
        }
      }

      // If prompt or unknown, request permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophonePermissionGranted(true);
      setError(null); // Clear any previous errors
      return true;
    } catch (err) {
      setError('Microphone permission denied. Please enable it in your browser settings.');
      setMicrophonePermissionGranted(false);
      console.error('Error requesting microphone permission:', err);
      return false;
    }
  }, [browserSupportsSpeechRecognition]);

  const startListening = useCallback(async () => {
    setError(null); // Clear previous errors
    resetTranscript(); // Reset transcript when starting

    if (!browserSupportsSpeechRecognition) {
        setError('Speech recognition is not supported in this browser.');
        setInternalIsListening(false);
        return;
    }

    const permissionGranted = await requestMicrophonePermission();
    if (permissionGranted) {
        try {
            // Start listening with specific options if needed, e.g., continuous listening
            await SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
            setInternalIsListening(true);
        } catch (err: any) {
             console.error('Error starting speech recognition:', err);
             setError(`Error starting speech recognition: ${err.message || err}`);
             setInternalIsListening(false);
             // Attempt to stop listening in case of partial start failure
             SpeechRecognition.stopListening();
        }
    } else {
        // Error state is already set by requestMicrophonePermission
         setInternalIsListening(false);
    }
  }, [browserSupportsSpeechRecognition, requestMicrophonePermission, resetTranscript]);

  const stopListening = useCallback(() => {
    if (internalIsListening) {
        try {
            SpeechRecognition.stopListening();
            setInternalIsListening(false);
        } catch (err: any) {
             console.error('Error stopping speech recognition:', err);
             setError(`Error stopping speech recognition: ${err.message || err}`);
             // Force state update even if stop fails
             setInternalIsListening(false);
        }
    }
  }, [internalIsListening]);

  // Handle case where speech recognition stops unexpectedly (e.g. browser timeout)
   useEffect(() => {
    if (internalIsListening && !listening) {
      console.log("Speech recognition stopped unexpectedly.");
      // Optionally automatically stop or handle this state
      // stopListening(); // Or set an error, or allow restart
      setInternalIsListening(false); // Reflect the actual state
    }
  }, [listening, internalIsListening, stopListening]);


  return {
    isListening: internalIsListening,
    transcript,
    startListening,
    stopListening,
    browserSupportsSpeechRecognition,
    microphonePermissionGranted,
    error,
  };
};
