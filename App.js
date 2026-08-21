import React, { Component } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/context/AppContext';
import { Navigation } from './src/navigation/Navigation';
import { Colors } from './src/constants/colors';

class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('💥 [AppErrorBoundary] Unhandled Component Error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>⚠️ Application Error</Text>
          <Text style={styles.errorMessage}>{this.state.error?.message || 'An unexpected error occurred during rendering.'}</Text>
          <ScrollView style={styles.errorStackBox}>
            <Text style={styles.errorStackText}>{this.state.error?.stack || 'No stack trace available.'}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>🔄 Reload App</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <SafeAreaProvider style={styles.container}>
      <ErrorBoundary>
        <AppProvider>
          <Navigation />
          <StatusBar style="dark" backgroundColor={Colors.surface} />
        </AppProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  errorStackBox: {
    maxHeight: 200,
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    marginBottom: 20,
  },
  errorStackText: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  retryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
