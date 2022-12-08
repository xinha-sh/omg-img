import { ApiStack } from "./ApiStack.js";
import { App } from "sst/constructs";
import { StorageStack } from "./StorageStack.js";

export default function(app: App) {
  app.setDefaultFunctionProps({
    runtime: "nodejs16.x",
  });
  app.stack(ApiStack);
  app.stack(StorageStack);
}
