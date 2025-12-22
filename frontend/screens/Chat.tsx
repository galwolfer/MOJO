import React, { useEffect, useState, useRef, useCallback } from "react";
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import AppText from "../components/common/AppText";
import TextBouble from "../components/common/TextBouble";
import Input from "../components/inputs/Input";
import { COLORS, FONT_SIZES, SHADOWS, SPACING } from "../theme";
import { useNavigation } from "../context/NavigationContext";
import { useAuth } from "../context/AuthContext";
import { ICONS } from "../components/icons/icons";
import { sendChatMessage, setChatAuthToken, SendMessageResponse } from "../services/chatService";
import { useKeyboard } from "../hooks";

type LocalMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isTyping?: boolean;
};

export default function ChatScreen() {
  const { setHeaderConfig, setNavBarConfig } = useNavigation();
  const { token } = useAuth();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => `session_${Date.now()}`);
  const flatListRef = useRef<FlatList>(null);
  const { visible: keyboardVisible, height: keyboardHeight } = useKeyboard();
  const listPaddingBottom = SPACING.md + (keyboardVisible ? keyboardHeight : 0);

  // Set auth token for chat service
  useEffect(() => {
    if (token) {
      setChatAuthToken(token);
    }
  }, [token]);

  useEffect(() => {
    // Configure Header
    setHeaderConfig({
      title: "Mojo",
      show: true,
      icon: ICONS.ojo,
    });
  }, []);

  // Cleanup when leaving screen
  useEffect(() => {
    return () => {
      setNavBarConfig({ show: true, widget: null });
    };
  }, [setNavBarConfig]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleSend = useCallback(async () => {
    const trimmedText = message.trim();
    if (!trimmedText || isLoading) return;

    // Clear input immediately
    setMessage("");

    // Add user message
    const userMessage: LocalMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: trimmedText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    scrollToBottom();

    // Show loading state
    setIsLoading(true);

    try {
      const response: SendMessageResponse = await sendChatMessage({
        message: trimmedText,
        sessionId,
      });

      if (response.success && response.response) {
        // Update sessionId if returned
        if (response.sessionId) {
          setSessionId(response.sessionId);
        }

        // Add agent response
        const agentMessage: LocalMessage = {
          id: `agent_${Date.now()}`,
          role: "assistant",
          content: response.response,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, agentMessage]);
        scrollToBottom();
      } else {
        // Handle error response
        const errorMessage: LocalMessage = {
          id: `error_${Date.now()}`,
          role: "assistant",
          content: response.error || "Sorry, something went wrong. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        scrollToBottom();
      }
    } catch (error) {
      // Handle network/API error
      const errorMessage: LocalMessage = {
        id: `error_${Date.now()}`,
        role: "assistant",
        content: "Unable to connect. Please check your connection and try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      scrollToBottom();
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, message, sessionId, scrollToBottom]);

  // Put the chat input back into the shared NavBar (original behavior)
  useEffect(() => {
    setNavBarConfig({
      show: true,
      widget: (
        <View style={[styles.inputContainer]}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="Type a message..."
              value={message}
              onChangeText={setMessage}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              editable={!isLoading}
              multiline
            />
          </View>
          <TouchableOpacity
            style={[styles.sendButton, (!message.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!message.trim() || isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.colorWhite} />
            ) : (
              <ICONS.send size={FONT_SIZES.base} color={COLORS.colorWhite} />
            )}
          </TouchableOpacity>
        </View>
      ),
    });
  }, [handleSend, isLoading, message, setNavBarConfig]);

  const renderMessage = useCallback(
    ({ item, index }: { item: LocalMessage; index: number }) => {
      const isUser = item.role === "user";

      return (
        <View style={[styles.messageRow, isUser ? styles.userMessageRow : styles.agentMessageRow]}>
          <TextBouble
            mode={isUser ? "user" : "agent"}
            typewriter={!isUser && index === messages.length - 1}
            playOnceKey={item.id}
            style={styles.messageBubble}
          >
            <AppText variant="bodyText">
              {item.content.endsWith("\n") ? item.content.slice(0, -1) : item.content}
            </AppText>
          </TextBouble>
        </View>
      );
    },
    [messages.length]
  );

  const keyExtractor = useCallback((item: LocalMessage) => item.id, []);

  return (
    <View style={styles.container}>
      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        contentContainerStyle={[styles.messagesList, { paddingBottom: listPaddingBottom }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <AppText variant="bodyText" style={styles.emptyText}>
              Start a conversation with Mojo!
            </AppText>
            <AppText variant="notes" style={styles.emptySubtext}>
              Ask me anything about your tasks, schedule, or how I can help you stay productive.
            </AppText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white3,
  },
  messagesList: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    flexGrow: 1,
  },
  messageRow: {
    marginBottom: SPACING.md,
    maxWidth: "85%",
  },
  userMessageRow: {
    alignSelf: "flex-end",
  },
  agentMessageRow: {
    alignSelf: "flex-start",
  },
  messageBubble: {
    maxWidth: "100%",
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.xlg,
    paddingTop: 100,
  },
  emptyText: {
    color: COLORS.darkGray,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    color: COLORS.lightGray,
    textAlign: "center",
  },
  inputContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  sendButton: {
    width: FONT_SIZES.base * 2.5 + 1.5,
    height: FONT_SIZES.base * 2.5 + 1.5,
    borderRadius: FONT_SIZES.base,
    backgroundColor: COLORS.primary1,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.card,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.lightGray,
  },
});
