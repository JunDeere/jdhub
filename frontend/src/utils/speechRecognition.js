export function getSpeechRecognitionConstructor(scope = globalThis) {
  return scope?.SpeechRecognition || scope?.webkitSpeechRecognition || null;
}

export function speechRecognitionErrorMessage(code) {
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return 'Microphone permission was blocked. Allow microphone access and try again.';
  }
  if (code === 'audio-capture') return 'No working microphone was found.';
  if (code === 'no-speech') return 'I did not hear anything. Try again.';
  if (code === 'network') return 'Voice input could not reach the speech service.';
  return 'Voice input stopped unexpectedly. Try again.';
}

export function transcriptFromResults(results) {
  let transcript = '';
  for (let index = 0; index < (results?.length || 0); index += 1) {
    transcript += results[index]?.[0]?.transcript || '';
  }
  return transcript.trim();
}

export function combineSpeechDraft(baseDraft, transcript) {
  return [String(baseDraft || '').trim(), String(transcript || '').trim()]
    .filter(Boolean)
    .join(' ');
}
