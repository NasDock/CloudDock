import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { IconButton } from 'react-native-paper';
import { useRouter, usePathname } from 'expo-router';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TunnelListScreen from '../screens/TunnelListScreen';
import TunnelDetailScreen from '../screens/TunnelDetailScreen';
import TunnelCreateScreen from '../screens/TunnelCreateScreen';
import DeviceListScreen from '../screens/DeviceListScreen';
import ProfileScreen from '../screens/ProfileScreen';
import QRScanScreen from '../screens/QRScanScreen';

// Types
export type RootStackParamList = {
  '(auth)': undefined;
  '(tabs)': undefined;
  'tunnel-detail': { tunnelId: string };
  'tunnel-create': undefined;
  'qr-scan': undefined;
};

export type AuthStackParamList = {
  login: undefined;
  register: undefined;
};

export type TabStackParamList = {
  index: undefined;
  tunnels: undefined;
  devices: undefined;
  profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="login" component={LoginScreen} />
      <AuthStack.Screen name="register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="index"
        component={DashboardScreen}
        options={{
          tabBarLabel: '首页',
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="home" iconColor={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="tunnels"
        component={TunnelListScreen}
        options={{
          tabBarLabel: '隧道',
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="tunnel" iconColor={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="devices"
        component={DeviceListScreen}
        options={{
          tabBarLabel: '设备',
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="devices" iconColor={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: '我的',
          tabBarIcon: ({ color, size }) => (
            <IconButton icon="account" iconColor={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* Auth Flow */}
        <Stack.Screen name="(auth)" component={AuthNavigator} />

        {/* Main Tab Flow */}
        <Stack.Screen name="(tabs)" component={TabNavigator} />

        {/* Modal Screens */}
        <Stack.Screen
          name="tunnel-detail"
          component={TunnelDetailScreen}
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="tunnel-create"
          component={TunnelCreateScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="qr-scan"
          component={QRScanScreen}
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
