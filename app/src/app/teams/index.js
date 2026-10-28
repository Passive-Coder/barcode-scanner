import { router } from "expo-router";
import { TeamList } from "../../components/teams/TeamList.js";
import { Screen } from "../../components/ui/Screen.js";
import { SignInPrompt } from "../../components/ui/SignInPrompt.js";
import { useStore } from "../../lib/store.js";
import { account } from "../../stores/account.js";

/** Your teams: lists of people to add to events and sub-teams in one go. */
export default function Teams() {
  useStore(account);
  return (
    <Screen title="Teams">
      {account.ready ? <TeamList onOpen={(id) => router.push({ pathname: "/teams/[id]", params: { id } })} /> : <SignInPrompt what="your teams" />}
    </Screen>
  );
}
