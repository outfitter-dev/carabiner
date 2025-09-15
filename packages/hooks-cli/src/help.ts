export type CommandDef = {
  name: string;
  summary: string;
  usage?: string[];
};

export const COMMANDS: CommandDef[] = [
  {
    name: "run",
    summary: "Run a hook by name (default)",
    usage: ["carabiner <hook-name>", "carabiner bash-command-validator"],
  },
  { name: "list", summary: "List available hooks", usage: ["carabiner list"] },
  {
    name: "init",
    summary: "Initialize .carabiner directory",
    usage: ["carabiner init"],
  },
  {
    name: "add",
    summary: "Install a hook (registry, npm, or GitHub)",
    usage: [
      "carabiner add bash-command-validator",
      "carabiner add @carabiner/hook-bash-command-validator",
      "carabiner add https://github.com/user/hook",
      "carabiner add <hook> --global",
      "carabiner add <hook> --no-deps",
    ],
  },
  {
    name: "browse",
    summary: "Interactive browser for discovering hooks",
    usage: [
      "carabiner browse",
      "carabiner search <query>",
      "carabiner info <hook>",
    ],
  },
  {
    name: "publish",
    summary: "Validate and publish a hook",
    usage: [
      "carabiner publish ./my-hook",
      "carabiner publish --npm",
      "carabiner publish --github",
    ],
  },
  {
    name: "--version",
    summary: "Show version",
    usage: ["carabiner --version"],
  },
  { name: "--help", summary: "Show help", usage: ["carabiner --help"] },
];

export function renderHelp(): string {
  const header = [
    "Carabiner - Claude Code Hook Manager",
    "",
    "Usage:",
    "  carabiner <hook-name>           Run a hook by name",
    "  carabiner [command]             Run a specific command",
    "",
    "Commands:",
  ];

  const cmds = COMMANDS.map((c) => `  ${c.name.padEnd(12)} ${c.summary}`).join(
    "\n"
  );

  const examples = [
    "",
    "Examples:",
    "  carabiner bash-command-validator",
    "  carabiner add bash-command-validator",
    "  carabiner browse",
    "  carabiner publish --npm",
  ];

  return `\n${[...header, cmds, ...examples].join("\n")}\n`;
}
