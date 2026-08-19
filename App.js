import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/context/AppContext';
import { Navigation } from './src/navigation/Navigation';
import { Colors } from './src/constants/colors';

export default function App() {
  return (
    <SafeAreaProvider style={styles.container}>
      <AppProvider>
        <Navigation />
        <StatusBar style="dark" backgroundColor={Colors.surface} />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
