import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

declare const process: { env: { [key: string]: string | undefined } };

interface UploadFile {
  originalname: string;
  path: string;
  mimetype: string;
}

class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    this.bucketName = process.env.AWS_S3_BUCKET_NAME || '';

    if (!this.bucketName) {
      throw new Error('AWS_S3_BUCKET_NAME environment variable is required');
    }
  }

  async uploadFile(file: UploadFile): Promise<string> {
    try {
      const fileExtension = path.extname(file.originalname);
      const fileName = `knowledge-base/${uuidv4()}${fileExtension}`;

      const fileStream = fs.createReadStream(file.path);

      const uploadParams = {
        Bucket: this.bucketName,
        Key: fileName,
        Body: fileStream,
        ContentType: file.mimetype,
        ContentDisposition: `attachment; filename="${file.originalname}"`,
        Metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      };

      const upload = new Upload({
        client: this.s3Client,
        params: uploadParams,
      });

      const result = await upload.done();
      
      const publicUrl = `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileName}`;
      
      console.log(`File uploaded successfully: ${publicUrl}`);
      return publicUrl;

    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadFiles(files: UploadFile[]): Promise<string[]> {
    try {
      const uploadPromises = files.map(file => this.uploadFile(file));
      const urls = await Promise.all(uploadPromises);
      return urls;
    } catch (error) {
      console.error('Error uploading files to S3:', error);
      throw error;
    }
  }


  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const urlParts = new URL(fileUrl);
      const key = urlParts.pathname.substring(1);

      const deleteParams = {
        Bucket: this.bucketName,
        Key: key,
      };

      await this.s3Client.send(new DeleteObjectCommand(deleteParams));
      console.log(`File deleted successfully: ${fileUrl}`);

    } catch (error) {
      console.error('Error deleting file from S3:', error);
      throw new Error(`Failed to delete file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteFiles(fileUrls: string[]): Promise<void> {
    try {
      const deletePromises = fileUrls.map(url => this.deleteFile(url));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error deleting files from S3:', error);
      throw error;
    }
  }
}

export const s3Service = new S3Service(); 