import express from 'express';
import http from 'http';
import path from 'path';
import { v4 as uuidv4 } from 'uuid'; // Import uuidv4 for generating unique IDs
import { randomUUID } from "crypto";

import { Server } from 'socket.io';
import { fromIni } from "@aws-sdk/credential-providers";
import { NovaSonicBidirectionalStreamClient } from './client'; // Assuming this is your client library for Nova Sonic
import { Buffer } from 'node:buffer';
import { queryKnowledgeBase } from './kb'; // Assuming this is your knowledge base query function
// Import the DefaultAudioInputConfiguration type from your consts file
import { DefaultAudioInputConfiguration } from './consts';


// Configure AWS credentials
const AWS_PROFILE_NAME = process.env.AWS_PROFILE || 'bedrock-test';

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Define a default audio configuration for Nova Sonic.
// This configuration is primarily for the *user's* audio input,
// as the agent's audio output is managed implicitly by Nova Sonic
// when text content is sent for synthesis.
// The 'audioType: "SPEECH"' is typically required for Bedrock's speech input.
const DEFAULT_AUDIO_CONFIG: typeof DefaultAudioInputConfiguration = { // Explicitly type it
    audioType: 'SPEECH', // Changed to "SPEECH" to match expected type for audio input
    encoding: 'pcm',  // Encoding of the audio data (e.g., pcm, opus)
    mediaType: 'audio/lpcm', // Changed to "audio/lpcm" to match the expected type
    sampleRateHertz: 16000, // Sample rate in Hertz (e.g., 8000, 16000, 22050)
    sampleSizeBits: 16, // Number of bits per audio sample (e.g., 16)
    channelCount: 1, // Number of audio channels (e.g., 1 for mono)
};


// Create the AWS Bedrock client
const bedrockClient = new NovaSonicBidirectionalStreamClient({
    requestHandlerConfig: {
        maxConcurrentStreams: 10,
    },
    clientConfig: {
        region: process.env.AWS_REGION || "us-east-1",
        credentials: fromIni({ profile: AWS_PROFILE_NAME })
    }
});

