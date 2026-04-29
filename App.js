import React, { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoadingScreen from './screens/LoadingScreen';
import LoginScreen from './screens/LoginScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import BlotterScreen from './screens/ComplaintScreen';
import StatusScreen from './screens/StatusScreen';
import ReceivedBlotterScreen from './screens/ReceivedBlotterScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import ProfileScreen from './screens/ProfileScreen';

function Root() {
  const { user, isLoading } = useAuth();
  const [currentRoute, setCurrentRoute] = useState({ screen: 'Login', params: {} });
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory([]);
    setCurrentRoute({ screen: user ? 'Home' : 'Login', params: {} });
  }, [user]);

  if (isLoading) return <LoadingScreen />;

  const navigation = {
    navigate: (name, params = {}) => {
      setCurrentRoute((current) => {
        if (current.screen !== name || JSON.stringify(current.params || {}) !== JSON.stringify(params || {})) {
          setHistory((prev) => [...prev, current]);
        }
        return { screen: name, params };
      });
    },
    goBack: () => {
      setHistory((prev) => {
        if (prev.length === 0) {
          setCurrentRoute({ screen: user ? 'Home' : 'Login', params: {} });
          return prev;
        }

        const nextHistory = prev.slice(0, -1);
        const previousRoute = prev[prev.length - 1];
        setCurrentRoute(previousRoute);
        return nextHistory;
      });
    },
    goHome: () => {
      setHistory([]);
      setCurrentRoute({ screen: 'Home', params: {} });
    },
  };

  if (!user) {
    if (currentRoute.screen === 'ForgotPassword') {
      return <ForgotPasswordScreen navigation={navigation} />;
    }

    return currentRoute.screen === 'Register'
      ? <RegisterScreen navigation={navigation} />
      : <LoginScreen navigation={navigation} />;
  }

  if (currentRoute.screen === 'Blotter') return <BlotterScreen navigation={navigation} />;
  if (currentRoute.screen === 'Status') return <StatusScreen navigation={navigation} route={{ params: currentRoute.params }} />;
  if (currentRoute.screen === 'ReceivedBlotter') return <ReceivedBlotterScreen navigation={navigation} route={{ params: currentRoute.params }} />;
  if (currentRoute.screen === 'Notifications') return <NotificationsScreen navigation={navigation} />;
  if (currentRoute.screen === 'Profile') return <ProfileScreen navigation={navigation} />;

  return <HomeScreen navigation={navigation} />;
}

export default function App() {
  return (
    <AuthProvider>
      <InnerApp />
    </AuthProvider>
  );
}

function InnerApp() {
  const { isDarkMode } = useAuth();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? '#0f172a' : '#fff' }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Root />
    </SafeAreaView>
  );
}
