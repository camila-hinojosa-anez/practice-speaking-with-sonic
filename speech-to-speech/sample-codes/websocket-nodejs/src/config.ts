import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

/**
 * Application configuration
 * All sensitive information is loaded from environment variables
 */
export const config = {
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    profile: process.env.AWS_PROFILE || 'bedrock-test'
  },
  knowledgeBase: {
    id: process.env.KNOWLEDGE_BASE_ID || '',
    dataSourceId: process.env.DATA_SOURCE_ID || ''
  },
  s3: {
    bucketName: process.env.S3_BUCKET_NAME || ''
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    publicDir: path.join(__dirname, '../public')
  }
};

/**
 * Validate required configuration
 * This ensures the application won't start without required environment variables
 */
export function validateConfig(): void {
  const requiredVars = [
    { key: 'knowledgeBase.id', value: config.knowledgeBase.id },
    { key: 'knowledgeBase.dataSourceId', value: config.knowledgeBase.dataSourceId },
    { key: 's3.bucketName', value: config.s3.bucketName }
  ];

  const missingVars = requiredVars.filter(v => !v.value);
  
  if (missingVars.length > 0) {
    const missingKeys = missingVars.map(v => v.key).join(', ');
    throw new Error(`Missing required environment variables: ${missingKeys}. Please check your .env file.`);
  }
}
