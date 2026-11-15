import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

/** Shared look for form modals: a card centred on a dimmed screen (instead of sliding up from the bottom). */
export const CENTER = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    height: '88%',
    width: isTablet ? 680 : '100%',
    maxWidth: 720,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
  },
});
