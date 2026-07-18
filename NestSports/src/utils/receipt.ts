import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { getToken } from '../api/client';

// Downloads a verified payment's PDF receipt from the backend and opens the
// native share sheet (same pattern as excelImportExport.ts's export flow) —
// lets the parent save it or send it wherever they like.
export async function downloadReceipt(url: string, filename: string) {
  const token = await getToken();
  const path = `${RNFS.CachesDirectoryPath}/${filename}`;
  const result = await RNFS.downloadFile({
    fromUrl: url,
    toFile: path,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  }).promise;
  if (result.statusCode && result.statusCode >= 400) {
    throw new Error('Failed to download receipt');
  }
  await Share.open({
    url: `file://${path}`,
    type: 'application/pdf',
    filename,
    failOnCancel: false,
  });
}
