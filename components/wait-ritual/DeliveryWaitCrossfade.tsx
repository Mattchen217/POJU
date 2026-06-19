"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { clsx } from "clsx";

import type { DeliveryWaitPhaseState } from "@/lib/wait-ritual/use-delivery-wait-phase";

import "@/styles/wait-ritual.css";

type Props = {
  wait: DeliveryWaitPhaseState;
  /** Wait layer still mounted (through exit animation). */
  showWait: boolean;
  /** Delivery layer mounted underneath during收束. */
  showDelivery: boolean;
  waitFrame: ReactNode;
  delivery: ReactNode;
};

/** Stack wait + delivery for crossfade during finishing → converge → exit. */
export function DeliveryWaitCrossfade({ wait, showWait, showDelivery, waitFrame, delivery }: Props) {
  const deliveryEnter =
    wait.phase === "converge" || wait.phase === "exit" || wait.exiting;
  const [deliveryVisible, setDeliveryVisible] = useState(false);

  useEffect(() => {
    if (deliveryEnter) setDeliveryVisible(true);
  }, [deliveryEnter]);

  return (
    <div className="delivery-wait-crossfade">
      {showDelivery ? (
        <div
          className={clsx(
            "delivery-wait-crossfade__delivery",
            deliveryVisible && "delivery-wait-crossfade__delivery--enter",
          )}
        >
          {delivery}
        </div>
      ) : null}
      {showWait ? (
        <div
          className={clsx(
            "delivery-wait-crossfade__wait",
            wait.exiting && "delivery-wait-crossfade__wait--exit",
          )}
        >
          {waitFrame}
        </div>
      ) : null}
    </div>
  );
}
