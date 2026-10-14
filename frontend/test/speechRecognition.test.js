import test from 'node:test';
import assert from 'node:assert/strict';
import {
  combineSpeechDraft,
  getSpeechRecognitionConstructor,
  speechRecognitionErrorMessage,
  transcriptFromResults,
} from '../src/utils/speechRecognition.js';

test('detects standard and Chromium speech recognition APIs', () => {
  const Standard = function Standard() {};
  const Chromium = function Chromium() {};

  assert.equal(getSpeechRecognitionConstructor({ SpeechRecognition: Standard }), Standard);
  assert.equal(getSpeechRecognitionConstructor({ webkitSpeechRecognition: Chromium }), Chromium);
  assert.equal(getSpeechRecognitionConstructor({}), null);
});

test('combines existing input with the current recognition transcript', () => {
  const results = [
    [{ transcript: 'find my ' }],
    [{ transcript: 'finance notes' }],
  ];

  assert.equal(transcriptFromResults(results), 'find my finance notes');
  assert.equal(combineSpeechDraft('Please', transcriptFromResults(results)), 'Please find my finance notes');
  assert.equal(combineSpeechDraft('', '  create a task  '), 'create a task');
});

test('returns useful microphone errors without exposing browser internals', () => {
  assert.match(speechRecognitionErrorMessage('not-allowed'), /permission was blocked/i);
  assert.match(speechRecognitionErrorMessage('audio-capture'), /microphone/i);
  assert.match(speechRecognitionErrorMessage('no-speech'), /did not hear/i);
  assert.match(speechRecognitionErrorMessage('unknown'), /try again/i);
});
