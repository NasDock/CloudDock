import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BottomNavigation } from 'react-native-paper';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TabItem {
  key: string;
  title: string;
  icon: string;
  route: string;
}

const tabs: TabItem[] = [
  { key: 'dashboard', title: '首页', icon: 'home', route: '/' },
  { key: 'tunnels', title: '隧道', icon: 'tunnel', route: '/tunnels' },
  { key: 'devices', title: '设备', icon: 'devices', route: '/devices' },
  { key: 'profile', title: '我的', icon: 'account', route: '/profile' },
];

interface TabNavigatorProps {
  style?: ViewStyle;
}

export function TabNavigator({ style }: TabNavigatorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // Map current route to index
  const getIndex = () => {
    const currentTab = tabs.find((tab) => tab.route === pathname);
    return currentTab ? tabs.indexOf(currentTab) : 0;
  };

  const handleIndexChange = (index: number) => {
    const tab = tabs[index];
    router.push(tab.route as '/');
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }, style]}>
      <BottomNavigation.Bar
        navigationState={{ index: getIndex(), routes: tabs }}
        onTabPress={({ route }) => {
          const tab = tabs.find((t) => t.key === route.key);
          if (tab) {
            handleIndexChange(tabs.indexOf(tab));
          }
        }}
        renderIcon={({ route, focused }) => {
          const tab = tabs.find((t) => t.key === route.key);
          return <BottomNavigation.Icon icon={tab?.icon || 'circle'} focused={focused} />;
        }}
        getLabelText={({ route }) => {
          const tab = tabs.find((t) => t.key === route.key);
          return tab?.title || '';
        }}
        style={styles.bar}
        activeColor="#6366F1"
        inactiveColor="#6B7280"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bar: {
    backgroundColor: '#FFFFFF',
    height: 60,
  },
});
