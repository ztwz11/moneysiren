export type DesktopNotificationPermission = "granted" | "denied" | "prompt" | "unknown";

export interface DesktopNotificationRequest {
  title: string;
  body: string;
  clickPath: string;
}

export interface DesktopNotificationTransport {
  permission(): Promise<DesktopNotificationPermission>;
  requestPermission?(): Promise<DesktopNotificationPermission>;
  send(request: DesktopNotificationRequest): Promise<void>;
}
