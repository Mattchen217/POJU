/** Shim — implementation lives in lib/device so Begin and POJU do not import the Syncro tree. */
export {
  getProductUsage,
  isFirstTimeFree,
  recordUsage,
  type SyncroProduct,
} from "@/lib/device/device-usage";
