import React from "react";
import { View, StyleSheet } from "react-native";
import FriendListItem from "./FriendListItem";
import { SPACING, COLORS, SHADOWS } from "../../../theme";
import { useColors } from "../../../context/ThemeContext";

type Friend = {
  id: string;
  name: string;
  avatar?: string | null;
  isOnline?: boolean;
  stats: { tasks: number; streak: number; points: number };
};

const FriendsList: React.FC<{ friends: Friend[] }> = ({ friends }) => {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <View style={styles.list}>
        {friends.map((f) => (
          <FriendListItem key={f.id} name={f.name} avatar={f.avatar} isOnline={f.isOnline} stats={f.stats} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: SPACING.lg,
    overflow: "hidden",
    ...SHADOWS.card,
  },
  list: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: SPACING.md,
  },
});

export default FriendsList;
