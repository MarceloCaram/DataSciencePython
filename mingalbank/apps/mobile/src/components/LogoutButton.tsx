import React from "react";
import { Alert, Text, TouchableOpacity } from "react-native";

import { useAuth } from "../state/auth";
import { useAppTheme } from "../theme";

export function LogoutButton() {
  const theme = useAppTheme();
  const { logout } = useAuth();

  function confirmLogout() {
    Alert.alert("Sair", "Deseja sair da sua conta?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: () => void logout() },
    ]);
  }

  return (
    <TouchableOpacity onPress={confirmLogout} hitSlop={12} style={{ marginRight: 16 }}>
      <Text style={{ color: theme.colors.onPrimary, fontWeight: "700" }}>Sair</Text>
    </TouchableOpacity>
  );
}
