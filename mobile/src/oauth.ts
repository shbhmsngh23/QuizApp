import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import { signInWithCredential, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import Constants from "expo-constants";
import { auth } from "./firebase";

const extra = Constants.expoConfig?.extra ?? {};

export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: extra.googleExpoClientId,
    iosClientId: extra.googleIosClientId,
    androidClientId: extra.googleAndroidClientId,
    webClientId: extra.googleWebClientId,
    responseType: "id_token",
    scopes: ["profile", "email"]
  });

  const handleResponse = async () => {
    if (response?.type === "success") {
      const { id_token } = response.params as { id_token: string };
      const credential = GoogleAuthProvider.credential(id_token);
      await signInWithCredential(auth, credential);
    }
  };

  return { request, response, promptAsync, handleResponse };
}

export async function signInWithApple() {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME
    ]
  });

  const provider = new OAuthProvider("apple.com");
  const authCredential = provider.credential({
    idToken: credential.identityToken ?? "",
    rawNonce: credential.user ?? undefined
  });

  await signInWithCredential(auth, authCredential);
}

export function maybeCompleteAuthSession() {
  AuthSession.maybeCompleteAuthSession();
}
