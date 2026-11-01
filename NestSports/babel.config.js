module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Needed by the live face-kiosk camera (frame processors run as worklets).
  plugins: ['react-native-worklets-core/plugin'],
};
