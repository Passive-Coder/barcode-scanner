import { useStore } from "../../lib/store.js";
import { dialogs } from "../../stores/dialogs.js";
import { Button } from "./Button.js";
import { Sheet } from "./Sheet.js";
import { Text } from "./Text.js";

/** The confirmation asked for with `dialogs.confirm(…)`. */
export function ConfirmDialog() {
  useStore(dialogs);
  const request = dialogs.confirmation;
  return (
    <Sheet
      visible={Boolean(request)}
      title={request?.title ?? ""}
      onClose={() => dialogs.settleConfirmation(false)}
      footer={
        <>
          {request?.notice ? null : <Button label="Cancel" onPress={() => dialogs.settleConfirmation(false)} />}
          <Button variant={request?.danger ? "danger" : "primary"} label={request?.confirmLabel ?? "Confirm"} onPress={() => dialogs.settleConfirmation(true)} />
        </>
      }
    >
      <Text>{request?.message ?? ""}</Text>
    </Sheet>
  );
}
