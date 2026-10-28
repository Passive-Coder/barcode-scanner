import { useStore } from "../../lib/store.js";
import { auth } from "../../stores/auth.js";
import { workspace } from "../../stores/workspace.js";
import { Card } from "../ui/Card.js";
import { Text } from "../ui/Text.js";

/** Explains why editing is off when Google gave this account view-only access. */
export function ViewOnlyNotice() {
  useStore(workspace);
  if (!workspace.readOnly) return null;
  return (
    <Card tone="danger">
      <Text weight="semibold">Editor access is needed to make changes</Text>
      <Text muted>{`${auth.email || "This Google account"} can view this spreadsheet, but Google hasn't given it edit access. Ask the owner to share it with you as an Editor.`}</Text>
    </Card>
  );
}
