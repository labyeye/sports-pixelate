import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  Cpu,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  RefreshCw,
} from 'lucide-react-native';
import { assetAPI } from '../api/client';
import SlideInCard from '../components/motion/SlideInCard';
import { C, useResponsive } from '../theme';

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: any }
> = {
  assigned: {
    label: 'Assigned',
    color: C.primary,
    bg: '#EFF6FF',
    icon: CheckCircle2,
  },
  returned: {
    label: 'Returned',
    color: C.textMuted,
    bg: '#F3F4F6',
    icon: XCircle,
  },
  return_requested: {
    label: 'Return Pending',
    color: C.warning,
    bg: '#FFF7ED',
    icon: Clock,
  },
};

export default function AssetsScreen() {
  const navigation = useNavigation<any>();
  const { isTablet, maxContentWidth } = useResponsive();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await assetAPI.getAll();
      setAssets(res.data || res || []);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleReturn = (id: string, name: string) => {
    Alert.alert('Return Asset', `Request return for "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Request Return',
        onPress: async () => {
          try {
            await assetAPI.return(id);
            Alert.alert('Success', 'Asset return request raised successfully');
            load();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to request return');
          }
        },
      },
    ]);
  };

  const renderAsset = ({ item, index }: { item: any; index: number }) => {
    const statusMeta = STATUS_CONFIG[item.status] || {
      label: item.status,
      color: C.textMuted,
      bg: '#F3F4F6',
      icon: AlertCircle,
    };
    const StatusIcon = statusMeta.icon;

    return (
      <SlideInCard index={index} style={isTablet ? styles.cardCol : undefined}>
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View
              style={[
                styles.assetIconBox,
                {
                  backgroundColor: statusMeta.color + '1A',
                  borderColor: statusMeta.color,
                },
              ]}
            >
              <Cpu size={18} color={statusMeta.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.assetName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.assetCodeText}>
                {item.assetCode || 'No Code'}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusMeta.bg,
                  borderColor: statusMeta.color,
                },
              ]}
            >
              <StatusIcon size={12} color={statusMeta.color} />
              <Text style={[styles.statusText, { color: statusMeta.color }]}>
                {statusMeta.label}
              </Text>
            </View>
          </View>

          {/* Clean 2-column strip */}
          <View style={styles.infoStrip}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>SERIAL NO.</Text>
              <Text style={styles.infoVal} numberOfLines={1}>
                {item.serialNumber || '—'}
              </Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>ASSIGNED ON</Text>
              <Text style={styles.infoVal}>
                {item.assignedDate
                  ? new Date(item.assignedDate).toLocaleDateString('en-IN')
                  : '—'}
              </Text>
            </View>
          </View>

          {item.status === 'assigned' && (
            <TouchableOpacity
              style={styles.returnBtn}
              onPress={() => handleReturn(item._id, item.name)}
            >
              <RefreshCw size={13} color={C.white} />
              <Text style={styles.returnBtnText}>Request Return</Text>
            </TouchableOpacity>
          )}
        </View>
      </SlideInCard>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View
        style={[
          styles.header,
          isTablet && {
            maxWidth: maxContentWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <Cpu size={20} color={C.primary} />
        <Text style={styles.headerTitle}>My Assets</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : assets.length === 0 ? (
        <View style={styles.center}>
          <Cpu size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No assets assigned</Text>
          <Text style={styles.emptySubtitle}>
            You currently do not have any company hardware assigned.
          </Text>
        </View>
      ) : (
        <FlatList
          key={isTablet ? 'tablet-grid-2' : 'mobile-list'}
          data={assets}
          keyExtractor={item => item._id}
          numColumns={isTablet ? 2 : 1}
          columnWrapperStyle={isTablet ? styles.colWrapper : undefined}
          renderItem={renderAsset}
          contentContainerStyle={[
            { padding: 16, gap: 10, paddingBottom: 32 },
            isTablet && {
              maxWidth: maxContentWidth,
              width: '100%',
              alignSelf: 'center',
            },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[C.primary]}
              tintColor={C.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    gap: 8,
  },
  backBtn: { padding: 4, marginRight: 2 },
  headerTitle: { fontSize: 20, fontWeight: '400', color: C.black },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  colWrapper: { gap: 10 },
  cardCol: { flex: 1 },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 6,
  },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    padding: 12,
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  assetIconBox: {
    width: 38,
    height: 38,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetName: { fontSize: 14, fontWeight: '400', color: C.black },
  assetCodeText: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  statusBadge: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: { fontSize: 10, fontWeight: '400', textTransform: 'capitalize' },
  infoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1.5,
    borderColor: C.black,
    borderRadius: 6,
    paddingVertical: 7,
  },
  infoCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  infoDivider: {
    width: 1.5,
    height: 22,
    backgroundColor: '#E5E7EB',
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: '400',
    color: C.textMuted,
    letterSpacing: 0.4,
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '400',
    color: C.black,
    marginTop: 2,
  },
  returnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.secondary,
    borderWidth: 2,
    borderRadius: 6,
    borderColor: C.black,
    paddingVertical: 7,
  },
  returnBtnText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '400',
  },
});
