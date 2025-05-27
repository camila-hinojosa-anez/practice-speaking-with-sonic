# Amazon Nova Sonic TypeScript Example: Real-time Audio Streaming with AWS Bedrock Integration

This project implements a bidirectional WebSocket-based audio streaming application that integrates with Amazon Nova Sonic model for real-time speech-to-speech conversion. The application enables natural conversational interactions through a web interface while leveraging Amazon's new powerful Nova Sonic model for processing and generating responses.

The system consists of a server that handles the bidirectional streaming and AWS Bedrock integration, paired with a modern web client that manages audio streaming and user interactions. Key features include real-time audio streaming, integration with Amazon Nova Sonic model, bidirectional communication handling, and a responsive web interface with chat history management. It supports also command-line interface to run an interaction with a recorded audio.

## Repository Structure
```
.
├── public/                 # Frontend web application files
│   ├── index.html          # Main application entry point
│   └── src/                # Frontend source code
│       ├── lib/            # Core frontend libraries
│       │   ├── play/       # Audio playback components
│       │   └── util/       # Utility functions and managers
│       ├── main.js         # Main application logic
│       ├── pdf-upload.js   # PDF upload functionality
│       └── style.css       # Application styling
├── src/                    # TypeScript source files
│   ├── client.ts           # AWS Bedrock client implementation
│   ├── config.ts           # Configuration management
│   ├── routes/             # Express routes
│   │   └── upload.ts       # PDF upload routes
│   ├── s3-bedrock-client.ts # S3 and Bedrock KB client
│   ├── server.ts           # Express server implementation
│   └── types.ts            # TypeScript type definitions
├── .env.example            # Example environment variables
└── tsconfig.json           # TypeScript configuration
```

## Usage Instructions
### Prerequisites
- Node.js (v14 or higher)
- AWS Account with Bedrock access
- AWS CLI configured with appropriate credentials
- Modern web browser with WebAudio API support
- S3 bucket for PDF storage
- Bedrock Knowledge Base configured

**Required packages:**

```json
{
  "dependencies": {
    "@aws-sdk/client-bedrock-runtime": "^3.785",
    "@aws-sdk/client-bedrock-agent": "^3.817.0",
    "@aws-sdk/client-bedrock-agent-runtime": "^3.817.0",
    "@aws-sdk/client-s3": "^3.817.0",
    "@aws-sdk/credential-providers": "^3.782",
    "@smithy/node-http-handler": "^4.0.4",
    "@smithy/types": "^4.1.0",
    "@types/express": "^5.0.0",
    "@types/node": "^22.13.9",
    "axios": "^1.6.2",
    "dotenv": "^16.3.1",
    "express": "^4.21.2",
    "multer": "^2.0.0",
    "pnpm": "^10.6.1",
    "rxjs": "^7.8.2",
    "socket.io": "^4.8.1",
    "ts-node": "^10.9.2",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@types/multer": "^1.4.12",
    "@types/uuid": "^10.0.0",
    "tsx": "^4.19.3"
  }
}
```

### Installation
1. Clone the repository:
```bash
git clone <repository-url>
cd <repository-name>
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file with your specific values
nano .env
```

4. Configure AWS credentials:
```bash
# Configure AWS CLI with your credentials
aws configure --profile bedrock-test
```

5. Build the TypeScript code:
```bash
npm run build
```

### Quick Start
1. Start the server:
```bash
npm start
```

2. Open your browser:
```
http://localhost:3000
```

3. Grant microphone permissions when prompted.

### Environment Variables
The application uses the following environment variables:

```
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=bedrock-test

# Bedrock Knowledge Base Configuration
KNOWLEDGE_BASE_ID=your-knowledge-base-id
DATA_SOURCE_ID=your-data-source-id

# S3 Configuration
S3_BUCKET_NAME=your-s3-bucket-name

# Server Configuration
PORT=3000
```

### PDF Upload Feature
The application includes a feature to upload PDF files to an S3 bucket and trigger a Bedrock Knowledge Base sync:

1. Click the "Choose File" button in the PDF upload section
2. Select a PDF file (max 10MB)
3. Click "Upload PDF"
4. The application will:
   - Upload the PDF to your S3 bucket
   - Trigger a Knowledge Base sync
   - Display the sync status

### More Detailed Examples
1. Starting a conversation:
```javascript
// Initialize audio context and request microphone access
await initAudio();
// Click the Start button to begin streaming
startButton.onclick = startStreaming;
```

2. Customizing the system prompt:
```javascript
const SYSTEM_PROMPT = "You are a friend. The user and you will engage in a spoken...";
socket.emit('systemPrompt', SYSTEM_PROMPT);
```

### Troubleshooting
1. Microphone Access Issues
- Problem: Browser shows "Permission denied for microphone"
- Solution: 
  ```javascript
  // Check if microphone permissions are granted
  const permissions = await navigator.permissions.query({ name: 'microphone' });
  if (permissions.state === 'denied') {
    console.error('Microphone access is required');
  }
  ```

2. Audio Playback Issues
- Problem: No audio output
- Solution:
  ```javascript
  // Verify AudioContext is initialized
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  ```

3. Connection Issues
- Check server logs for connection status
- Verify WebSocket connection:
  ```javascript
  socket.on('connect_error', (error) => {
    console.error('Connection failed:', error);
  });
  ```

4. Environment Variable Issues
- Problem: "Missing required environment variables" error
- Solution: Ensure all required variables are set in your `.env` file

## Data Flow
The application processes audio input through a pipeline that converts speech to text, processes it with AWS Bedrock, and returns both text and audio responses.

```ascii
User Speech -> Browser → Server → Client
     ↑                               ↓
     │                   Amazon Nova Sonic Model
     │                               ↓
Audio Output ← Browser ← Server ← Client
```

Key flow components:
1. User speaks into the microphone through Browser
2. Audio is streamed through Server to Client
3. Client sends audio to Amazon Nova Sonic Model
4. Nova Sonic processes audio and generates AI response
5. Response is sent back through client to server to browser
6. Browser plays audio response to user


## Infrastructure
The application runs on a Node.js server with the following key components:

- Express.js server handling WebSocket connections
- Socket.IO for real-time communication
- Nova Sonic client for speech to speech model processing
- S3 storage for PDF documents
- Bedrock Knowledge Base integration
