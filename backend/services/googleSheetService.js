const { google } = require('googleapis');
require('dotenv').config();

class GoogleSheetService {
    constructor() {
        this.auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets.readonly',
                'https://www.googleapis.com/auth/drive.readonly'
            ]
        });
        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
        this.drive = google.drive({ version: 'v3', auth: this.auth });
    }

    async getAllSpreadsheets() {
        try {
            // Tìm tất cả Google Sheets files mà service account có quyền truy cập
            const response = await this.drive.files.list({
                q: "mimeType='application/vnd.google-apps.spreadsheet'",
                fields: 'files(id, name)',
                orderBy: 'modifiedTime desc'
            });

            const files = response.data.files;

            const spreadsheets = await Promise.all(
                files.map(async (file) => {
                    try {
                        const sheetResponse = await this.sheets.spreadsheets.get({
                            spreadsheetId: file.id,
                            fields: 'sheets.properties'
                        });

                        return {
                            id: file.id,
                            name: file.name,
                            sheets: sheetResponse.data.sheets.map(sheet => ({
                                id: sheet.properties.sheetId,
                                title: sheet.properties.title
                            }))
                        };
                    } catch (error) {
                        console.error(`Error getting details for spreadsheet ${file.id}:`, error);
                        return null;
                    }
                })
            );

            return spreadsheets.filter(sheet => sheet !== null);
        } catch (error) {
            console.error('Error listing spreadsheets:', error);
            throw error;
        }
    }

    async getSheetData(spreadsheetId) {
        try {
            const metadata = await this.sheets.spreadsheets.get({
                spreadsheetId,
                fields: 'sheets.properties.title'
            });

            const sheetTitle = metadata.data.sheets[0].properties.title;
            const range = sheetTitle.includes(' ') ? 
                `'${sheetTitle}'!A1:Z1000` : 
                `${sheetTitle}!A1:Z1000`;

            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range,
                majorDimension: 'ROWS',
                valueRenderOption: 'FORMATTED_VALUE'
            });

            return response.data.values || [];
        } catch (error) {
            console.error('Service - Error:', error);
            throw error;
        }
    }

    async getSheetMetadata(spreadsheetId) {
        const response = await this.sheets.spreadsheets.get({
            spreadsheetId
        });
        return response.data.sheets;
    }
}

module.exports = new GoogleSheetService(); 