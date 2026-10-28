import { attempt } from "../../lib/feedback.js";
import { useStore } from "../../lib/store.js";
import { account } from "../../stores/account.js";
import { auth } from "../../stores/auth.js";
import { workspace } from "../../stores/workspace.js";
import { Button } from "./Button.js";
import { Card } from "./Card.js";
import { Text } from "./Text.js";

/**
 * Stands in for a screen that needs a Linework session: asks to sign in, waits for the session,
 * or explains that the server can't be reached.
 * @param {{ what: string }} props
 */
export function SignInPrompt({ what }) {
  useStore(auth);
  useStore(account);
  if (account.status === "connecting") {
    return (
      <Card>
        <Text variant="subheading">Connecting to Linework…</Text>
      </Card>
    );
  }
  if (account.status === "unavailable") {
    return (
      <Card>
        <Text variant="subheading">Linework's server can't be reached</Text>
        <Text muted>{`${account.problem} Scanning and Google Sheets still work.`}</Text>
        <Button label="Try again" onPress={() => account.ensure()} />
      </Card>
    );
  }
  return (
    <Card>
      <Text variant="subheading">{`Sign in to see ${what}`}</Text>
      <Text muted>Events, teams, and alerts are tied to your Google account.</Text>
      <Button variant="primary" busy={auth.status === "connecting"} label="Sign in with Google" onPress={() => attempt(() => workspace.connect(), "Google sign-in failed")} />
    </Card>
  );
}
