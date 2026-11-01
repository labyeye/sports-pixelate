// Spare-device attendance kiosk (owner only): leave a phone/tablet on a wall mount, signed in as the owner. It watches
// the front camera; when a face is held steady it sends a photo, the server recognises the student or staff member and
// toggles their day (first scan = check-in, next = check-out). Manual marking elsewhere is unchanged.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';
import { X, CheckCircle2, AlertCircle, LogOut } from 'lucide-react-native';
import { biometricAPI } from '../api/client';
import { colors } from '../theme/colors';

const C = {
  white: colors.white,
  primary: colors.blue,
  success: colors.green,
  danger: colors.red,
};

const STEADY_MS = 700;
const RESULT_MS = 3500;
const GUIDE_SIZE = 260;

type Result = { ok: boolean; title: string; sub: string; out?: boolean };

export default function FaceKioskScreen({ navigation }: any) {
  const isFocused = useIsFocused();
  const device = useCameraDevice('front');
  const format = useCameraFormat(device, [
    { photoResolution: { width: 640, height: 480 } },
  ]);
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);
  const faceSinceRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const lastUiRef = useRef(0);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const finish = useCallback((r: Result) => {
    setProcessing(false);
    setResult(r);
    setTimeout(() => {
      setResult(null);
      setProgress(0);
      faceSinceRef.current = null;
      busyRef.current = false; // re-arm only after the result has been shown
    }, RESULT_MS);
  }, []);

  const capture = useCallback(async () => {
    busyRef.current = true;
    setProcessing(true);
    try {
      const photo = await cameraRef.current?.takePhoto({ flash: 'off' });
      if (!photo?.path) throw new Error('Could not capture photo. Try again.');
      const uri =
        Platform.OS === 'android' ? `file://${photo.path}` : photo.path;
      const res: any = await biometricAPI.faceKiosk({
        uri,
        type: 'image/jpeg',
        name: `kiosk_${Date.now()}.jpg`,
      });
      const { data, locked } = res;
      const who = data.person?.name || 'Recognised';
      const when = data.timestamp ? new Date(data.timestamp) : null;
      const time = when
        ? when.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';
      if (locked) {
        finish({
          ok: true,
          title: who,
          sub: data.message || 'Already recorded',
        });
      } else if (data.type === 'check_in') {
        finish({ ok: true, title: who, sub: `Checked in at ${time}` });
      } else {
        finish({
          ok: true,
          out: true,
          title: who,
          sub: `Checked out at ${time}`,
        });
      }
    } catch (e: any) {
      finish({
        ok: false,
        title: 'Not marked',
        sub: e.message || 'Please try again',
      });
    }
  }, [finish]);

  const handleFaceUpdate = useCallback(
    (hasFace: boolean) => {
      if (busyRef.current) return;
      const now = Date.now();
      if (!hasFace) {
        faceSinceRef.current = null;
        if (now - lastUiRef.current > 80) {
          lastUiRef.current = now;
          setProgress(0);
        }
        return;
      }
      if (faceSinceRef.current == null) faceSinceRef.current = now;
      const elapsed = now - faceSinceRef.current;
      if (now - lastUiRef.current > 80) {
        lastUiRef.current = now;
        setProgress(Math.min(1, elapsed / STEADY_MS));
      }
      if (elapsed >= STEADY_MS) capture();
    },
    [capture],
  );

  const { detectFaces } = useFaceDetector({
    performanceMode: 'fast',
    landmarkMode: 'none',
    classificationMode: 'none',
    contourMode: 'none',
  });
  const handleFaceUpdateJS = Worklets.createRunOnJS(handleFaceUpdate);
  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      const faces = detectFaces(frame);
      handleFaceUpdateJS(faces.length > 0);
    },
    [handleFaceUpdateJS],
  );

  const blocked = !hasPermission || !device;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Face Attendance</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityLabel="Close kiosk"
        >
          <X size={22} color={C.white} />
        </TouchableOpacity>
      </View>

      <View style={s.cameraWrap}>
        {!blocked && (
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            format={format}
            isActive={isFocused}
            photo
            frameProcessor={frameProcessor}
          />
        )}

        {!blocked && !result && (
          <View pointerEvents="none" style={s.guideWrap}>
            <View
              style={[
                s.guideRing,
                {
                  borderColor:
                    progress > 0 ? C.success : 'rgba(255,255,255,0.6)',
                },
              ]}
            />
          </View>
        )}

        {blocked && (
          <View style={s.overlay}>
            <AlertCircle size={32} color={C.white} />
            <Text style={s.title}>
              {!hasPermission
                ? 'Camera permission required'
                : 'No front camera found'}
            </Text>
            {!hasPermission && (
              <TouchableOpacity
                style={s.btn}
                onPress={() => Linking.openSettings()}
              >
                <Text style={s.btnText}>Open Settings</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {result && (
          <View style={s.overlay}>
            {result.ok ? (
              result.out ? (
                <LogOut size={56} color={C.success} />
              ) : (
                <CheckCircle2 size={56} color={C.success} />
              )
            ) : (
              <AlertCircle size={52} color={C.danger} />
            )}
            <Text style={s.name}>{result.title}</Text>
            <Text style={s.title}>{result.sub}</Text>
          </View>
        )}
      </View>

      <View style={s.footer}>
        {processing ? (
          <ActivityIndicator color={C.white} />
        ) : (
          <Text style={s.footerText}>
            {progress > 0
              ? 'Hold still…'
              : 'Look at the camera to mark attendance'}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { color: C.white, fontWeight: '700', fontSize: 15 },
  cameraWrap: { flex: 1, backgroundColor: '#000' },
  guideWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideRing: {
    width: GUIDE_SIZE,
    height: GUIDE_SIZE,
    borderRadius: GUIDE_SIZE / 2,
    borderWidth: 3,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 32,
    gap: 10,
  },
  name: {
    color: C.white,
    fontWeight: '700',
    fontSize: 28,
    textAlign: 'center',
  },
  title: {
    color: '#D1D5DB',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
  btn: {
    marginTop: 8,
    backgroundColor: C.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  btnText: { color: C.white, fontWeight: '700', fontSize: 13 },
  footer: { paddingHorizontal: 24, paddingVertical: 20, alignItems: 'center' },
  footerText: { color: C.white, fontSize: 14, fontWeight: '700' },
});
