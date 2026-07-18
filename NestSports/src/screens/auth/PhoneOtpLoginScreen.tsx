import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../api/client';
import { Button } from '../../components/ui';
import { colors } from '../../theme/colors';
import LottieView from 'lottie-react-native';
import { Mail, ChevronDown } from 'lucide-react-native';

// Flag emoji is derived from the ISO 3166-1 alpha-2 code (two regional-
// indicator symbols) rather than hand-typed, so the list below can't drift
// out of sync with a wrong emoji.
function isoToFlag(iso2: string) {
  return iso2
    .toUpperCase()
    .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

// India first since it's the default; the rest is alphabetical by name.
// As complete a list of ISO 3166-1 countries/territories and their calling
// codes as practical — add more here if a market is missing.
const RAW_COUNTRIES: { name: string; iso2: string; dial: string }[] = [
  { name: 'India', iso2: 'IN', dial: '+91' },
  { name: 'Afghanistan', iso2: 'AF', dial: '+93' },
  { name: 'Albania', iso2: 'AL', dial: '+355' },
  { name: 'Algeria', iso2: 'DZ', dial: '+213' },
  { name: 'American Samoa', iso2: 'AS', dial: '+1684' },
  { name: 'Andorra', iso2: 'AD', dial: '+376' },
  { name: 'Angola', iso2: 'AO', dial: '+244' },
  { name: 'Anguilla', iso2: 'AI', dial: '+1264' },
  { name: 'Antigua and Barbuda', iso2: 'AG', dial: '+1268' },
  { name: 'Argentina', iso2: 'AR', dial: '+54' },
  { name: 'Armenia', iso2: 'AM', dial: '+374' },
  { name: 'Aruba', iso2: 'AW', dial: '+297' },
  { name: 'Australia', iso2: 'AU', dial: '+61' },
  { name: 'Austria', iso2: 'AT', dial: '+43' },
  { name: 'Azerbaijan', iso2: 'AZ', dial: '+994' },
  { name: 'Bahamas', iso2: 'BS', dial: '+1242' },
  { name: 'Bahrain', iso2: 'BH', dial: '+973' },
  { name: 'Bangladesh', iso2: 'BD', dial: '+880' },
  { name: 'Barbados', iso2: 'BB', dial: '+1246' },
  { name: 'Belarus', iso2: 'BY', dial: '+375' },
  { name: 'Belgium', iso2: 'BE', dial: '+32' },
  { name: 'Belize', iso2: 'BZ', dial: '+501' },
  { name: 'Benin', iso2: 'BJ', dial: '+229' },
  { name: 'Bermuda', iso2: 'BM', dial: '+1441' },
  { name: 'Bhutan', iso2: 'BT', dial: '+975' },
  { name: 'Bolivia', iso2: 'BO', dial: '+591' },
  { name: 'Bosnia and Herzegovina', iso2: 'BA', dial: '+387' },
  { name: 'Botswana', iso2: 'BW', dial: '+267' },
  { name: 'Brazil', iso2: 'BR', dial: '+55' },
  { name: 'Brunei', iso2: 'BN', dial: '+673' },
  { name: 'Bulgaria', iso2: 'BG', dial: '+359' },
  { name: 'Burkina Faso', iso2: 'BF', dial: '+226' },
  { name: 'Burundi', iso2: 'BI', dial: '+257' },
  { name: 'Cambodia', iso2: 'KH', dial: '+855' },
  { name: 'Cameroon', iso2: 'CM', dial: '+237' },
  { name: 'Canada', iso2: 'CA', dial: '+1' },
  { name: 'Cape Verde', iso2: 'CV', dial: '+238' },
  { name: 'Cayman Islands', iso2: 'KY', dial: '+1345' },
  { name: 'Central African Republic', iso2: 'CF', dial: '+236' },
  { name: 'Chad', iso2: 'TD', dial: '+235' },
  { name: 'Chile', iso2: 'CL', dial: '+56' },
  { name: 'China', iso2: 'CN', dial: '+86' },
  { name: 'Colombia', iso2: 'CO', dial: '+57' },
  { name: 'Comoros', iso2: 'KM', dial: '+269' },
  { name: 'Congo', iso2: 'CG', dial: '+242' },
  { name: 'Congo (DRC)', iso2: 'CD', dial: '+243' },
  { name: 'Cook Islands', iso2: 'CK', dial: '+682' },
  { name: 'Costa Rica', iso2: 'CR', dial: '+506' },
  { name: "Côte d'Ivoire", iso2: 'CI', dial: '+225' },
  { name: 'Croatia', iso2: 'HR', dial: '+385' },
  { name: 'Cuba', iso2: 'CU', dial: '+53' },
  { name: 'Curaçao', iso2: 'CW', dial: '+599' },
  { name: 'Cyprus', iso2: 'CY', dial: '+357' },
  { name: 'Czech Republic', iso2: 'CZ', dial: '+420' },
  { name: 'Denmark', iso2: 'DK', dial: '+45' },
  { name: 'Djibouti', iso2: 'DJ', dial: '+253' },
  { name: 'Dominica', iso2: 'DM', dial: '+1767' },
  { name: 'Dominican Republic', iso2: 'DO', dial: '+1809' },
  { name: 'Ecuador', iso2: 'EC', dial: '+593' },
  { name: 'Egypt', iso2: 'EG', dial: '+20' },
  { name: 'El Salvador', iso2: 'SV', dial: '+503' },
  { name: 'Equatorial Guinea', iso2: 'GQ', dial: '+240' },
  { name: 'Eritrea', iso2: 'ER', dial: '+291' },
  { name: 'Estonia', iso2: 'EE', dial: '+372' },
  { name: 'Eswatini', iso2: 'SZ', dial: '+268' },
  { name: 'Ethiopia', iso2: 'ET', dial: '+251' },
  { name: 'Fiji', iso2: 'FJ', dial: '+679' },
  { name: 'Finland', iso2: 'FI', dial: '+358' },
  { name: 'France', iso2: 'FR', dial: '+33' },
  { name: 'French Polynesia', iso2: 'PF', dial: '+689' },
  { name: 'Gabon', iso2: 'GA', dial: '+241' },
  { name: 'Gambia', iso2: 'GM', dial: '+220' },
  { name: 'Georgia', iso2: 'GE', dial: '+995' },
  { name: 'Germany', iso2: 'DE', dial: '+49' },
  { name: 'Ghana', iso2: 'GH', dial: '+233' },
  { name: 'Gibraltar', iso2: 'GI', dial: '+350' },
  { name: 'Greece', iso2: 'GR', dial: '+30' },
  { name: 'Greenland', iso2: 'GL', dial: '+299' },
  { name: 'Grenada', iso2: 'GD', dial: '+1473' },
  { name: 'Guadeloupe', iso2: 'GP', dial: '+590' },
  { name: 'Guam', iso2: 'GU', dial: '+1671' },
  { name: 'Guatemala', iso2: 'GT', dial: '+502' },
  { name: 'Guinea', iso2: 'GN', dial: '+224' },
  { name: 'Guinea-Bissau', iso2: 'GW', dial: '+245' },
  { name: 'Guyana', iso2: 'GY', dial: '+592' },
  { name: 'Haiti', iso2: 'HT', dial: '+509' },
  { name: 'Honduras', iso2: 'HN', dial: '+504' },
  { name: 'Hong Kong', iso2: 'HK', dial: '+852' },
  { name: 'Hungary', iso2: 'HU', dial: '+36' },
  { name: 'Iceland', iso2: 'IS', dial: '+354' },
  { name: 'Indonesia', iso2: 'ID', dial: '+62' },
  { name: 'Iran', iso2: 'IR', dial: '+98' },
  { name: 'Iraq', iso2: 'IQ', dial: '+964' },
  { name: 'Ireland', iso2: 'IE', dial: '+353' },
  { name: 'Israel', iso2: 'IL', dial: '+972' },
  { name: 'Italy', iso2: 'IT', dial: '+39' },
  { name: 'Jamaica', iso2: 'JM', dial: '+1876' },
  { name: 'Japan', iso2: 'JP', dial: '+81' },
  { name: 'Jordan', iso2: 'JO', dial: '+962' },
  { name: 'Kazakhstan', iso2: 'KZ', dial: '+7' },
  { name: 'Kenya', iso2: 'KE', dial: '+254' },
  { name: 'Kiribati', iso2: 'KI', dial: '+686' },
  { name: 'Kosovo', iso2: 'XK', dial: '+383' },
  { name: 'Kuwait', iso2: 'KW', dial: '+965' },
  { name: 'Kyrgyzstan', iso2: 'KG', dial: '+996' },
  { name: 'Laos', iso2: 'LA', dial: '+856' },
  { name: 'Latvia', iso2: 'LV', dial: '+371' },
  { name: 'Lebanon', iso2: 'LB', dial: '+961' },
  { name: 'Lesotho', iso2: 'LS', dial: '+266' },
  { name: 'Liberia', iso2: 'LR', dial: '+231' },
  { name: 'Libya', iso2: 'LY', dial: '+218' },
  { name: 'Liechtenstein', iso2: 'LI', dial: '+423' },
  { name: 'Lithuania', iso2: 'LT', dial: '+370' },
  { name: 'Luxembourg', iso2: 'LU', dial: '+352' },
  { name: 'Macau', iso2: 'MO', dial: '+853' },
  { name: 'Madagascar', iso2: 'MG', dial: '+261' },
  { name: 'Malawi', iso2: 'MW', dial: '+265' },
  { name: 'Malaysia', iso2: 'MY', dial: '+60' },
  { name: 'Maldives', iso2: 'MV', dial: '+960' },
  { name: 'Mali', iso2: 'ML', dial: '+223' },
  { name: 'Malta', iso2: 'MT', dial: '+356' },
  { name: 'Marshall Islands', iso2: 'MH', dial: '+692' },
  { name: 'Martinique', iso2: 'MQ', dial: '+596' },
  { name: 'Mauritania', iso2: 'MR', dial: '+222' },
  { name: 'Mauritius', iso2: 'MU', dial: '+230' },
  { name: 'Mexico', iso2: 'MX', dial: '+52' },
  { name: 'Micronesia', iso2: 'FM', dial: '+691' },
  { name: 'Moldova', iso2: 'MD', dial: '+373' },
  { name: 'Monaco', iso2: 'MC', dial: '+377' },
  { name: 'Mongolia', iso2: 'MN', dial: '+976' },
  { name: 'Montenegro', iso2: 'ME', dial: '+382' },
  { name: 'Montserrat', iso2: 'MS', dial: '+1664' },
  { name: 'Morocco', iso2: 'MA', dial: '+212' },
  { name: 'Mozambique', iso2: 'MZ', dial: '+258' },
  { name: 'Myanmar', iso2: 'MM', dial: '+95' },
  { name: 'Namibia', iso2: 'NA', dial: '+264' },
  { name: 'Nauru', iso2: 'NR', dial: '+674' },
  { name: 'Nepal', iso2: 'NP', dial: '+977' },
  { name: 'Netherlands', iso2: 'NL', dial: '+31' },
  { name: 'New Caledonia', iso2: 'NC', dial: '+687' },
  { name: 'New Zealand', iso2: 'NZ', dial: '+64' },
  { name: 'Nicaragua', iso2: 'NI', dial: '+505' },
  { name: 'Niger', iso2: 'NE', dial: '+227' },
  { name: 'Nigeria', iso2: 'NG', dial: '+234' },
  { name: 'Niue', iso2: 'NU', dial: '+683' },
  { name: 'North Korea', iso2: 'KP', dial: '+850' },
  { name: 'North Macedonia', iso2: 'MK', dial: '+389' },
  { name: 'Norway', iso2: 'NO', dial: '+47' },
  { name: 'Oman', iso2: 'OM', dial: '+968' },
  { name: 'Pakistan', iso2: 'PK', dial: '+92' },
  { name: 'Palau', iso2: 'PW', dial: '+680' },
  { name: 'Palestine', iso2: 'PS', dial: '+970' },
  { name: 'Panama', iso2: 'PA', dial: '+507' },
  { name: 'Papua New Guinea', iso2: 'PG', dial: '+675' },
  { name: 'Paraguay', iso2: 'PY', dial: '+595' },
  { name: 'Peru', iso2: 'PE', dial: '+51' },
  { name: 'Philippines', iso2: 'PH', dial: '+63' },
  { name: 'Poland', iso2: 'PL', dial: '+48' },
  { name: 'Portugal', iso2: 'PT', dial: '+351' },
  { name: 'Puerto Rico', iso2: 'PR', dial: '+1787' },
  { name: 'Qatar', iso2: 'QA', dial: '+974' },
  { name: 'Réunion', iso2: 'RE', dial: '+262' },
  { name: 'Romania', iso2: 'RO', dial: '+40' },
  { name: 'Russia', iso2: 'RU', dial: '+7' },
  { name: 'Rwanda', iso2: 'RW', dial: '+250' },
  { name: 'Saint Kitts and Nevis', iso2: 'KN', dial: '+1869' },
  { name: 'Saint Lucia', iso2: 'LC', dial: '+1758' },
  { name: 'Saint Vincent and the Grenadines', iso2: 'VC', dial: '+1784' },
  { name: 'Samoa', iso2: 'WS', dial: '+685' },
  { name: 'San Marino', iso2: 'SM', dial: '+378' },
  { name: 'Sao Tome and Principe', iso2: 'ST', dial: '+239' },
  { name: 'Saudi Arabia', iso2: 'SA', dial: '+966' },
  { name: 'Senegal', iso2: 'SN', dial: '+221' },
  { name: 'Serbia', iso2: 'RS', dial: '+381' },
  { name: 'Seychelles', iso2: 'SC', dial: '+248' },
  { name: 'Sierra Leone', iso2: 'SL', dial: '+232' },
  { name: 'Singapore', iso2: 'SG', dial: '+65' },
  { name: 'Slovakia', iso2: 'SK', dial: '+421' },
  { name: 'Slovenia', iso2: 'SI', dial: '+386' },
  { name: 'Solomon Islands', iso2: 'SB', dial: '+677' },
  { name: 'Somalia', iso2: 'SO', dial: '+252' },
  { name: 'South Africa', iso2: 'ZA', dial: '+27' },
  { name: 'South Korea', iso2: 'KR', dial: '+82' },
  { name: 'South Sudan', iso2: 'SS', dial: '+211' },
  { name: 'Spain', iso2: 'ES', dial: '+34' },
  { name: 'Sri Lanka', iso2: 'LK', dial: '+94' },
  { name: 'Sudan', iso2: 'SD', dial: '+249' },
  { name: 'Suriname', iso2: 'SR', dial: '+597' },
  { name: 'Sweden', iso2: 'SE', dial: '+46' },
  { name: 'Switzerland', iso2: 'CH', dial: '+41' },
  { name: 'Syria', iso2: 'SY', dial: '+963' },
  { name: 'Taiwan', iso2: 'TW', dial: '+886' },
  { name: 'Tajikistan', iso2: 'TJ', dial: '+992' },
  { name: 'Tanzania', iso2: 'TZ', dial: '+255' },
  { name: 'Thailand', iso2: 'TH', dial: '+66' },
  { name: 'Timor-Leste', iso2: 'TL', dial: '+670' },
  { name: 'Togo', iso2: 'TG', dial: '+228' },
  { name: 'Tonga', iso2: 'TO', dial: '+676' },
  { name: 'Trinidad and Tobago', iso2: 'TT', dial: '+1868' },
  { name: 'Tunisia', iso2: 'TN', dial: '+216' },
  { name: 'Turkey', iso2: 'TR', dial: '+90' },
  { name: 'Turkmenistan', iso2: 'TM', dial: '+993' },
  { name: 'Turks and Caicos Islands', iso2: 'TC', dial: '+1649' },
  { name: 'Tuvalu', iso2: 'TV', dial: '+688' },
  { name: 'Uganda', iso2: 'UG', dial: '+256' },
  { name: 'Ukraine', iso2: 'UA', dial: '+380' },
  { name: 'United Arab Emirates', iso2: 'AE', dial: '+971' },
  { name: 'United Kingdom', iso2: 'GB', dial: '+44' },
  { name: 'United States', iso2: 'US', dial: '+1' },
  { name: 'Uruguay', iso2: 'UY', dial: '+598' },
  { name: 'Uzbekistan', iso2: 'UZ', dial: '+998' },
  { name: 'Vanuatu', iso2: 'VU', dial: '+678' },
  { name: 'Vatican City', iso2: 'VA', dial: '+379' },
  { name: 'Venezuela', iso2: 'VE', dial: '+58' },
  { name: 'Vietnam', iso2: 'VN', dial: '+84' },
  { name: 'Virgin Islands (British)', iso2: 'VG', dial: '+1284' },
  { name: 'Virgin Islands (US)', iso2: 'VI', dial: '+1340' },
  { name: 'Yemen', iso2: 'YE', dial: '+967' },
  { name: 'Zambia', iso2: 'ZM', dial: '+260' },
  { name: 'Zimbabwe', iso2: 'ZW', dial: '+263' },
];

const COUNTRIES = RAW_COUNTRIES.map(c => ({ ...c, flag: isoToFlag(c.iso2) }));

export default function PhoneOtpLoginScreen({ navigation }: any) {
  const { completeLogin } = useAuth();
  const [countryCode, setCountryCode] = useState(COUNTRIES[0]);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const otpInputRef = useRef<TextInput>(null);
  const OTP_LENGTH = 6;

  const fullPhone = `${countryCode.dial}${phone.trim()}`;

  const onSendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      await authAPI.sendPhoneOtp(fullPhone);
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    }
    setLoading(false);
  };

  const onVerifyOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.verifyPhoneOtp(fullPhone, otp.trim());
      const { token, ...userData } = res.data;
      completeLogin(userData, token);
      // On success, AuthContext flips isAuthenticated and RootNavigator swaps
      // to the main app automatically.
    } catch (err: any) {
      setError(err.message || 'Invalid or expired OTP');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.white }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <LottieView
            source={require('../../assets/lottie/otp.json')}
            autoPlay
            loop
            style={{
              width: '100%',
              height: 300,
              marginTop: -204,
              marginBottom: 24,
            }}
          />
          <Text style={styles.title}>Login</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.phoneRow}>
              <TouchableOpacity
                style={styles.countryButton}
                onPress={() => !otpSent && setCountryPickerVisible(true)}
                disabled={otpSent}
              >
                <Text style={styles.countryButtonText}>
                  {countryCode.flag} {countryCode.dial}
                </Text>
                <ChevronDown size={16} color={colors.black} />
              </TouchableOpacity>
              <TextInput
                style={[styles.input, styles.phoneInput]}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={t => setPhone(t.replace(/[^0-9]/g, ''))}
                placeholder="XXXXXXXXXX"
                editable={!otpSent}
              />
            </View>
          </View>

          <Modal
            visible={countryPickerVisible}
            transparent
            animationType="fade"
            onRequestClose={() => {
              setCountryPickerVisible(false);
              setCountrySearch('');
            }}
          >
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => {
                setCountryPickerVisible(false);
                setCountrySearch('');
              }}
            >
              <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
                <Text style={styles.modalTitle}>Select Country</Text>
                <TextInput
                  style={styles.countrySearchInput}
                  value={countrySearch}
                  onChangeText={setCountrySearch}
                  placeholder="Search country or code..."
                  autoCapitalize="none"
                />
                <FlatList
                  data={COUNTRIES.filter(c => {
                    const q = countrySearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      c.name.toLowerCase().includes(q) ||
                      c.dial.includes(q.replace('+', ''))
                    );
                  })}
                  keyExtractor={item => `${item.name}-${item.dial}`}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.countryRow}
                      onPress={() => {
                        setCountryCode(item);
                        setCountryPickerVisible(false);
                        setCountrySearch('');
                      }}
                    >
                      <Text style={styles.countryRowText}>
                        {item.flag} {item.name}
                      </Text>
                      <Text style={styles.countryRowDial}>{item.dial}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.countryEmptyText}>
                      No countries match "{countrySearch}"
                    </Text>
                  }
                  style={{ maxHeight: 360 }}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          {otpSent && (
            <View style={styles.field}>
              <Text style={styles.label}>OTP</Text>
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => otpInputRef.current?.focus()}
                style={styles.otpBoxRow}
              >
                {Array.from({ length: OTP_LENGTH }).map((_, i) => {
                  const digit = otp[i] || '';
                  const isNextToFill = i === otp.length;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.otpBox,
                        isNextToFill && styles.otpBoxActive,
                      ]}
                    >
                      <Text style={styles.otpBoxText}>{digit}</Text>
                    </View>
                  );
                })}
              </TouchableOpacity>
              <TextInput
                ref={otpInputRef}
                value={otp}
                onChangeText={t =>
                  setOtp(t.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH))
                }
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                autoFocus
                style={styles.otpHiddenInput}
              />
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {otpSent ? (
            <>
              <Button
                title="Verify & Sign In"
                onPress={onVerifyOtp}
                loading={loading}
              />
              <Text
                style={styles.link}
                onPress={() => {
                  setOtpSent(false);
                  setOtp('');
                }}
              >
                Change phone number
              </Text>
            </>
          ) : (
            <Button title="Send OTP" onPress={onSendOtp} loading={loading} />
          )}
          <Text
            style={{
              textAlign: 'center',
              marginVertical: 16,
              color: colors.muted,
              marginTop: 25,
            }}
          >
            ----------------------------------- Or Login With
            ---------------------------------
          </Text>
          <View
            style={{ flexDirection: 'row', justifyContent: 'center', gap: 20 }}
          >
            <View>
              <TouchableOpacity
              style={{
                alignSelf: 'center',
                marginBottom: 16,
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: colors.blue,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 8,
              }}
              onPress={() => navigation.navigate('Login')}
            >
              <Mail color={colors.white} size={26} />
            </TouchableOpacity>
            <Text style={{ color: colors.muted, marginTop: 0 , textAlign: 'center' }}>Email</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.white,
  },
  title: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: colors.black,
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    color: colors.muted,
    marginBottom: 24,
  },
  field: { marginBottom: 14 },
  label: { fontWeight: '700', marginBottom: 6, color: colors.black },
  input: {
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  error: { color: colors.red, marginBottom: 12, fontWeight: '600' },
  link: {
    textAlign: 'center',
    marginTop: 16,
    color: colors.blue,
    fontWeight: '700',
  },
  otpBoxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  otpBox: {
    width: 44,
    height: 52,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: colors.blue,
  },
  otpBoxText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.black,
  },
  otpHiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: colors.black,
    borderRightWidth: 0,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  countryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.black,
  },
  phoneInput: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.black,
    marginBottom: 10,
  },
  countryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0000001A',
  },
  countryRowText: {
    fontSize: 15,
    color: colors.black,
  },
  countryRowDial: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.blue,
  },
  countrySearchInput: {
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 10,
  },
  countryEmptyText: {
    textAlign: 'center',
    color: colors.muted,
    paddingVertical: 20,
  },
});
