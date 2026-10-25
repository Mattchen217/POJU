import type { Application } from "@splinetool/runtime";

import { applySplineZoom } from "@/lib/spline/apply-spline-zoom";
import {
  MATCH_HOW_WORKS_SPLINE_CONTENT_OFFSET_X,
  MATCH_HOW_WORKS_SPLINE_CONTENT_OFFSET_Y,
  MATCH_HOW_WORKS_SPLINE_RADIUS_FACTOR,
  MATCH_HOW_WORKS_SPLINE_ZOOM,
} from "@/lib/match/match-spline-scene";

/** Original positions by object uuid — avoids double-shift when getAllObjects returns new refs. */
const contentBaseByApp = new WeakMap<Application, Map<string, { x: number; y: number; z: number }>>();
const contentOffsetApplied = new WeakSet<Application>();

/** Shift exported scene objects — Red/green balls has no usable orbit camera pan. */
function applyHowWorksContentOffset(app: Application, offsetX: number, offsetY: number): boolean {
  const objects = app.getAllObjects();
  if (objects.length === 0) return false;

  let bases = contentBaseByApp.get(app);
  if (!bases) {
    bases = new Map();
    contentBaseByApp.set(app, bases);
  }

  let shifted = 0;

  for (const obj of objects) {
    if (!obj.position || !obj.uuid) continue;

    let base = bases.get(obj.uuid);
    if (!base) {
      base = { x: obj.position.x, y: obj.position.y, z: obj.position.z };
      bases.set(obj.uuid, base);
    }

    obj.position.x = base.x + offsetX;
    obj.position.y = base.y + offsetY;
    obj.position.z = base.z;
    shifted += 1;
  }

  return shifted > 0;
}

/** How Match works — zoom + translate scene content (not Match orbit camera helpers). */
export function configureMatchHowWorksSplineFraming(app: Application): void {
  const effectiveZoom = MATCH_HOW_WORKS_SPLINE_ZOOM / Math.max(MATCH_HOW_WORKS_SPLINE_RADIUS_FACTOR, 1);

  const apply = () => {
    try {
      applySplineZoom(app, effectiveZoom);
    } catch {
      // optional
    }

    if (!contentOffsetApplied.has(app)) {
      try {
        if (
          applyHowWorksContentOffset(
            app,
            MATCH_HOW_WORKS_SPLINE_CONTENT_OFFSET_X,
            MATCH_HOW_WORKS_SPLINE_CONTENT_OFFSET_Y,
          )
        ) {
          contentOffsetApplied.add(app);
        }
      } catch {
        // optional — do not crash the page if a particle object rejects position writes
      }
    }

    try {
      app.setBackgroundColor("transparent");
      app.requestRender();
    } catch {
      // optional
    }
  };

  apply();
  requestAnimationFrame(apply);
  for (const delay of [120, 400, 800, 1500, 2500, 4000, 6000]) {
    window.setTimeout(apply, delay);
  }
}
