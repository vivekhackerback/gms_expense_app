/**
 * Centralized Application Asset Management & Brand Constants
 * 
 * Provides centralized imports and metadata for all app images, logos,
 * and branding icons. Ensures no broken references or duplicated assets.
 */

export const AppImages = {
  /** Main App Logo (432x432 PNG) - ideal for in-app headers, modals, and cards */
  logo: require('../../assets/logo_432.png'),
  
  /** High-resolution App Icon / Logo (1024x1024 PNG) */
  logoLarge: require('../../assets/icon.png'),
  
  /** Primary App Icon */
  icon: require('../../assets/icon.png'),
  
  /** Android Adaptive Icon Foreground */
  adaptiveIcon: require('../../assets/adaptive-icon.png'),
  
  /** Splash Screen Brand Icon */
  splashIcon: require('../../assets/splash-icon.png'),
  
  /** Web Favicon (32x32 PNG) */
  favicon: require('../../assets/favicon.png'),
  
  /** Small Favicon (16x16 PNG) */
  faviconSmall: require('../../assets/favicon-16x16.png'),
};

export const BrandConfig = {
  appName: 'Expense & Khata',
  tagline: 'Smart Offline-First Business & Personal Ledger',
  version: '1.0.0',
  brandColor: '#ffc900', // Primary Brand Yellow
  brandColorDark: '#000000', // Brand Accent Black
  splashBackground: '#ffffff', // Clean contrast background
};

export default AppImages;
