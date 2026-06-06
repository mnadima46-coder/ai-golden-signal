/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BackupData {
  winCount: number;
  lossCount: number;
  historyLogs: Array<{ id: number; prediction: 'BIG' | 'SMALL'; result: 'WIN' | 'LOSS' }>;
  trueMarketHistory: ('BIG' | 'SMALL')[];
  wingoMode: '30s' | '1 Min' | '3 Min' | '5 Min' | '10 Min';
  timeOffset: number;
  targetUrl: string;
  backupTime: string;
  processedPeriods: string[];
}

/**
 * Searches for 'wingo_hack_data.json' in Google Drive.
 * Returns the file ID if found, otherwise null.
 */
export async function findBackupFile(accessToken: string): Promise<string | null> {
  try {
    const url = "https://www.googleapis.com/drive/v3/files?q=name='wingo_hack_data.json'+and+trashed=false&fields=files(id,name)";
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to search files: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (error) {
    console.error("error finding backup file", error);
    return null;
  }
}

/**
 * Creates a new backup file on Google Drive containing the statistics.
 */
export async function createBackupFile(accessToken: string, data: BackupData): Promise<string | null> {
  try {
    const metadata = {
      name: "wingo_hack_data.json",
      mimeType: "application/json",
    };

    const boundary = "314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
    
    const body = 
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      "Content-Type: application/json\r\n\r\n" +
      JSON.stringify(data) +
      closeDelimiter;

    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: body,
    });

    if (!response.ok) {
      throw new Error(`Failed to create backup: ${response.statusText}`);
    }

    const result = await response.json();
    return result.id || null;
  } catch (error) {
    console.error("error creating backup file", error);
    return null;
  }
}

/**
 * Overwrites the content of an existing Google Drive file with new statistics.
 */
export async function updateBackupFile(accessToken: string, fileId: string, data: BackupData): Promise<boolean> {
  try {
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update backup: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error("error updating backup file", error);
    return false;
  }
}

/**
 * Downloads the content of a backup file from Google Drive.
 */
export async function downloadBackupFile(accessToken: string, fileId: string): Promise<BackupData | null> {
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download backup: ${response.statusText}`);
    }

    const data = await response.json();
    return data as BackupData;
  } catch (error) {
    console.error("error downloading backup file", error);
    return null;
  }
}
