import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

// GIDs des feuilles
const SHEET_GIDS = {
  PHOTOGRAPHES: 0,
  DISPONIBILITES: 658603341,
  ADMIN: 126603588,
  HOTELS: 495511344,
  TRANSPORTS: 653455925,
  COURSES: 653455925,
  TARIFS: 2057569099,
  SUPPLEMENTAIRES: 1506173637,
  STATS_PHOTOGRAPHES: 1051987990,
  STATS_ADMIN: 850417998,
} as const;

// Noms des feuilles
const SHEET_NAMES = {
  PHOTOGRAPHES: 'Photographes',
  DISPONIBILITES: 'Disponibilités',
  ADMIN: 'Admin',
  HOTELS: 'Hotels',
  TRANSPORTS: 'Transports',
  COURSES: 'Courses',
  TARIFS: 'Tarifs',
  SUPPLEMENTAIRES: 'Supplémentaires',
  STATS_PHOTOGRAPHES: 'Statistiquesphotographes',
  STATS_ADMIN: 'Statistiquesadmin',
} as const;

export class GoogleSheetsService {
  private sheets;
  private auth;

  constructor() {
    this.auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  // ============================================================================
  // PHOTOGRAPHES
  // ============================================================================

  async findPhotographerByEmail(email: string) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.PHOTOGRAPHES}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return null;

    const headers = rows[0];
    const emailIndex = headers.indexOf('email');
    const dataRows = rows.slice(1);

    for (const row of dataRows) {
      if (row[emailIndex] === email) {
        return this.rowToObject(headers, row);
      }
    }

