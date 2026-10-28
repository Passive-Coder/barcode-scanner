import { randomUUID } from "expo-crypto";

/** A random UUID (v4). React Native has no crypto.randomUUID(); expo-crypto provides one. */
export const uuid = () => randomUUID();
