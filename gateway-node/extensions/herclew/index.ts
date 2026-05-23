import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "herclew",
  name: "Herclew Core Agent",
  description: "Registers the Herclew Python reasoning core as a CLI backend.",
  register(api) {
    api.registerCliBackend({
      id: "herclew-agent",
      config: {
        command: "herclew",
        args: ["--non-interactive", "--model", "${model}"],
        env: {},
      },
      bundleMcp: true,
      bundleMcpMode: "claude-config-file",
    });
  },
});
