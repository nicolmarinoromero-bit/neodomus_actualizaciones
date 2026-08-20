import {
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
<SafeAreaView style={{ flex: 1 }}>
  ...
</SafeAreaView>

import { router } from "expo-router";

export default function HomeScreen() {
  return (
    <ImageBackground
      source={require("../../assets/images/FONDO.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
      <View style={styles.titleContainer}>
        <View style={styles.goldLine} />
        <Text style={styles.title}>NEODOMUS</Text>
      </View>
        <Text style={styles.slogan}>
          "NEODOMUS más que tecnología, una evolución."
        </Text>

        <Text style={styles.description}>
          En NEODOMUS ofrecemos soluciones integrales en tecnología,
          innovación y gestión de servicios, diseñadas para mejorar
          la seguridad, eficiencia y confianza de nuestros clientes.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push("/login")}
        >
          <View style={styles.iconCircle}>
            <Text style={styles.arrow}>{">"}</Text>
          </View>

          <Text style={styles.buttonText}>
            CONTINUAR
          </Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({

  titleContainer: {
  position: "relative",
  alignSelf: "flex-start",
  marginBottom: 20,
},

  background: {
    flex: 1,
    backgroundColor: "#000",
  },

  overlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 30,
    backgroundColor: "rgba(0,0,0,0.60)",
  },

  title: {
  color: "#FFFFFF",
  fontSize: 48,
  fontWeight: "900",
  letterSpacing: -1,
  zIndex: 1,
},

  slogan: {
    color: "#CAA24D",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
    lineHeight: 28,
  },

  description: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 28,
    marginBottom: 35,
  },

  button: {
  flexDirection: "row",
  alignItems: "center",
  alignSelf: "flex-start",
  borderWidth: 2,
  borderColor: "#FFF",
  paddingVertical: 12,
  paddingHorizontal: 18,
  borderRadius: 4,
  },

  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  
 goldLine: {
  position: "absolute",
  left: 0,
  bottom: 8,
  width: 175,
  height: 18,
  backgroundColor: "#CAA24D",
  zIndex: 0,
},
  arrow: {
    color: "#FFF",
    fontWeight: "bold",
  },

  buttonText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
  },
});