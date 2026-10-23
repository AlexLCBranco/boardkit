import { LinkPrompt } from "../../components/LinkPrompt";
import { useBoard, useBoardApi } from "../../store/boardContext";
import { useLinkPromptStore } from "../../store/linkPromptStore";
import { useActiveBoardName } from "../../store/selectors";
import { headingOf, setUrlOf, urlOf } from "./links";

/** The open link field, if any, for the board in context. Drawn once per
    board view (Boardkit's page, a board being edited on the whiteboard). */
export function LinkPromptHost() {
  const target = useLinkPromptStore((s) => s.target);
  const at = useLinkPromptStore((s) => s.at);
  const close = useLinkPromptStore((s) => s.close);
  const api = useBoardApi();
  const heading = useBoard((state) => (target ? headingOf(state, target) : ""));
  const boardName = useActiveBoardName();
  if (!target) return null;
  return (
    <LinkPrompt
      // A new field for each target, so its text starts from that one's link.
      key={JSON.stringify(target)}
      x={at.x}
      y={at.y}
      heading={target.kind === "board" ? `Link for board “${boardName}”` : heading}
      initial={urlOf(api.getState(), target) ?? ""}
      onSave={(url) => {
        close();
        if (url !== urlOf(api.getState(), target)) setUrlOf(api.getState(), target, url);
      }}
      onCancel={close}
    />
  );
}
