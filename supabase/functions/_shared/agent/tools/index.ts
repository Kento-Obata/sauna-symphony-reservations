// AI が使える道具の一覧。分野ごとのファイルから集める。

import type { AgentTool } from "../types.ts";
import { availabilityTools } from "./availability.ts";
import { businessTools } from "./business.ts";
import { herbTools } from "./herbs.ts";
import { overviewTools } from "./overview.ts";
import { reservationTools } from "./reservations.ts";
import { shiftTools } from "./shifts.ts";
import { staffTools } from "./staff.ts";
import { workTools } from "./work.ts";

export const agentTools: AgentTool[] = [
  ...overviewTools,
  ...reservationTools,
  ...availabilityTools,
  ...shiftTools,
  ...staffTools,
  ...workTools,
  ...herbTools,
  ...businessTools,
];
