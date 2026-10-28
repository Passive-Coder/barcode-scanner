import { Redirect } from "expo-router";

/** Links to screens that don't exist (for example from an older version) go home. */
export default function NotFound() {
  return <Redirect href="/" />;
}
