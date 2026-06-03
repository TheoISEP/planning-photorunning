import { google } from 'googleapis';
import { Readable } from 'stream';

const BRIEF_FOLDER_ID = process.env.GOOGLE_DRIVE_BRIEF_FOLDER_ID!;

export class GoogleDriveService {
  private drive;
  private auth;

  constructor() {
    this.auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  /**
   * Upload un fichier PDF dans le dossier Brief
   */
  async uploadBrief(
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string = 'application/pdf'
  ): Promise<{ fileId: string; webViewLink: string }> {
    const fileMetadata = {
      name: fileName,
      parents: [BRIEF_FOLDER_ID],
    };

    const media = {
      mimeType,
      body: Readable.from(fileBuffer),
    };

    const response = await this.drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, webViewLink',
      supportsAllDrives: true, // Support pour Shared Drives
    });

    const fileId = response.data.id!;
    const webViewLink = response.data.webViewLink!;

    // Rendre le fichier accessible (anyone with link)
    await this.drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true, // Support pour Shared Drives
    });

    return { fileId, webViewLink };
  }

  /**
   * Supprimer un fichier
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.drive.files.delete({
      fileId,
      supportsAllDrives: true, // Support pour Shared Drives
    });
  }

  /**
   * Obtenir le lien de téléchargement d'un fichier
   */
  async getFileLink(fileId: string): Promise<string> {
    const response = await this.drive.files.get({
      fileId,
      fields: 'webViewLink',
      supportsAllDrives: true, // Support pour Shared Drives
    });

    return response.data.webViewLink!;
  }
}
