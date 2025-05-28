class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
    }

    process(inputs) {
        const input = inputs[0];
        if (input && input[0]) {
            // Send audio data to main thread
            this.port.postMessage(input[0]);
        }
        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);