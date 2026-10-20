// Linework's service worker. It only delivers alerts: it shows push notifications (even
// when Linework is closed) and opens Linework when one is tapped. It doesn't cache pages.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  /** @type {{ id?: string, eventName?: string, title?: string, body?: string, urgency?: string, sender?: string }} */
  let alert = {};
  try {
    alert = event.data ? event.data.json() : {};
  } catch {
    alert = { title: event.data ? event.data.text() : "" };
  }
  const page = alert.urgency === "page";
  const from = [alert.sender, alert.eventName].filter(Boolean).join(" · ");

  event.waitUntil(
    (async () => {
      // Open Linework pages show the alert straight away (a page fills the screen).
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) client.postMessage({ type: "linework-alert", id: alert.id });
      await self.registration.showNotification(alert.title || "Linework alert", {
        body: [alert.body, from].filter(Boolean).join("\n"),
        tag: alert.id ? `alert-${alert.id}` : undefined,
        renotify: Boolean(alert.id),
        requireInteraction: page,
        vibrate: page ? [400, 160, 400, 160, 400] : [120],
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        data: { id: alert.id },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const id = event.notification.data?.id;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        open.postMessage({ type: "linework-alert-open", id });
        return;
      }
      await self.clients.openWindow(id ? `/#alert=${encodeURIComponent(id)}` : "/");
    })(),
  );
});
