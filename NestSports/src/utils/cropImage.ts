import ImageCropPicker from 'react-native-image-crop-picker';

export interface CropFile {
  uri: string;
  name: string;
  type: string;
}

// Opens the native crop screen for an already-picked photo. Resolves with the
// cropped file, or null if the user cancelled. If the crop screen itself fails
// the original photo is returned so an upload is never silently lost.
export async function cropFile(
  file: CropFile,
  opts: { size?: number } = {},
): Promise<CropFile | null> {
  const size = opts.size ?? 1024;
  try {
    const r = await ImageCropPicker.openCropper({
      path: file.uri,
      width: size,
      height: size,
      mediaType: 'photo',
      cropping: true,
      freeStyleCropEnabled: true,
      compressImageQuality: 0.8,
      cropperToolbarTitle: 'Crop Photo',
      cropperChooseText: 'Use Photo',
      cropperCancelText: 'Cancel',
      forceJpg: true,
    });
    const uri = /^[a-z]+:\/\//i.test(r.path) ? r.path : `file://${r.path}`;
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return { uri, name: `${base}.jpg`, type: r.mime || 'image/jpeg' };
  } catch (e: any) {
    if (e?.code === 'E_PICKER_CANCELLED') return null;
    return file;
  }
}
