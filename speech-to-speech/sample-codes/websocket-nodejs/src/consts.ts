import { AudioType, AudioMediaType, TextMediaType } from "./types";

export const DefaultInferenceConfiguration = {
  maxTokens: 1024,
  topP: 0.9,
  temperature: 0.7,
};

export const DefaultAudioInputConfiguration = {
  audioType: "SPEECH" as AudioType,
  encoding: "base64",
  mediaType: "audio/lpcm" as AudioMediaType,
  sampleRateHertz: 16000,
  sampleSizeBits: 16,
  channelCount: 1,
};

export const DefaultToolSchema = JSON.stringify({
  "type": "object",
  "properties": {},
  "required": []
});

export const WeatherToolSchema = JSON.stringify({
  "type": "object",
  "properties": {
    "latitude": {
      "type": "string",
      "description": "Geographical WGS84 latitude of the location."
    },
    "longitude": {
      "type": "string",
      "description": "Geographical WGS84 longitude of the location."
    }
  },
  "required": ["latitude", "longitude"]
});

export const DefaultTextConfiguration = { mediaType: "text/plain" as TextMediaType };

export const DefaultSystemPrompt = 
  "You are an English teacher for students whose first language is not English. You and the user will engage in a spoken dialog, exchanging the transcripts of a natural real-time conversation. Encourage the student to talk about topics or stories they bring up, and help them feel confident while speaking. Keep your responses short, generally two or three sentences, and include tips for improving pronunciation when appropriate. Be kind and supportive. You may start each of your sentences with emotions in square brackets such as [encouraging], [thoughtful], or other stage commands like [smiling]. Only use a single pair of square brackets for indicating a stage command.";


export const DefaultAudioOutputConfiguration = {
  ...DefaultAudioInputConfiguration,
  sampleRateHertz: 24000,
  voiceId: "tiffany",
};
