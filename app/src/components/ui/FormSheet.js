import { useEffect, useState } from "react";
import { errorMessage } from "../../lib/format.js";
import { useStore } from "../../lib/store.js";
import { colors } from "../../lib/theme.js";
import { dialogs } from "../../stores/dialogs.js";
import { Button } from "./Button.js";
import { Sheet } from "./Sheet.js";
import { Text } from "./Text.js";
import { TextField } from "./TextField.js";

/** The small form asked for with `dialogs.edit(…)`: renaming, creating, editing a row. */
export function FormSheet() {
  useStore(dialogs);
  const request = dialogs.form;
  const [values, setValues] = useState(/** @type {string[]} */ ([]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Each request starts from its own values.
  useEffect(() => {
    setValues(request ? request.fields.map((field) => field.value ?? "") : []);
    setError("");
    setBusy(false);
  }, [request]);

  async function submit() {
    if (!request || busy) return;
    setBusy(true);
    setError("");
    try {
      await request.onSubmit(values);
      dialogs.settleForm(true);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={Boolean(request)}
      title={request?.title ?? ""}
      onClose={() => dialogs.settleForm(false)}
      dismissible={!busy}
      footer={
        <>
          <Button label="Cancel" disabled={busy} onPress={() => dialogs.settleForm(false)} />
          <Button variant="primary" busy={busy} label={busy ? "Saving…" : (request?.submitLabel ?? "Save changes")} onPress={submit} />
        </>
      }
    >
      {request?.description ? <Text muted>{request.description}</Text> : null}
      {request?.fields.map((field, index) => (
        <TextField
          key={`${request.title}-${index}`}
          label={field.label}
          value={values[index] ?? ""}
          placeholder={field.placeholder}
          multiline={field.multiline}
          keyboardType={field.keyboard ?? "default"}
          autoCapitalize={field.keyboard === "email-address" || field.keyboard === "url" ? "none" : "sentences"}
          autoFocus={index === 0}
          editable={!busy}
          returnKeyType={index === request.fields.length - 1 && !field.multiline ? "done" : "next"}
          onSubmitEditing={index === request.fields.length - 1 && !field.multiline ? submit : undefined}
          onChangeText={(text) => setValues((current) => current.map((value, position) => (position === index ? text : value)))}
        />
      ))}
      {error ? (
        <Text weight="semibold" color={colors.danger} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}
