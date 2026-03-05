import React from "react";
import { View, ActivityIndicator } from "react-native";
import Box from "../../../components/layout/Box";
import AppText from "../../../components/common/AppText";
import AppButton from "../../../components/common/AppButton";
import ScheduledSessionsSection from "../../../components/special/task/ScheduledSessionsSection";
import { COLORS, SPACING, FONT_SIZES } from "../../../theme";
import { BusyBlock } from "../../../services/busyBlockService";

interface BlocksBoxProps {
  blocks: BusyBlock[];
  loading: boolean;
  onEdit: (block: BusyBlock) => void;
  onDelete: (block: BusyBlock) => void;
  onAdd: () => void;
}

export function BlocksBox({ blocks, loading, onEdit, onDelete, onAdd }: BlocksBoxProps) {
  const sessions = blocks.map(
    (b, idx) => ({ start: b.start, end: b.end, subtaskTitle: b.title || `Block ${idx + 1}` }) as any,
  );

  return (
    <Box title="BUSY BLOCKS" titleColor={COLORS.primary1} style={{ width: "100%" }}>
      <AppText
        style={{
          fontSize: FONT_SIZES.sm,
          color: COLORS.darkGray,
          marginBottom: SPACING.md,
          lineHeight: FONT_SIZES.sm * 1.5,
        }}
      >
        Mark when you're unavailable. Mojo won't schedule tasks during these windows.
      </AppText>

      {loading ? (
        <ActivityIndicator color={COLORS.primary1} style={{ marginVertical: SPACING.lg }} />
      ) : (
        <>
          {sessions.length === 0 ? (
            <AppText
              style={{
                fontSize: FONT_SIZES.sm,
                color: COLORS.lightGray,
                textAlign: "center",
                marginVertical: SPACING.md,
              }}
            >
              No busy blocks yet.
            </AppText>
          ) : (
            <ScheduledSessionsSection
              taskId="busy-blocks"
              taskTitle=""
              scheduledSessions={sessions}
              hideTitle={true}
              dividerColor={COLORS.lightGray}
              showCheckbox={false}
              onEditSession={(taskId: string, session: any, index: number) => {
                onEdit(blocks[index]);
              }}
            />
          )}
          <AppButton
            title="+ Add Busy Block"
            mode="light"
            color="primary1"
            onPress={onAdd}
            width="100%"
            style={{ alignSelf: "stretch" }}
          />
        </>
      )}
    </Box>
  );
}
