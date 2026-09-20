import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { LoginScreen } from "../screens/LoginScreen";
import { useAuth } from "../state/auth";
import { neutralColors } from "../theme";
import { ChildTabs } from "./ChildTabs";
import { ParentTabs } from "./ParentTabs";
import type { AuthStackParamList } from "./types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

function SplashLoading() {
  return (
    <View style={[styles.splash, { backgroundColor: neutralColors.background }]}>
      <ActivityIndicator size="large" color={neutralColors.primary} />
    </View>
  );
}

/**
 * Mostra o fluxo de login se não autenticado, ou o fluxo certo
 * (ParentTabs / ChildTabs) conforme o papel (role) da sessão atual.
 */
export function RootNavigator() {
  const { status, session } = useAuth();

  if (status === "loading") return <SplashLoading />;
  if (status === "unauthenticated" || !session) return <AuthNavigator />;
  if (session.role === "PARENT") return <ParentTabs />;
  return <ChildTabs />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center" },
});
