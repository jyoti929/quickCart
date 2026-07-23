import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "../constants/theme";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
  timestamp: Date;
  isInvoiceDownload?: boolean;
}

interface ChatbotModalProps {
  visible: boolean;
  onClose: () => void;
  orderContext?: any; // Contextual order if opened from details
  onDownloadInvoice?: (order: any) => void;
}

export default function ChatbotModal({
  visible,
  onClose,
  orderContext,
  onDownloadInvoice,
}: ChatbotModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Generate return policy date (14 days from purchase)
  const getReturnLimitDate = (isoString?: string) => {
    if (!isoString) return "14 days from delivery";
    try {
      const d = new Date(isoString);
      d.setDate(d.getDate() + 14);
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    } catch {
      return "14 days from delivery";
    }
  };

  // Helper to format date
  const formatDate = (isoString?: string) => {
    if (!isoString) return "N/A";
    try {
      return new Date(isoString).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  // Initialize welcome messages
  useEffect(() => {
    if (visible) {
      const welcomeMsgs: Message[] = [
        {
          id: "welcome-1",
          sender: "bot",
          text: "Hello Hello! I am your quickCart Customer Support Assistant. How can I help you today?",
          timestamp: new Date(),
        },
      ];

      if (orderContext) {
        welcomeMsgs.push({
          id: "welcome-2",
          sender: "bot",
          text: `Info I see you are currently viewing order **#${orderContext.orderId.slice(-6).toUpperCase()}** (${orderContext.status}). Let me know if you have any questions regarding its items, delivery status, or invoice.`,
          timestamp: new Date(),
        });
      }

      setMessages(welcomeMsgs);
    } else {
      setMessages([]);
      setInputText("");
      setIsTyping(false);
    }
  }, [visible, orderContext]);

  // Autoscroll to bottom when messages change
  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isTyping]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    if (!textToSend) {
      setInputText("");
    }

    const newUserMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setIsTyping(true);

    // Simulate bot response
    setTimeout(() => {
      setIsTyping(false);
      const responseText = getBotResponse(text);
      const newBotMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: responseText,
        timestamp: new Date(),
        isInvoiceDownload: text.toLowerCase().includes("invoice") && !!orderContext,
      };
      setMessages((prev) => [...prev, newBotMsg]);
    }, 1200);
  };

  const getBotResponse = (userInput: string): string => {
    const input = userInput.toLowerCase();
    const order = orderContext;

    // Helper for status descriptions
    const getStatusInfo = (status: string) => {
      const s = status.toLowerCase();
      if (s === "delivered") {
        return "Your package has been successfully delivered! Let us know if you want to request an exchange or return an item.";
      }
      if (s === "cancelled") {
        return "This order has been cancelled and a refund (if applicable) has been processed back to your original payment method.";
      }
      if (s.includes("transit") || s.includes("way") || s.includes("delivery")) {
        return "Your order is currently with our courier partner and is on its way. It will reach your address shortly!";
      }
      return "We are preparing your items. It will be shipped soon and we will send you tracking updates.";
    };

    // Keyword checking
    if (input.includes("track") || input.includes("where") || input.includes("status")) {
      if (order) {
        return `Order **Order Status Update**\n\nOrder **#${order.orderId.slice(-6).toUpperCase()}** is currently **${order.status}**.\n\n* **Placed on:** ${formatDate(order.createdAt)}\n* **Shipping to:** ${order.address}\n\n${getStatusInfo(order.status)}`;
      }
      return "I can help you track any order! Please open the specific order details page and click my chat icon to track it immediately, or go to your Profile and check past orders.";
    }

    if (input.includes("invoice") || input.includes("receipt") || input.includes("bill")) {
      if (order) {
        return `Invoice **Invoice Request**\n\nThe invoice for order **#${order.orderId.slice(-6).toUpperCase()}** contains details for ${order.items?.length || 0} items totaling **Rs. ${order.totalAmount}**.\n\nYou can click the 'Download Invoice' button inside the order summary details page, or click the download option on the bot message.`;
      }
      return "To download an invoice, please visit your Order Summary page for that order, where you will find the 'Download Invoice' option. If you don't see your order, please log in or contact support.";
    }

    if (input.includes("address") || input.includes("change") || input.includes("location")) {
      if (order) {
        const changeable =
          order.status.toLowerCase() === "placed" ||
          order.status.toLowerCase() === "pending" ||
          order.status.toLowerCase() === "preparing to pack";
        return `Address **Delivery Address**\n\nFor order **#${order.orderId.slice(-6).toUpperCase()}**, the current shipping address is:\n*${order.address}*\n\n${
          changeable
            ? "Since your order is still in the preparation stage, you can modify this address by clicking the 'Address' button directly on the Order card!"
            : "Your order is already processed or shipped, so we cannot modify the delivery address for this shipment. Please contact courier support if you need redirection."
        }`;
      }
      return "You can modify your delivery address for any order that has not yet been shipped (status Placed or Preparing). Simply open the Orders page and click the 'Address' button on that order.";
    }

    if (input.includes("return") || input.includes("exchange") || input.includes("refund")) {
      if (order) {
        if (order.status.toLowerCase() === "delivered") {
          return `Returns **Return & Exchange Policy**\n\nThis order was delivered successfully. You have a **14-day window** to request refunds, style exchanges, or size exchanges. For this order, the window is open until **${getReturnLimitDate(order.createdAt)}**.\n\nYou can trigger these options directly using the buttons on the main Orders list page.`;
        }
        return `Returns **Return & Exchange Policy**\n\nReturns and exchanges are only available once an order has been successfully **Delivered**. Since this order is currently **${order.status}**, you will have to wait for delivery before initiating a return. You can cancel it if it has not been shipped.`;
      }
      return "We offer a 14-day hassle-free return and exchange policy on all groceries and products from the date of delivery. Refunds are credited to your original payment method in 3-5 business days.";
    }

    if (input.includes("cancel")) {
      if (order) {
        const s = order.status.toLowerCase();
        const cancellable = s === "placed" || s === "pending" || s === "confirmed" || s === "preparing to pack";
        return `Cancellation **Order Cancellation**\n\n${
          cancellable
            ? `Your order **#${order.orderId.slice(-6).toUpperCase()}** is eligible for cancellation. You can cancel it immediately by clicking the 'Cancel' button on the Order card to stop shipment and process your refund.`
            : `Your order is currently **${order.status}** and has already left our packing center. Therefore, it can no longer be cancelled. You can refuse delivery or initiate a return once delivered.`
        }`;
      }
      return "Orders can be cancelled anytime before they are shipped. Visit the 'My Orders' section to see if your order is eligible.";
    }

    if (input.includes("agent") || input.includes("human") || input.includes("support") || input.includes("sarah")) {
      return "Support **Live Agent Support**\n\nConnecting you to our quickCart live support team...\n\n*Agent Sarah has joined the chat.* \n\n\"Hi, I am Sarah. I have reviewed your order details. How can I help you resolve this issue today?\"";
    }

    if (input.includes("hello") || input.includes("hi") || input.includes("hey")) {
      return "Hello! I am here to help you. What questions do you have about your orders or delivery services?";
    }

    return "I want to make sure I give you the correct details! Please choose one of the quick options below, or ask for a live support agent.";
  };

  const quickReplies = [
    { label: "Address Track Order", text: "Track my order status" },
    { label: "Invoice Get Invoice", text: "How can I download the invoice?" },
    { label: "Returns Returns & Exchange", text: "What is the return/exchange policy?" },
    { label: "Edit Edit Address", text: "Can I change my delivery address?" },
    { label: "Support Live Agent", text: "Connect me with a live support agent" },
  ];

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.botAvatar}>
                <Ionicons name="chatbubbles" size={20} color="#ffffff" />
                <View style={styles.onlineBadge} />
              </View>
              <View>
                <Text style={styles.headerTitle}>quickCart Support</Text>
                <Text style={styles.headerSubtitle}>Online - Replies instantly</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Theme.colors.primaryDark} />
            </TouchableOpacity>
          </View>

          {/* Messages List */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chatContainer}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg) => {
              const isBot = msg.sender === "bot";
              return (
                <View
                  key={msg.id}
                  style={[
                    styles.messageRow,
                    isBot ? styles.messageRowLeft : styles.messageRowRight,
                  ]}
                >
                  {isBot && (
                    <View style={styles.messageAvatar}>
                      <Ionicons name="logo-android" size={14} color="#ffffff" />
                    </View>
                  )}
                  <View
                    style={[
                      styles.messageBubble,
                      isBot ? styles.bubbleLeft : styles.bubbleRight,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        isBot ? styles.textLeft : styles.textRight,
                      ]}
                    >
                      {msg.text}
                    </Text>

                    {/* Inline helper download button if invoice requested */}
                    {msg.isInvoiceDownload && onDownloadInvoice && (
                      <TouchableOpacity
                        style={styles.inlineDownloadBtn}
                        onPress={() => {
                          onDownloadInvoice(orderContext);
                        }}
                      >
                        <Ionicons name="download-outline" size={16} color="#ffffff" />
                        <Text style={styles.inlineDownloadText}>Download Invoice PDF</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}

            {isTyping && (
              <View style={[styles.messageRow, styles.messageRowLeft]}>
                <View style={styles.messageAvatar}>
                  <Ionicons name="logo-android" size={14} color="#ffffff" />
                </View>
                <View style={[styles.messageBubble, styles.bubbleLeft, styles.typingBubble]}>
                  <ActivityIndicator size="small" color={Theme.colors.primary} />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Quick Replies */}
          <View style={styles.quickRepliesContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickRepliesScroll}
            >
              {quickReplies.map((reply, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.quickReplyBubble}
                  onPress={() => handleSend(reply.text)}
                >
                  <Text style={styles.quickReplyText}>{reply.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Input Bar */}
          <View style={[styles.inputBar, { paddingBottom: Math.max(Platform.OS === "ios" ? 20 : 12, 12) }]}>
            <TextInput
              style={styles.textInput}
              placeholder="Ask anything about your orders..."
              placeholderTextColor="#94a3b8"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => handleSend()}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !inputText.trim() && styles.sendButtonDisabled,
              ]}
              onPress={() => handleSend()}
              disabled={!inputText.trim()}
            >
              <Ionicons name="send" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "82%",
    width: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  botAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22c55e",
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
    marginTop: 1,
  },
  closeButton: {
    padding: 4,
  },
  chatScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  chatContainer: {
    paddingVertical: 16,
    gap: 16,
  },
  messageRow: {
    flexDirection: "row",
    width: "100%",
    alignItems: "flex-end",
  },
  messageRowLeft: {
    justifyContent: "flex-start",
    gap: 8,
  },
  messageRowRight: {
    justifyContent: "flex-end",
  },
  messageAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: "80%",
  },
  bubbleLeft: {
    backgroundColor: "#f1f5f9",
    borderBottomLeftRadius: 4,
  },
  bubbleRight: {
    backgroundColor: Theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  typingBubble: {
    width: 60,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  messageText: {
    fontSize: 13,
    lineHeight: 19,
  },
  textLeft: {
    color: "#334155",
    fontWeight: "500",
  },
  textRight: {
    color: "#ffffff",
    fontWeight: "500",
  },
  inlineDownloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
    gap: 6,
  },
  inlineDownloadText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  quickRepliesContainer: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
  },
  quickRepliesScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickReplyBubble: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  quickReplyText: {
    color: Theme.colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 22,
    paddingHorizontal: 16,
    height: 44,
    color: "#1e293b",
    fontSize: 13,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
});


