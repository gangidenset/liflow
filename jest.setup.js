// テスト環境には端末のストレージがないため、AsyncStorage を公式のメモリ内モックに差し替える
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
