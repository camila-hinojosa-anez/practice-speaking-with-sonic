/**
 * PDF Upload functionality for the Amazon Nova Sonic application
 * This script handles the PDF upload to S3 and triggering the Knowledge Base sync
 */

document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('pdf-upload-form');
    const uploadStatus = document.getElementById('upload-status');
    const fileInput = document.getElementById('pdf-file');
    const uploadButton = document.getElementById('upload-button');

    if (!uploadForm || !uploadStatus || !fileInput || !uploadButton) {
        console.error('Required PDF upload elements not found in the DOM');
        return;
    }

    // Handle form submission
    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        // Check if a file is selected
        if (!fileInput.files || fileInput.files.length === 0) {
            updateStatus('Please select a PDF file', 'error');
            return;
        }

        const file = fileInput.files[0];
        
        // Validate file type
        if (file.type !== 'application/pdf') {
            updateStatus('Only PDF files are allowed', 'error');
            return;
        }

        // Prepare form data
        const formData = new FormData();
        formData.append('pdfFile', file);

        // Update UI
        uploadButton.disabled = true;
        updateStatus('Uploading PDF...', 'info');

        try {
            // Send the file to the server
            const response = await fetch('/api/pdf', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Upload failed');
            }

            // Handle successful upload
            updateStatus(`PDF uploaded successfully! Knowledge Base sync triggered with job ID: ${result.data.jobId}`, 'success');
            
            // Start polling for job status
            pollJobStatus(result.data.jobId);
        } catch (error) {
            console.error('Error uploading PDF:', error);
            updateStatus(`Upload failed: ${error.message}`, 'error');
        } finally {
            uploadButton.disabled = false;
        }
    });

    /**
     * Poll for the status of the Knowledge Base ingestion job
     * @param {string} jobId The ingestion job ID
     */
    async function pollJobStatus(jobId) {
        let attempts = 0;
        const maxAttempts = 10;
        const pollInterval = 10000; // 10 seconds

        const checkStatus = async () => {
            try {
                const response = await fetch(`/api/sync-status/${jobId}`);
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || 'Failed to check status');
                }

                const status = result.data.status;
                
                // Update status message
                updateStatus(`Knowledge Base sync status: ${status}`, 'info');

                // Check if the job is complete or failed
                if (status === 'COMPLETE') {
                    updateStatus('Knowledge Base sync completed successfully!', 'success');
                    return;
                } else if (status === 'FAILED') {
                    updateStatus('Knowledge Base sync failed', 'error');
                    return;
                }

                // Continue polling if not complete and not exceeded max attempts
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(checkStatus, pollInterval);
                } else {
                    updateStatus('Sync is still in progress. Check AWS console for status.', 'info');
                }
            } catch (error) {
                console.error('Error checking job status:', error);
                updateStatus(`Error checking sync status: ${error.message}`, 'error');
            }
        };

        // Start polling
        setTimeout(checkStatus, pollInterval);
    }

    /**
     * Update the status message with appropriate styling
     * @param {string} message The status message
     * @param {string} type The message type (info, success, error)
     */
    function updateStatus(message, type = 'info') {
        uploadStatus.textContent = message;
        uploadStatus.className = `status-message ${type}`;
    }
});
