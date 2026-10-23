/** Ink TUI entry point — terminal interface */
import React from "react";
import { render } from "ink";
import { App } from "./ui/app";

const app = render(React.createElement(App), { exitOnCtrlC: false });
await app.waitUntilExit();
