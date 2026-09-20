import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import { Text } from "react-native";

import { LogoutButton } from "../components";
import { ChildHomeScreen } from "../screens/child/ChildHomeScreen";
import { RewardsScreen } from "../screens/child/RewardsScreen";
import { WalletScreen } from "../screens/child/WalletScreen";
import { ThemeProvider, childColors } from "../theme";
import { ChildTasksStack } from "./ChildTasksStack";
import type { ChildTabParamList } from "./types";

const Tab = createBottomTabNavigator<ChildTabParamList>();

const TAB_ICON: Record<keyof ChildTabParamList, string> = {
  Home: "🏡",
  TasksStack: "📋",
  Wallet: "💰",
  Rewards: "🎁",
};

const TAB_LABEL: Record<keyof ChildTabParamList, string> = {
  Home: "Início",
  TasksStack: "Tarefas",
  Wallet: "Carteira",
  Rewards: "Prêmios",
};

function ChildTabsInner() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: childColors.primary },
        headerTintColor: childColors.onPrimary,
        headerTitleStyle: { fontWeight: "800" },
        headerRight: () => <LogoutButton />,
        tabBarActiveTintColor: childColors.primary,
        tabBarInactiveTintColor: childColors.textSecondary,
        tabBarStyle: { backgroundColor: childColors.surface, borderTopColor: childColors.border, height: 64, paddingBottom: 8 },
        tabBarLabelStyle: { fontWeight: "700" },
        tabBarLabel: TAB_LABEL[route.name as keyof ChildTabParamList],
        tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>{TAB_ICON[route.name as keyof ChildTabParamList]}</Text>,
      })}
    >
      <Tab.Screen name="Home" component={ChildHomeScreen} options={{ title: "MingalBank" }} />
      <Tab.Screen name="TasksStack" component={ChildTasksStack} options={{ title: "Tarefas", headerShown: false }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ title: "Carteira" }} />
      <Tab.Screen name="Rewards" component={RewardsScreen} options={{ title: "Prêmios" }} />
    </Tab.Navigator>
  );
}

export function ChildTabs() {
  return (
    <ThemeProvider mode="child">
      <ChildTabsInner />
    </ThemeProvider>
  );
}
