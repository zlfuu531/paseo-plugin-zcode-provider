This community fork connects Paseo to ZCode models, tools and conversations.
It includes ZCode 3.18 account compatibility and recovery of conversations
whose saved model is no longer available.

Setup requires Paseo 0.15.0 or later. The Runtime tab installs a separate,
checksum-verified Node.js and an unofficial build of the public ZCode source
only after you start setup. Existing ZCode Desktop and CLI installations are
not replaced. The Account tab uses ZCode's official services and shares
accounts and model-provider settings with Desktop and the CLI on that host.

Backend code runs with the daemon user's permissions. Prompts, files and tool
results can be sent to the selected model provider. Free-plan models depend
on the account's current server-side entitlements and activation time.
Computer Use, Browser Use and Visualize remain unavailable in this provider.
The fork is not endorsed or maintained by ZCode or Z.ai.
