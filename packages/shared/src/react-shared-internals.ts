import * as React from "react";
import type { SharedStateClient } from "react/react-shared-internals-client";

const ReactSharedInternals =
  React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

export default ReactSharedInternals as SharedStateClient;