    return null;
  }

  async getPhotographerById(id: string) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.PHOTOGRAPHES}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return null;

    const headers = rows[0];
    const idIndex = headers.indexOf('id');
    const dataRows = rows.slice(1);

    for (const row of dataRows) {
      if (row[idIndex] === id) {
        return this.rowToObject(headers, row);
      }
    }

    return null;
  }

  async getAllPhotographers() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.PHOTOGRAPHES}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const headers = rows[0];
    const dataRows = rows.slice(1);

    return dataRows.map(row => this.rowToObject(headers, row));
  }

  async createPhotographer(data: Record<string, any>) {
    const headers = await this.getSheetHeaders(SHEET_NAMES.PHOTOGRAPHES);
    const values = headers.map(header => data[header] ?? '');

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.PHOTOGRAPHES}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values],
      },
    });

    return data;
  }

  async updatePhotographer(id: string, data: Record<string, any>) {
    // 1. Trouver la ligne
    const rowIndex = await this.findRowIndexById(SHEET_NAMES.PHOTOGRAPHES, id);
    if (rowIndex === -1) throw new Error('Photographe non trouvé');

    // 2. Récupérer les données actuelles
    const currentData = await this.getPhotographerById(id);
    if (!currentData) throw new Error('Photographe non trouvé');

    // 3. Fusionner les données
    const updatedData = { ...currentData, ...data, id }; // Toujours garder l'ID

    // 4. Mettre à jour
    const headers = await this.getSheetHeaders(SHEET_NAMES.PHOTOGRAPHES);
    const values = headers.map(header => (updatedData as any)[header] ?? '');

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.PHOTOGRAPHES}!A${rowIndex}:Z${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values],
      },
    });

    return updatedData;
  }

  // ============================================================================
  // ADMIN
  // ============================================================================

  async findAdminByEmail(email: string) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.ADMIN}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return null;

    const headers = rows[0];
    const emailIndex = headers.indexOf('email');
    const dataRows = rows.slice(1);

    for (const row of dataRows) {
      if (row[emailIndex] === email) {
        return this.rowToObject(headers, row);
      }
    }

    return null;
  }

  async createAdmin(data: Record<string, any>) {
    const headers = await this.getSheetHeaders(SHEET_NAMES.ADMIN);
    const values = headers.map(header => data[header] ?? '');

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.ADMIN}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values],
      },
    });

    return data;
  }

  async getAllAdmins() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.ADMIN}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const headers = rows[0];
    const dataRows = rows.slice(1);
    return dataRows.map(row => this.rowToObject(headers, row));
  }

  async getAdminById(id: string) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.ADMIN}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return null;

    const headers = rows[0];
    const idIndex = headers.indexOf('id');
    const dataRows = rows.slice(1);

    for (const row of dataRows) {
      if (row[idIndex] === id) {
        return this.rowToObject(headers, row);
      }
    }

    return null;
  }

  async updateAdmin(id: string, data: Record<string, any>) {
    // 1. Trouver la ligne de l'admin
    const rowIndex = await this.findRowIndexById(SHEET_NAMES.ADMIN, id);
    if (rowIndex === -1) throw new Error('Admin non trouvé');

    // 2. Récupérer les données actuelles
    const currentData = await this.getAdminById(id);
    if (!currentData) throw new Error('Admin non trouvé');

    // 3. Fusionner les données
    const updatedData = { ...currentData, ...data, id };

    // 4. Mettre à jour la ligne
    const headers = await this.getSheetHeaders(SHEET_NAMES.ADMIN);
    const values = headers.map(header => (updatedData as any)[header] ?? '');

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.ADMIN}!A${rowIndex}:Z${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values],
      },
    });

    return updatedData;
  }

  // ============================================================================
  // COURSES
  // ============================================================================

  async getAllCourses() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.COURSES}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const headers = rows[0];
    const dataRows = rows.slice(1);

    return dataRows.map(row => this.rowToObject(headers, row));
  }

  async getCourseById(id: string) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.COURSES}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return null;

    const headers = rows[0];
    const idIndex = headers.indexOf('id');
    const dataRows = rows.slice(1);

    for (const row of dataRows) {
      if (row[idIndex] === id) {
        return this.rowToObject(headers, row);
      }
    }

    return null;
  }

  async createCourse(data: Record<string, any>) {
    const headers = await this.getSheetHeaders(SHEET_NAMES.COURSES);
    const values = headers.map(header => data[header] ?? '');

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.COURSES}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values],
      },
    });

    return data;
  }

  async updateCourse(id: string, data: Record<string, any>) {
    const rowIndex = await this.findRowIndexById(SHEET_NAMES.COURSES, id);
    if (rowIndex === -1) throw new Error('Course non trouvée');

    // Récupérer les données actuelles
    const currentData = await this.getCourseById(id);
    if (!currentData) throw new Error('Course non trouvée');

    // Fusionner les données
    const updatedData = { ...currentData, ...data, id };

    const headers = await this.getSheetHeaders(SHEET_NAMES.COURSES);
    const values = headers.map(header => (updatedData as any)[header] ?? '');

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.COURSES}!A${rowIndex}:Z${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values],
      },
    });

    return updatedData;
  }

  // ============================================================================
  // TARIFS
  // ============================================================================

  async createTarif(data: Record<string, any>) {
    const headers = await this.getSheetHeaders(SHEET_NAMES.TARIFS);
    const values = headers.map(header => data[header] ?? '');

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.TARIFS}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values],
      },
    });

    return data;
  }

  async getTarifByCourseId(courseId: string) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.TARIFS}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return null;

    const headers = rows[0];
    const courseIdIndex = headers.indexOf('courseId');
    const dataRows = rows.slice(1);

    for (const row of dataRows) {
      if (row[courseIdIndex] === courseId) {
        return this.rowToObject(headers, row);
      }
    }

    return null;
  }

  async getTarifsByCourseId(courseId: string) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.TARIFS}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const headers = rows[0];
    const courseIdIndex = headers.indexOf('courseId');
    const dataRows = rows.slice(1);

    const tarifs = [];
    for (const row of dataRows) {
      if (row[courseIdIndex] === courseId) {
        tarifs.push(this.rowToObject(headers, row));
      }
    }

    return tarifs;
  }

  async getTarifById(id: string) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.TARIFS}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return null;

    const headers = rows[0];
    const idIndex = headers.indexOf('id');
    const dataRows = rows.slice(1);

    for (const row of dataRows) {
      if (row[idIndex] === id) {
        return this.rowToObject(headers, row);
      }
    }

    return null;
  }

  async getAllTarifs() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.TARIFS}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const headers = rows[0];
    const dataRows = rows.slice(1);

    return dataRows.map(row => this.rowToObject(headers, row));
  }

  async updateTarif(id: string, data: Record<string, any>) {
    const rowIndex = await this.findRowIndexById(SHEET_NAMES.TARIFS, id);
    if (rowIndex === -1) throw new Error('Tarif non trouvé');

    // Récupérer les données actuelles
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.TARIFS}!A${rowIndex}:Z${rowIndex}`,
    });

    const headers = await this.getSheetHeaders(SHEET_NAMES.TARIFS);
    const currentRow = response.data.values?.[0] || [];
    const currentData = this.rowToObject(headers, currentRow);

    // Fusionner les données
    const updatedData = { ...currentData, ...data, id };

    const values = headers.map(header => (updatedData as any)[header] ?? '');

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.TARIFS}!A${rowIndex}:Z${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values],
      },
    });

    return updatedData;
  }

  // ============================================================================
  // DISPONIBILITÉS
  // ============================================================================

  async getDisponibilitesByCourseId(courseId: string) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.DISPONIBILITES}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const headers = rows[0];
    const courseIdIndex = headers.indexOf('courseId');
    const dataRows = rows.slice(1);

    return dataRows
      .filter(row => row[courseIdIndex] === courseId)
      .map(row => this.rowToObject(headers, row));
  }

  async getDisponibilitesByPhotographerId(photographerId: string) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.DISPONIBILITES}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const headers = rows[0];
    const photographerIdIndex = headers.indexOf('photographeId');
    const dataRows = rows.slice(1);

    return dataRows
      .filter(row => row[photographerIdIndex] === photographerId)
      .map(row => this.rowToObject(headers, row));
  }

  async getAllDisponibilites() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.DISPONIBILITES}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const headers = rows[0];
    const dataRows = rows.slice(1);

    return dataRows.map(row => this.rowToObject(headers, row));
  }

  async updateDisponibilite(id: string, data: Record<string, any>) {
    const rowIndex = await this.findRowIndexById(SHEET_NAMES.DISPONIBILITES, id);
    if (rowIndex === -1) throw new Error('Disponibilité non trouvée');

    // Récupérer les données actuelles
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.DISPONIBILITES}!A${rowIndex}:Z${rowIndex}`,
    });

    const headers = await this.getSheetHeaders(SHEET_NAMES.DISPONIBILITES);
    const currentRow = response.data.values?.[0] || [];
    const currentData = this.rowToObject(headers, currentRow);

    // Fusionner les données
    const updatedData = { ...currentData, ...data, id };

    const values = headers.map(header => (updatedData as any)[header] ?? '');

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.DISPONIBILITES}!A${rowIndex}:Z${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values],
      },
    });

    return updatedData;
  }

  async createDisponibilite(data: Record<string, any>) {
    const headers = await this.getSheetHeaders(SHEET_NAMES.DISPONIBILITES);
    const values = headers.map(header => data[header] ?? '');

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.DISPONIBILITES}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values],
      },
    });

    return data;
  }

  async bulkUpdateDisponibilites(ids: string[], data: Record<string, any>) {
    if (ids.length === 0) return [];

    // Récupérer toutes les disponibilités avec leurs indices
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.DISPONIBILITES}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const headers = rows[0];
    const idIndex = headers.indexOf('id');

    // Trouver les lignes à mettre à jour
    const rowsToUpdate: { rowIndex: number; currentData: Record<string, any> }[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const id = row[idIndex];

      if (ids.includes(id)) {
        const currentData = this.rowToObject(headers, row);
        rowsToUpdate.push({
          rowIndex: i + 1, // +1 car Google Sheets est 1-indexed
          currentData,
        });
      }
    }

    if (rowsToUpdate.length === 0) {
      console.log('⚠️ Aucune disponibilité trouvée pour les IDs:', ids);
      return [];
    }

    // Préparer les données de mise à jour batch
    const batchData = rowsToUpdate.map(({ rowIndex, currentData }) => {
      const updatedData = { ...currentData, ...data };
      const values = headers.map(header => updatedData[header] ?? '');

      return {
        range: `${SHEET_NAMES.DISPONIBILITES}!A${rowIndex}:Z${rowIndex}`,
        values: [values],
      };
    });

    // Mettre à jour toutes les lignes en une seule requête batch
    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: batchData,
      },
    });

    console.log(`✅ ${rowsToUpdate.length} disponibilités mises à jour en batch`);

    return rowsToUpdate.map(({ currentData }) => ({ ...currentData, ...data }));
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private rowToObject(headers: string[], row: any[]): Record<string, any> {
    const obj: Record<string, any> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? '';
    });
    return obj;
  }

  private async getSheetHeaders(sheetName: string): Promise<string[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:Z1`,
    });

    return response.data.values?.[0] ?? [];
  }

  private async findRowIndexById(sheetName: string, id: string): Promise<number> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:A`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return -1;

    // Ligne 1 = headers (index 0), donc les données commencent à l'index 1
    // Google Sheets commence à 1, donc on retourne index + 1
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === id) {
        return i + 1; // +1 car Google Sheets est 1-indexed
      }
    }

    return -1;
  }

  // ============================================================================
  // STATISTIQUES PHOTOGRAPHES
  // ============================================================================

  async getPhotographerStatistics(photographeId: string) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.STATS_PHOTOGRAPHES}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const headers = rows[0];
    const photographeIdIndex = headers.indexOf('photographeId');
    const dataRows = rows.slice(1);

    const stats = [];
    for (const row of dataRows) {
      if (row[photographeIdIndex] === photographeId) {
        stats.push(this.rowToObject(headers, row));
      }
    }

    return stats;
  }

  async getAllPhotographerStatistics() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.STATS_PHOTOGRAPHES}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const headers = rows[0];
    const dataRows = rows.slice(1);

    return dataRows.map((row) => this.rowToObject(headers, row));
  }

  // ============================================================================
  // STATISTIQUES ADMIN
  // ============================================================================

  async getAdminStatistics() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.STATS_ADMIN}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const headers = rows[0];
    const dataRows = rows.slice(1);

    return dataRows.map((row) => this.rowToObject(headers, row));
  }

  async getAdminStatisticsByMonth(mois: string, annee: string) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.STATS_ADMIN}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return null;

    const headers = rows[0];
    const moisIndex = headers.indexOf('mois');
    const anneeIndex = headers.indexOf('annee');
    const dataRows = rows.slice(1);

    for (const row of dataRows) {
      if (row[moisIndex] === mois && row[anneeIndex] === annee) {
        return this.rowToObject(headers, row);
      }
    }

    return null;
  }

  // Récupérer les statistiques du mois en cours (ou les plus récentes)
  async getCurrentAdminStatistics() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.STATS_ADMIN}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return null;

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Retourner la dernière ligne (statistiques les plus récentes)
    if (dataRows.length > 0) {
      return this.rowToObject(headers, dataRows[dataRows.length - 1]);
    }

    return null;
  }

  async getCurrentPhotographerStatistics() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAMES.STATS_PHOTOGRAPHES}!A:Z`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return null;

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Retourner la dernière ligne (statistiques les plus récentes)
    if (dataRows.length > 0) {
      return this.rowToObject(headers, dataRows[dataRows.length - 1]);
    }

    return null;
  }
}
