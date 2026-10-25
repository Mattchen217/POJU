export const SYNCRO_MATRIX_PATCH_EVENT = "syncro-matrix-patch";

export type SyncroMatrixPatchDetail = {
  session_id: string;
  batch_index: number;
  batch_total: number;
  updated_keys: string[];
};

export function dispatchSyncroMatrixPatch(detail: SyncroMatrixPatchDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SYNCRO_MATRIX_PATCH_EVENT, { detail }));
}