// Periodically check for and close inactive sessions (every minute)
// Sessions with no activity for over 5 minutes will be force closed
setInterval(() => {
    console.log("Session cleanup check");
    const now = Date.now();

    // Check all active sessions
    bedrockClient.getActiveSessions().forEach(sessionId => {
        const lastActivity = bedrockClient.getLastActivityTime(sessionId);

        // If no activity for 5 minutes, force close
        if (now - lastActivity > 5 * 60 * 1000) {
            console.log(`Closing inactive session ${sessionId} after 5 minutes of inactivity`);
            try {
                bedrockClient.forceCloseSession(sessionId);
            } catch (error) {
                console.error(`Error force closing inactive session ${sessionId}:`, error);
            }
        }
    });
}, 60000);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Socket.IO connection handler
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Create a unique session ID for this client
    const sessionId = socket.id;

    try {
        // Create session with the new API
        const session = bedrockClient.createStreamSession(sessionId);
        bedrockClient.initiateSession(sessionId)

        setInterval(() => {
            const connectionCount = Object.keys(io.sockets.sockets).length;
            console.log(`Active socket connections: ${connectionCount}`);
        }, 60000);

        // Set up event handlers
        session.onEvent('contentStart', (data) => {
            console.log('contentStart:', data);
            socket.emit('contentStart', data);
        });

        session.onEvent('textOutput', (data) => {
            console.log('Text output:', data);
            socket.emit('textOutput', data);
        });

        session.onEvent('audioOutput', (data) => {
            console.log('Audio output received, sending to client');
            socket.emit('audioOutput', data);
        });

        session.onEvent('error', (data) => {
            console.error('Error in session:', data);
            socket.emit('error', data);
        });

        session.onEvent('toolUse', (data) => {
            console.log('Tool use detected:', data.toolName);
            socket.emit('toolUse', data);
        });

        session.onEvent('toolResult', (data) => {
            console.log('Tool result received');
            socket.emit('toolResult', data);
        });

        socket.on('userText', async (text: string) => {
            try {
                console.log('Texto recibido para KB:', text);

                // Consultar a la Knowledge Base
                const answer = await queryKnowledgeBase(text);
                console.log('Respuesta de la KB:', answer);

                // Generar un nuevo contentId para la respuesta del agente
                const agentContentId = randomUUID();

                // Helper to wait for contentEnd for this contentId
                const waitForContentEnd = () => new Promise<void>((resolve) => {
                    const handler = (data: any) => {
                        if (data.contentId === agentContentId) {
                            session.offEvent('contentEnd', handler); // Remove handler after use
                            resolve();
                        }
                    };
                    session.onEvent('contentEnd', handler);
                });

                // ...existing code...
                // Enviar la respuesta del agente como texto, para que Nova Sonic la lea en voz alta
                // Use the prompt with the KB answer
                const prompt = `ALWAYS ASK THE NAME OF THE PERSON AT THE BEGGINING OF THE CONVERSATION AND The user asked: "${text}". Here is the answer from your knowledge base: "${answer}". 
                Please answer the user's question using ONLY the information from the knowledge base above. 
                If the answer is not relevant, politely say you don't know. Speak as an encouraging English teacher.`;
                await session.sendTextContent(agentContentId, prompt, "ASSISTANT");
                // ...existing code...

                // Wait for contentEnd before ending prompt
                await waitForContentEnd();
                await session.endPrompt();

            } catch (error) {
                console.error("Error en la sesión:", error);
                socket.emit('error', {
                    source: 'responseStream',
                    message: 'Error processing response stream',
                    details: String(error)
                });
            }
        });


        session.onEvent('contentEnd', (data) => {
            console.log('Content end received: ', data);
            socket.emit('contentEnd', data);
        });

        session.onEvent('streamComplete', () => {
            console.log('Stream completed for client:', socket.id);
            socket.emit('streamComplete');
        });

        // Simplified audioInput handler without rate limiting
        socket.on('audioInput', async (audioData) => {
            try {
                // Convert base64 string to Buffer
                const audioBuffer = typeof audioData === 'string'
                    ? Buffer.from(audioData, 'base64')
                    : Buffer.from(audioData);

                // Stream the audio
                await session.streamAudio(audioBuffer);

            } catch (error) {
                console.error('Error processing audio:', error);
                socket.emit('error', {
                    message: 'Error processing audio',
                    details: error instanceof Error ? error.message : String(error)
                });
            }
        });

        socket.on('promptStart', async () => {
            try {
                console.log('Prompt start received');
                await session.setupPromptStart();
            } catch (error) {
                console.error('Error processing prompt start:', error);
                socket.emit('error', {
                    message: 'Error processing prompt start',
                    details: error instanceof Error ? error.message : String(error)
                });
            }
        });

        socket.on('systemPrompt', async (data) => {
            try {
                console.log('System prompt received', data);
                // This is the initial system prompt for the entire session
                await session.setupSystemPrompt(undefined,
                    "You are an English teacher for students whose first language is not English. You and the user will engage in a spoken dialog, exchanging the transcripts of a natural real-time conversation. Encourage the student to talk about topics or stories they bring up, and help them feel confident while speaking. Keep your responses short, generally two or three sentences, and include tips for improving pronunciation when appropriate. Be kind and supportive. You may start each of your sentences with emotions in square brackets such as [encouraging], [thoughtful], or other stage commands like [smiling]. Only use a single pair of square brackets for indicating a stage command."
                );

            } catch (error) {
                console.error('Error processing system prompt:', error);
                socket.emit('error', {
                    message: 'Error processing system prompt',
                    details: error instanceof Error ? error.message : String(error)
                });
            }
        });

        socket.on('audioStart', async (data) => {
            try {
                console.log('Audio start received', data);
                // This is for the user's audio. The contentId for this would typically
                // be managed by the client sending the audio.
                // It's important to use the DEFAULT_AUDIO_CONFIG here for the user's input.
                await session.setupStartAudio(DEFAULT_AUDIO_CONFIG);
            } catch (error) {
                console.error('Error processing audio start:', error);
                socket.emit('error', {
                    message: 'Error processing audio start',
                    details: error instanceof Error ? error.message : String(error)
                });
            }
        });

        socket.on('stopAudio', async () => {
            try {
                console.log('Stop audio requested, beginning proper shutdown sequence');

                // Chain the closing sequence
                await Promise.all([
                    session.endAudioContent()
                        .then(() => session.endPrompt())
                        .then(() => session.close())
                        .then(() => console.log('Session cleanup complete'))
                ]);
            } catch (error) {
                console.error('Error processing streaming end events:', error);
                socket.emit('error', {
                    message: 'Error processing streaming end events',
                    details: error instanceof Error ? error.message : String(error)
                });
            }
        });

        // Handle disconnection
        socket.on('disconnect', async () => {
            console.log('Client disconnected abruptly:', socket.id);

            if (bedrockClient.isSessionActive(sessionId)) {
                try {
                    console.log(`Beginning cleanup for abruptly disconnected session: ${socket.id}`);

                    // Add explicit timeouts to avoid hanging promises
                    const cleanupPromise = Promise.race([
                        (async () => {
                            await session.endAudioContent();
                            await session.endPrompt();
                            await new Promise(resolve => setTimeout(resolve, 500)); // ✅ Give Bedrock time
                        })(),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Session cleanup timeout')), 3000)
                        )
                    ]);

                    await cleanupPromise;
                    console.log(`Successfully cleaned up session after abrupt disconnect: ${socket.id}`);
                } catch (error) {
                    console.error(`Error cleaning up session after disconnect: ${socket.id}`, error);
                    try {
                        bedrockClient.forceCloseSession(sessionId);
                        console.log(`Force closed session: ${sessionId}`);
                    } catch (e) {
                        console.error(`Failed even force close for session: ${sessionId}`, e);
                    }
                } finally {
                    // Make sure socket is fully closed in all cases
                    if (socket.connected) {
                        socket.disconnect(true);
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error creating session:', error);
        socket.emit('error', {
            message: 'Failed to initialize session',
            details: error instanceof Error ? error.message : String(error)
        });
        socket.disconnect();
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser to access the application`);
});

process.on('SIGINT', async () => {
    console.log('Shutting down server...');

    const forceExitTimer = setTimeout(() => {
        console.error('Forcing server shutdown after timeout');
        process.exit(1);
    }, 5000);

    try {
        // First close Socket.IO server which manages WebSocket connections
        await new Promise(resolve => io.close(resolve));
        console.log('Socket.IO server closed');

        // Then close all active sessions
        const activeSessions = bedrockClient.getActiveSessions();
        console.log(`Closing ${activeSessions.length} active sessions...`);

        await Promise.all(activeSessions.map(async (sessionId) => {
            try {
                await bedrockClient.closeSession(sessionId);
                console.log(`Closed session ${sessionId} during shutdown`);
            } catch (error) {
                console.error(`Error closing session ${sessionId} during shutdown:`, error);
                bedrockClient.forceCloseSession(sessionId);
            }
        }));

        // Now close the HTTP server with a promise
        await new Promise(resolve => server.close(resolve));
        clearTimeout(forceExitTimer);
        console.log('Server shut down');
        process.exit(0);
    } catch (error) {
        console.error('Error during server shutdown:', error);
        process.exit(1);
    }
});
