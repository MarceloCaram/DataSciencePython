import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme";

interface AvatarProps {
  name: string;
  photoUrl?: string;
  size?: number;
}

const AVATAR_COLORS = ["#FF7A45", "#7C4DFF", "#3E7C97", "#31C574", "#F2A93B", "#FF5C7A"];

function colorForName(name: string): string {
  const sum = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase();
}

export function Avatar({ name, photoUrl, size = 56 }: AvatarProps) {
  const theme = useAppTheme();
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (photoUrl) {
    return <Image source={{ uri: photoUrl }} style={[styles.image, dimension]} />;
  }

  return (
    <View style={[styles.fallback, dimension, { backgroundColor: colorForName(name) }]}>
      <Text style={[styles.initials, { fontSize: size * 0.38, color: theme.colors.onPrimary }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: "#EEE" },
  fallback: { alignItems: "center", justifyContent: "center" },
  initials: { fontWeight: "800" },
});
