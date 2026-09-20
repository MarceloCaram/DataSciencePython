import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import { Text } from "react-native";

import { LogoutButton } from "../components";
import { ApprovalsScreen } from "../screens/parent/ApprovalsScreen";
import { ChildrenScreen } from "../screens/parent/ChildrenScreen";
import { CreateTaskScreen } from "../screens/parent/CreateTaskScreen";
import { FamilySettingsScreen } from "../screens/parent/FamilySettingsScreen";
import { ParentDashboardScreen } from "../screens/parent/ParentDashboardScreen";
import { ThemeProvider, parentColors } from "../theme";
import type { ParentTabParamList } from "./types";

const Tab = createBottomTabNavigator<ParentTabParamList>();

const TAB_ICON: Record<keyof ParentTabParamList, string> = {
  Dashboard: "🏠",
  Children: "👨‍👩‍👧",
  CreateTask: "➕",
  Approvals: "✅",
  Settings: "⚙️",
};

const TAB_LABEL: Record<keyof ParentTabParamList, string> = {
  Dashboard: "Início",
  Children: "Filhos",
  CreateTask: "Nova tarefa",
  Approvals: "Aprovações",
  Settings: "Ajustes",
};

function ParentTabsInner() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: parentColors.primary },
        headerTintColor: parentColors.onPrimary,
        headerTitleStyle: { fontWeight: "800" },
        headerRight: () => <LogoutButton />,
        tabBarActiveTintColor: parentColors.primary,
        tabBarInactiveTintColor: parentColors.textSecondary,
        tabBarStyle: { backgroundColor: parentColors.surface, borderTopColor: parentColors.border },
        tabBarLabel: TAB_LABEL[route.name as keyof ParentTabParamList],
        tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>{TAB_ICON[route.name as keyof ParentTabParamList]}</Text>,
      })}
    >
      <Tab.Screen name="Dashboard" component={ParentDashboardScreen} options={{ title: "MingalBank" }} />
      <Tab.Screen name="Children" component={ChildrenScreen} options={{ title: "Filhos" }} />
      <Tab.Screen name="CreateTask" component={CreateTaskScreen} options={{ title: "Nova tarefa" }} />
      <Tab.Screen name="Approvals" component={ApprovalsScreen} options={{ title: "Aprovações" }} />
      <Tab.Screen name="Settings" component={FamilySettingsScreen} options={{ title: "Ajustes" }} />
    </Tab.Navigator>
  );
}

export function ParentTabs() {
  return (
    <ThemeProvider mode="parent">
      <ParentTabsInner />
    </ThemeProvider>
  );
}
