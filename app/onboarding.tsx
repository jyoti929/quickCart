import React, { useState, useRef } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme } from "../constants/theme";

const DesignerLogo = () => (
  <View style={logoStyles.container}>
    <View style={logoStyles.logoWrapper}>
      <Image
        source={require("../assets/images/logo.png")}
        style={logoStyles.logoImage}
        resizeMode="contain"
      />
    </View>
    <View style={logoStyles.textRow}>
      <Text style={logoStyles.brandQuick}>quick</Text>
      <Text style={logoStyles.brandCart}>Cart</Text>
    </View>
    <View style={logoStyles.taglineBadge}>
      <Text style={logoStyles.taglineText}>GROCERIES & BEYOND</Text>
    </View>
  </View>
);

export default function Index() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (step < 2) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -10,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setStep((prev) => prev + 1);
        slideAnim.setValue(10);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      router.replace("/signup" as any);
    }
  };

  const handleSkip = () => {
    router.replace("/signup" as any);
  };

  // Render illustration for each step matching the reference design style
  const renderIllustration = () => {
    switch (step) {
      case 0:
        return <DesignerLogo />;
      case 1:
        return (
          <View style={styles.illustrationWrapper}>
            <Image
              source={require("../assets/images/shopping_illustration.png")}
              style={styles.illustrationImage}
              resizeMode="contain"
            />
          </View>
        );
      case 2:
        return (
          <View style={styles.illustrationWrapper}>
            <Image
  source={require("../assets/images/delivery_illustration.png")}
  style={[
    styles.illustrationImage,
    {
      transform: [{ scale: 1.8 }],
    },
  ]}
  resizeMode="contain"
/>
          </View>
        );
      default:
        return null;
    }
  };

  const onboardingContent = [
    {
      title: "Welcome to quickCart",
      description: "Discover a seamless shopping experience right at your fingertips.",
    },
    {
      title: "Smart Shopping List",
      description: "Browse curated categories and add fresh daily essentials to your cart in one tap.",
    },
    {
      title: "Flash Delivery",
      description: "Get your favorite local store items delivered straight to your door in minutes.",
    },
  ];

  const currentContent = onboardingContent[step];

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Theme.colors.background} />

      {/* Skip Button in Top-Right */}
      <View style={styles.header}>
        {step < 2 ? (
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.6}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.skipPlaceholder} />
        )}
      </View>

      {/* Main Content Area */}
      <Animated.View
        style={[
          styles.mainContent,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Central Logo / Visual */}
        <View style={styles.illustrationContainer}>
          {renderIllustration()}
        </View>

        {/* Welcome Heading & Subtext */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{currentContent.title}</Text>
          <Text style={styles.description}>{currentContent.description}</Text>
        </View>
      </Animated.View>

      {/* Bottom Area: Indicators & Action Button */}
      <View style={styles.footer}>
        {/* Onboarding Indicators */}
        <View style={styles.indicatorRow}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                step === i ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          ))}
        </View>

        {/* Next / Get Started Action Button */}
        <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={handleNext}>
          <Text style={styles.buttonText}>
            {step === 2 ? "Get Started" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const logoStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrapper: {
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 75,
    shadowColor: "#2e3a32",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E2E6E2",
  },
  logoImage: {
    width: 350,
    height: 350,
  },
  textRow: {
    flexDirection: "row",
    marginTop: 20,
    alignItems: "center",
  },
  brandQuick: {
    fontSize: 32,
    fontWeight: "300",
    color: Theme.colors.primaryDark,
    letterSpacing: -0.5,
  },
  brandCart: {
    fontSize: 32,
    fontWeight: "800",
    color: Theme.colors.primary,
    letterSpacing: -0.5,
  },
  taglineBadge: {
    marginTop: 8,
    backgroundColor: "#E2E6E2",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  taglineText: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    letterSpacing: 1.5,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: "space-between",
  },
  header: {
    height: 50,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 24,
    marginTop: 8,
  },
  skipText: {
    fontSize: 15,
    fontWeight: "600",
    color: Theme.colors.primaryDark,
  },
  skipPlaceholder: {
    height: 20,
  },
  mainContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  illustrationContainer: {
    height: 270,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 25,
  },
  illustrationWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  illustrationImage: {
    width: 320,
    height: 250,
  },
  glowCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#c6dad1e7",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Theme.colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  logoCard: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    borderWidth: 1.5,
    borderColor: "#E2E6E2",
  },
  badgeTopRight: {
    position: "absolute",
    top: 24,
    right: 24,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  textContainer: {
    alignItems: "center",
    marginTop: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: Theme.colors.primaryDark,
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: Theme.colors.textMedium,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    alignItems: "center",
    gap: 36,
  },
  indicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 18,
    backgroundColor: Theme.colors.primary,
  },
  inactiveDot: {
    width: 6,
    backgroundColor: "#cbd5e1",
  },
  button: {
    backgroundColor: Theme.colors.primary,
    width: "70%",
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Theme.colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
