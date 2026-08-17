import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  SafeAreaView, 
  StatusBar, 
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Image
} from 'react-native';
import { notificationAsync, NotificationFeedbackType } from 'expo-haptics';
import { requestCameraPermissionsAsync, launchCameraAsync, requestMediaLibraryPermissionsAsync, launchImageLibraryAsync } from 'expo-image-picker';

const BACKEND_URL = 'http://172.16.10.146:8000/api/faults';

export default function App() {
  const [allFaults, setAllFaults] = useState([]);
  const [total, setTotal] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Filtreleme ve Arama
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Arıza Ekleme Modal State'leri
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [deviceId, setDeviceId] = useState('VENTILATOR-OKU-01');
  const [errorCode, setErrorCode] = useState('ERR-FOTO-01');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('KRİTİK');
  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Alarm Banner State'i
  const [alertFault, setAlertFault] = useState(null);
  const bannerAnim = useRef(new Animated.Value(-150)).current;
  const knownIdsRef = useRef(new Set());
  const isInitialLoad = useRef(true);

  const triggerCriticalAlarm = (fault) => {
    try {
      notificationAsync(NotificationFeedbackType.Error);
    } catch (e) {
      console.log('Haptic hatası:', e);
    }

    setAlertFault(fault);
    Animated.sequence([
      Animated.timing(bannerAnim, {
        toValue: 20,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(4000),
      Animated.timing(bannerAnim, {
        toValue: -150,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setAlertFault(null));
  };

  const fetchFaults = async () => {
    try {
      const response = await fetch(BACKEND_URL);
      const data = await response.json();
      
      setTotal(data.total || 0);
      const faultsList = data.faults || [];
      const criticals = faultsList.filter(f => f.severity === 'KRİTİK' && f.status !== 'ÇÖZÜLDÜ').length;
      setCriticalCount(criticals);

      if (faultsList.length > 0) {
        if (isInitialLoad.current) {
          faultsList.forEach(f => knownIdsRef.current.add(f.id));
          isInitialLoad.current = false;
        } else {
          faultsList.forEach(f => {
            if (!knownIdsRef.current.has(f.id)) {
              knownIdsRef.current.add(f.id);
              if (f.severity === 'KRİTİK') {
                triggerCriticalAlarm(f);
              }
            }
          });
        }
      }

      setAllFaults(faultsList);
    } catch (error) {
      console.log('Veri çekme hatası:', error.message);
    }
  };

  useEffect(() => {
    fetchFaults();
    const interval = setInterval(fetchFaults, 2500);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFaults();
    setRefreshing(false);
  };

  // Kamera ile Çekme
  const takePhoto = async () => {
    try {
      const permission = await requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin Gerekli', 'Lütfen kamera iznini onaylayın.');
        return;
      }

      const result = await launchCameraAsync({
        quality: 0.3,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setImageBase64(`data:image/jpeg;base64,${asset.base64}`);
      }
    } catch (error) {
      Alert.alert('Kamera Hatası', error.message);
    }
  };

  // Galeriden Seçme
  const pickImage = async () => {
    try {
      const permission = await requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin Gerekli', 'Lütfen galeri iznini onaylayın.');
        return;
      }

      const result = await launchImageLibraryAsync({
        quality: 0.3,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setImageBase64(`data:image/jpeg;base64,${asset.base64}`);
      }
    } catch (error) {
      Alert.alert('Galeri Hatası', error.message);
    }
  };

  const handleAddFault = async () => {
    if (!description.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen arıza açıklamasını yazın.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          error_code: errorCode,
          description: description,
          severity: severity,
          image_data: imageBase64 || '',
        }),
      });

      if (response.ok) {
        try { notificationAsync(NotificationFeedbackType.Success); } catch(e){}
        Alert.alert('Başarılı', 'Arıza kaydı merkeze iletildi!');
        setAddModalVisible(false);
        setDescription('');
        setImageUri(null);
        setImageBase64('');
        fetchFaults();
      } else {
        Alert.alert('Hata', 'Kayıt gönderilemedi.');
      }
    } catch (error) {
      Alert.alert('Bağlantı Hatası', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFaults = (allFaults || []).filter(fault => {
    const matchesStatus = statusFilter === 'ALL' || fault.status === statusFilter;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      (fault.device_id && fault.device_id.toLowerCase().includes(query)) ||
      (fault.error_code && fault.error_code.toLowerCase().includes(query)) ||
      (fault.description && fault.description.toLowerCase().includes(query));
    return matchesStatus && matchesSearch;
  });

  const renderFaultCard = ({ item }) => {
    const isCritical = item.severity === 'KRİTİK';
    const isResolved = item.status === 'ÇÖZÜLDÜ';
    const isInvestigating = item.status === 'İNCELENİYOR';
    const hasValidImage = Boolean(item.image_data && typeof item.image_data === 'string' && item.image_data.length > 50);

    return (
      <View style={[
        styles.card, 
        isResolved ? styles.resolvedCard : (isCritical ? styles.criticalCard : styles.warningCard)
      ]}>
        <View style={styles.cardHeader}>
          <Text style={styles.deviceId}>{item.device_id}</Text>
          <View style={styles.badgeGroup}>
            <View style={[styles.badge, isCritical ? styles.badgeCritical : styles.badgeWarning]}>
              <Text style={styles.badgeText}>{item.severity}</Text>
            </View>
            <View style={[
              styles.statusBadge, 
              isResolved ? styles.statusResolved : (isInvestigating ? styles.statusInvestigating : styles.statusOpen)
            ]}>
              <Text style={styles.statusBadgeText}>{item.status}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.errorCode}>Kod: {item.error_code}</Text>
        <Text style={styles.description}>{item.description}</Text>

        {hasValidImage ? (
          <Image 
            source={{ uri: item.image_data }} 
            style={styles.cardImage} 
            resizeMode="cover"
          />
        ) : null}
        
        {item.technician_note ? (
          <View style={styles.techNoteBox}>
            <Text style={styles.techNoteLabel}>🛠️ Merkez / Müdahale Notu:</Text>
            <Text style={styles.techNoteText}>{item.technician_note}</Text>
          </View>
        ) : null}

        <Text style={styles.timestamp}>📅 {item.timestamp}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* Alarm Banner */}
      {alertFault && (
        <Animated.View style={[styles.emergencyBanner, { transform: [{ translateY: bannerAnim }] }]}>
          <View style={styles.bannerHeaderRow}>
            <Text style={styles.emergencyTitle}>🚨 ACİL KRİTİK ALARM</Text>
            <TouchableOpacity onPress={() => setAlertFault(null)}>
              <Text style={styles.bannerCloseBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.emergencyDevice}>{alertFault.device_id} • {alertFault.error_code}</Text>
          <Text style={styles.emergencyDesc} numberOfLines={2}>{alertFault.description}</Text>
        </Animated.View>
      )}

      {/* Başlık */}
      <View style={styles.header}>
        <Text style={styles.brandTitle}>OKUMAN MEDİKAL</Text>
        <Text style={styles.subtitle}>Saha Arıza Bildirim Terminali</Text>
      </View>

      {/* Sayaçlar */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Toplam Kayıt</Text>
          <Text style={styles.statValue}>{total}</Text>
        </View>
        <View style={[styles.statBox, styles.statBoxCritical]}>
          <Text style={styles.statLabelCritical}>Aktif Kritik</Text>
          <Text style={styles.statValueCritical}>{criticalCount}</Text>
        </View>
      </View>

      {/* Arama */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cihaz veya hata kodu ara..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filtreler */}
      <View style={styles.filterScroll}>
        {[
          { key: 'ALL', label: 'Tümü' },
          { key: 'AÇIK', label: '🔴 Açık' },
          { key: 'İNCELENİYOR', label: '🟡 İnceleniyor' },
          { key: 'ÇÖZÜLDÜ', label: '🟢 Çözüldü' }
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterChip, statusFilter === tab.key && styles.filterChipActive]}
            onPress={() => setStatusFilter(tab.key)}
          >
            <Text style={[styles.filterChipText, statusFilter === tab.key && styles.filterChipTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Liste */}
      <FlatList
        data={filteredFaults}
        keyExtractor={(item) => String(item.id || Math.random())}
        renderItem={renderFaultCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>Kayıtlı arıza bulunamadı...</Text>
        }
      />

      {/* FAB Buton */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setAddModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Arıza Bildirim Modalı */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Saha Arıza Bildirimi</Text>
                <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Cihaz Modeli</Text>
              <View style={styles.chipRow}>
                {['VENTILATOR-OKU-01', 'ANESTHESIA-OKU-02', 'MONITOR-OKU-03'].map((dev) => (
                  <TouchableOpacity 
                    key={dev} 
                    style={[styles.chip, deviceId === dev && styles.chipActive]}
                    onPress={() => setDeviceId(dev)}
                  >
                    <Text style={[styles.chipText, deviceId === dev && styles.chipTextActive]}>
                      {dev.replace('-OKU-', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Kritiklik Seviyesi</Text>
              <View style={styles.severityRow}>
                {['UYARI', 'KRİTİK'].map((sev) => (
                  <TouchableOpacity 
                    key={sev} 
                    style={[
                      styles.sevButton, 
                      severity === sev && (sev === 'KRİTİK' ? styles.sevCriticalActive : styles.sevWarningActive)
                    ]}
                    onPress={() => setSeverity(sev)}
                  >
                    <Text style={[styles.sevButtonText, severity === sev && styles.sevTextActive]}>
                      {sev}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Hata Kodu</Text>
              <TextInput
                style={styles.input}
                value={errorCode}
                onChangeText={setErrorCode}
                placeholder="Örn: ERR-FOTO-01"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Arıza Açıklaması</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Örn: Ekranda sensör hatası var, fotoğraf eklendi..."
                placeholderTextColor="#64748b"
                multiline={true}
                numberOfLines={3}
              />

              {/* Fotoğraf Ekleme */}
              <Text style={styles.inputLabel}>Arıza Fotoğrafı</Text>
              <View style={styles.photoActionRow}>
                <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                  <Text style={styles.photoBtnText}>📸 Kamera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
                  <Text style={styles.photoBtnText}>🖼️ Galeri</Text>
                </TouchableOpacity>
              </View>

              {/* Fotoğraf Önizleme */}
              {imageUri ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
                  <TouchableOpacity 
                    style={styles.removeImageBtn} 
                    onPress={() => { setImageUri(null); setImageBase64(''); }}
                  >
                    <Text style={styles.removeImageText}>Fotoğrafı Kaldır</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity 
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
                onPress={handleAddFault}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Yükleniyor...' : 'Merkeze Bildir'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  emergencyBanner: {
    position: 'absolute',
    top: 50,
    left: 14,
    right: 14,
    zIndex: 99999,
    backgroundColor: '#b91c1c',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 20,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emergencyTitle: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  bannerCloseBtn: {
    color: '#fecaca',
    fontSize: 16,
    fontWeight: 'bold',
    padding: 2,
  },
  emergencyDevice: {
    color: '#fef08a',
    fontWeight: 'bold',
    fontSize: 14,
    marginTop: 4,
  },
  emergencyDesc: {
    color: '#fee2e2',
    fontSize: 12,
    marginTop: 2,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2dd4bf',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statBoxCritical: {
    borderColor: '#ef444455',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 11,
  },
  statLabelCritical: {
    color: '#f87171',
    fontSize: 11,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 2,
  },
  statValueCritical: {
    color: '#ef4444',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  searchInput: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 13,
  },
  filterScroll: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: '#2dd4bf22',
    borderColor: '#2dd4bf',
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#2dd4bf',
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 90,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  criticalCard: {
    borderColor: '#ef444477',
  },
  warningCard: {
    borderColor: '#f59e0b55',
  },
  resolvedCard: {
    borderColor: '#10b98155',
    opacity: 0.85,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  deviceId: {
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: 'bold',
  },
  badgeGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeCritical: {
    backgroundColor: '#ef444422',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  badgeWarning: {
    backgroundColor: '#f59e0b22',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusOpen: {
    backgroundColor: '#ef444422',
    borderColor: '#ef4444',
  },
  statusInvestigating: {
    backgroundColor: '#f59e0b22',
    borderColor: '#f59e0b',
  },
  statusResolved: {
    backgroundColor: '#10b98122',
    borderColor: '#10b981',
  },
  statusBadgeText: {
    color: '#f8fafc',
    fontSize: 9,
    fontWeight: 'bold',
  },
  errorCode: {
    color: '#fbbf24',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  description: {
    color: '#e2e8f0',
    fontSize: 13,
    marginBottom: 6,
  },
  cardImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  techNoteBox: {
    backgroundColor: '#0f172a',
    borderLeftWidth: 3,
    borderLeftColor: '#2dd4bf',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
  },
  techNoteLabel: {
    color: '#2dd4bf',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  techNoteText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  timestamp: {
    color: '#64748b',
    fontSize: 10,
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 30,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2dd4bf',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2dd4bf',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  fabText: {
    fontSize: 30,
    color: '#0f172a',
    fontWeight: 'bold',
    marginTop: -2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  closeBtn: {
    fontSize: 20,
    color: '#94a3b8',
    padding: 4,
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 6,
    marginTop: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: {
    backgroundColor: '#2dd4bf22',
    borderColor: '#2dd4bf',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  chipTextActive: {
    color: '#2dd4bf',
    fontWeight: 'bold',
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sevButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  sevWarningActive: {
    backgroundColor: '#f59e0b22',
    borderColor: '#f59e0b',
  },
  sevCriticalActive: {
    backgroundColor: '#ef444422',
    borderColor: '#ef4444',
  },
  sevButtonText: {
    color: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 12,
  },
  sevTextActive: {
    color: '#ffffff',
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 10,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 13,
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  photoActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  photoBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#38bdf855',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  photoBtnText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  previewContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2dd4bf',
  },
  removeImageBtn: {
    marginTop: 6,
  },
  removeImageText: {
    color: '#f87171',
    fontSize: 11,
  },
  submitButton: {
    backgroundColor: '#2dd4bf',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#0f172a',
    fontWeight: 'bold',
    fontSize: 15,
  },
});