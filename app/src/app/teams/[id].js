import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { TeamDetail } from "../../components/teams/TeamDetail.js";
import { Screen, goBack } from "../../components/ui/Screen.js";
import { SignInPrompt } from "../../components/ui/SignInPrompt.js";
import { attempt } from "../../lib/feedback.js";
import { useStore } from "../../lib/store.js";
import { account } from "../../stores/account.js";
import { teams } from "../../stores/teams.js";

/** One team and its people. */
export default function TeamScreen() {
  useStore(account);
  const { id } = useLocalSearchParams();
  const teamId = typeof id === "string" ? id : "";

  useEffect(() => {
    if (!teamId || !account.ready) return;
    void attempt(() => teams.open(teamId), "Could not open the team");
  }, [teamId, account.ready]);

  useEffect(
    () => () => {
      if (teams.selectedId === teamId) teams.close();
    },
    [teamId],
  );

  return <Screen title="Team">{account.ready ? <TeamDetail onClosed={goBack} /> : <SignInPrompt what="this team" />}</Screen>;
}
