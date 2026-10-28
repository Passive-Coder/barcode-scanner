import { useEffect, useState } from "react";
import { AlertList } from "../components/alerts/AlertList.js";
import { NotificationToggle } from "../components/alerts/NotificationToggle.js";
import { Screen } from "../components/ui/Screen.js";
import { alerts } from "../stores/alerts.js";

/** Alerts sent to you in the last week, across your events, and this phone's notifications. */
export default function Alerts() {
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void alerts.poll();
  }, []);

  async function refresh() {
    setRefreshing(true);
    await alerts.poll();
    setRefreshing(false);
  }

  return (
    <Screen title="Alerts" onRefresh={refresh} refreshing={refreshing}>
      <NotificationToggle />
      <AlertList />
    </Screen>
  );
}
