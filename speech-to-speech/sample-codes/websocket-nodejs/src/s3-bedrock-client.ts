import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { 
    BedrockAgentClient, 
    StartIngestionJobCommand,
    GetIngestionJobCommand
} from '@aws-sdk/client-bedrock-agent';
import { fromIni } from '@aws-sdk/credential-providers';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';

export class S3BedrockClient {
    private s3Client: S3Client;
    private bedrockAgentClient: BedrockAgentClient;

    constructor() {
        const credentials = fromIni({ profile: config.aws.profile });
        
        this.s3Client = new S3Client({
            region: config.aws.region,
            credentials
        });

        this.bedrockAgentClient = new BedrockAgentClient({
            region: config.aws.region,
            credentials
        });
    }

    /**
     * Upload a PDF file to S3 bucket
     * @param fileBuffer The PDF file buffer
     * @param fileName Original file name
     * @returns The S3 object key
     */
    async uploadPdfToS3(fileBuffer: Buffer, fileName: string): Promise<string> {
        // Generate a unique key for the S3 object
        const fileKey = `uploads/${uuidv4()}-${fileName}`;
        
        const uploadParams = {
            Bucket: config.s3.bucketName,
            Key: fileKey,
            Body: fileBuffer,
            ContentType: 'application/pdf'
        };

        try {
            await this.s3Client.send(new PutObjectCommand(uploadParams));
            console.log(`File uploaded successfully to S3: ${fileKey}`);
            return fileKey;
        } catch (error) {
            console.error('Error uploading file to S3:', error);
            throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Trigger a sync for the Bedrock Knowledge Base
     * @returns The ingestion job ID
     */
    async triggerKnowledgeBaseSync(): Promise<string> {
        try {
            const command = new StartIngestionJobCommand({
                knowledgeBaseId: config.knowledgeBase.id,
                dataSourceId: config.knowledgeBase.dataSourceId
            });

            const response = await this.bedrockAgentClient.send(command);
            const jobId = response.ingestionJob?.ingestionJobId;
            
            if (!jobId) {
                throw new Error('No ingestion job ID returned from Bedrock');
            }
            
            console.log(`Knowledge Base sync triggered successfully. Job ID: ${jobId}`);
            return jobId;
        } catch (error) {
            console.error('Error triggering Knowledge Base sync:', error);
            throw new Error(`Failed to trigger Knowledge Base sync: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Check the status of a Knowledge Base ingestion job
     * @param jobId The ingestion job ID
     * @returns The job status
     */
    async checkIngestionJobStatus(jobId: string): Promise<string> {
        try {
            const command = new GetIngestionJobCommand({
                knowledgeBaseId: config.knowledgeBase.id,
                dataSourceId: config.knowledgeBase.dataSourceId,
                ingestionJobId: jobId
            });

            const response = await this.bedrockAgentClient.send(command);
            const status = response.ingestionJob?.status || 'UNKNOWN';
            
            console.log(`Ingestion job ${jobId} status: ${status}`);
            return status;
        } catch (error) {
            console.error(`Error checking ingestion job status for ${jobId}:`, error);
            throw new Error(`Failed to check ingestion job status: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
