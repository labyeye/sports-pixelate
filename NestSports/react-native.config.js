// Google MLKit (pulled in by react-native-vision-camera-face-detector) ships no arm64 iOS-simulator slice, so the
// simulator build can't link it. `npm run pods:sim` installs pods with NO_FACE_DETECTOR=1, which leaves the native
// module out (the kiosk screen then shows "not available on this build"). `npm run pods:device` puts it back.
const noFaceDetector = process.env.NO_FACE_DETECTOR === '1';

module.exports = {
  assets: ['./src/assets/fonts'],
  dependencies: noFaceDetector
    ? { 'react-native-vision-camera-face-detector': { platforms: { ios: null } } }
    : {},
};
