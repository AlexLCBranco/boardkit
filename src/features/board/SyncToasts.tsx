import { useEffect } from "react";
import { toast } from "sonner";

import { useSyncNotice } from "../../store/syncNoticeStore";

/**
 * Says what another tab's save did to this one, as a toast: an item both
 * tabs changed, where the other tab's version was kept, an undo refused
 * because its item was changed there since, or the open board deleted there. A toast rather than a banner: nothing is wrong and nothing
 * needs answering, the user just shouldn't wonder where their change went.
 */
export function SyncToasts() {
  const message = useSyncNotice((state) => state.message);
  useEffect(() => {
    if (message) toast(message.text);
  }, [message]);
  return null;
}
