import { supabase } from "./supabase.ts";
import type { PanelRow } from "./types.ts";

/**
 * コマの状態が変わるたびに呼ばれる購読。
 *
 * これがあるので、全部そろうのを待たずに「できたコマから順に」表示できます。
 * ポーリングは要りません。
 *
 * A担当に、この1行を実行してもらうのを忘れないこと：
 *   alter publication supabase_realtime add table panels;
 *
 * 返り値を呼ぶと購読を解除します（画面を離れるときに必ず呼ぶ）。
 */
export function subscribePanels(
  tripId: string,
  handlers: {
    onChange?: (panel: PanelRow) => void;
    onDone?: (panel: PanelRow) => void;
    onFailed?: (panel: PanelRow) => void;
  },
): () => void {
  const channel = supabase
    .channel(`panels-${tripId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "panels",
        // panels に trip_id を持たせているのは、このフィルタのためです。
        // Realtime のフィルタは他のテーブルを跨げません。
        filter: `trip_id=eq.${tripId}`,
      },
      (payload) => {
        const panel = payload.new as PanelRow;
        if (!panel) return;
        handlers.onChange?.(panel);
        if (panel.status === "done") handlers.onDone?.(panel);
        if (panel.status === "failed") handlers.onFailed?.(panel);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
