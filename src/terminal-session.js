import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export function mountTerminal({ host, token, instanceId, onStatus }) {
  if (!host || !token || !instanceId) return () => {};

  host.innerHTML = "";
  const terminal = new Terminal({
    cursorBlink: true,
    convertEol: true,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    fontSize: 13,
    theme: {
      background: "#0b1220",
      foreground: "#e5edf7",
      cursor: "#7dd3fc"
    }
  });
  const fit = new FitAddon();
  let disposed = false;
  let resizeHandler = null;
  let ws = null;

  terminal.loadAddon(fit);
  terminal.open(host);
  fit.fit();
  terminal.focus();
  onStatus?.("connecting");

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(
    `${protocol}://${window.location.host}/ws/terminal?token=${encodeURIComponent(token)}&instanceId=${encodeURIComponent(instanceId)}`
  );

  ws.addEventListener("open", () => {
    if (disposed) return;
    onStatus?.("connected");
    terminal.write("\r\n");
  });

  ws.addEventListener("message", (event) => {
    if (disposed) return;
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === "output") terminal.write(payload.data);
    } catch {
      terminal.write(String(event.data));
    }
  });

  ws.addEventListener("close", () => {
    if (disposed) return;
    onStatus?.("disconnected");
  });

  ws.addEventListener("error", () => {
    if (disposed) return;
    onStatus?.("error");
  });

  terminal.onData((data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "input", data }));
    }
  });

  resizeHandler = () => {
    fit.fit();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }));
    }
  };
  window.addEventListener("resize", resizeHandler);

  return () => {
    disposed = true;
    if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close();
    terminal.dispose();
  };
}
