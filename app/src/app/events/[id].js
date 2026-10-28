import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { EventAlerts } from "../../components/events/EventAlerts.js";
import { EventDocs } from "../../components/events/EventDocs.js";
import { EventHeader } from "../../components/events/EventHeader.js";
import { EventPeople } from "../../components/events/EventPeople.js";
import { EventSubteams } from "../../components/events/EventSubteams.js";
import { Screen, goBack } from "../../components/ui/Screen.js";
import { SignInPrompt } from "../../components/ui/SignInPrompt.js";
import { Tabs } from "../../components/ui/Tabs.js";
import { Text } from "../../components/ui/Text.js";
import { attempt } from "../../lib/feedback.js";
import { useStore } from "../../lib/store.js";
import { account } from "../../stores/account.js";
import { events } from "../../stores/events.js";

/**
 * One event: its details, documents, people, sub-teams, and alerts. What's offered follows the
 * person's role in this event; the server checks every action again. It refreshes on its own
 * while open, so changes others make show up.
 */
export default function EventScreen() {
  useStore(events);
  useStore(account);
  const { id } = useLocalSearchParams();
  const eventId = typeof id === "string" ? id : "";
  const [tab, setTab] = useState("docs");
  const [refreshing, setRefreshing] = useState(false);
  const detail = events.detail?.event.id === eventId ? events.detail : null;

  useEffect(() => {
    if (!eventId || !account.ready) return;
    void attempt(() => events.open(eventId), "Could not open the event");
  }, [eventId, account.ready]);

  // Leaving the event stops its live refresh.
  useEffect(
    () => () => {
      if (events.selectedId === eventId) events.close();
    },
    [eventId],
  );

  async function refresh() {
    setRefreshing(true);
    await attempt(() => events.refresh(), "Could not refresh the event");
    setRefreshing(false);
  }

  if (!account.ready) {
    return (
      <Screen title="Event">
        <SignInPrompt what="this event" />
      </Screen>
    );
  }

  return (
    <Screen title="Event" onRefresh={detail ? refresh : undefined} refreshing={refreshing}>
      {detail ? (
        <View style={{ gap: 18 }}>
          <EventHeader onClosed={goBack} />
          <Tabs
            label="Event sections"
            value={tab}
            onChange={setTab}
            options={[
              { value: "docs", label: "Documents", count: detail.docs.length },
              { value: "people", label: "People", count: detail.members.length },
              { value: "subteams", label: "Sub-teams", count: detail.subteams.length },
              { value: "alerts", label: "Alerts" },
            ]}
          />
          {tab === "docs" ? <EventDocs /> : tab === "people" ? <EventPeople /> : tab === "subteams" ? <EventSubteams /> : <EventAlerts />}
        </View>
      ) : (
        <Text muted>Loading event…</Text>
      )}
    </Screen>
  );
}
