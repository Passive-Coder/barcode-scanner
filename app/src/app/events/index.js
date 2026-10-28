import { router } from "expo-router";
import { EventList } from "../../components/events/EventList.js";
import { Screen } from "../../components/ui/Screen.js";
import { SignInPrompt } from "../../components/ui/SignInPrompt.js";
import { useStore } from "../../lib/store.js";
import { account } from "../../stores/account.js";

/** The events the signed-in person is part of. */
export default function Events() {
  useStore(account);
  return (
    <Screen title="Events">
      {account.ready ? <EventList onOpen={(id) => router.push({ pathname: "/events/[id]", params: { id } })} /> : <SignInPrompt what="your events" />}
    </Screen>
  );
}
