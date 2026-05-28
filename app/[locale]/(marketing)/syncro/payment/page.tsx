import { SyncroGuardedRoute } from "@/components/syncro/SyncroGuardedRoute";
import { SyncroPaymentPage } from "@/components/syncro/SyncroPaymentPage";

export default function SyncroPaymentRoutePage() {
  return (
    <SyncroGuardedRoute>
      <SyncroPaymentPage />
    </SyncroGuardedRoute>
  );
}
