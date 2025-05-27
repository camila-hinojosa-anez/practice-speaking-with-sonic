import express, { Request, Response } from 'express';
import multer from 'multer';
import { S3BedrockClient } from '../s3-bedrock-client';

const router = express.Router();
const s3BedrockClient = new S3BedrockClient();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (_fileReq, file, cb) => {
        // Accept only PDF files
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(null, false);
            return cb(new Error('Only PDF files are allowed'));
        }
    }
});

/**
 * Route for uploading PDF files
 * This route handles:
 * 1. File upload validation
 * 2. S3 upload
 * 3. Bedrock Knowledge Base sync trigger
 */
router.post('/pdf', upload.single('pdfFile'), async (req, res) => {
    try {
        // Check if file exists in the request
        if (!req.file) {
            res.status(400).json({
                success: false,
                message: 'No PDF file provided or invalid file type'
            });
            return;
        }

        // Get file details
        const fileBuffer = req.file.buffer;
        const fileName = req.file.originalname;

        // Upload file to S3
        const s3Key = await s3BedrockClient.uploadPdfToS3(fileBuffer, fileName);

        // Trigger Knowledge Base sync
        const jobId = await s3BedrockClient.triggerKnowledgeBaseSync();

        // Return success response
        res.status(200).json({
            success: true,
            message: 'PDF uploaded and Knowledge Base sync triggered successfully',
            data: {
                fileName,
                s3Key,
                jobId
            }
        });
    } catch (error) {
        console.error('Error handling PDF upload:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing PDF upload',
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

/**
 * Route for checking the status of a Knowledge Base ingestion job
 */
router.get('/sync-status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        
        if (!jobId) {
            res.status(400).json({
                success: false,
                message: 'Job ID is required'
            });
            return;
        }

        const status = await s3BedrockClient.checkIngestionJobStatus(jobId);
        
        res.status(200).json({
            success: true,
            data: {
                jobId,
                status
            }
        });
    } catch (error) {
        console.error('Error checking sync status:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking sync status',
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

export default router;
