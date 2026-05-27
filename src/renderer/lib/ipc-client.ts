import type { IpcHandlerMap, IpcChannel } from '../../shared/ipc-types';

declare global {
  interface Window {
    api: {
      invoke: (channel: string, args?: unknown) => Promise<unknown>;
    };
  }
}

export async function invoke<C extends IpcChannel>(
  channel: C,
  ...args: IpcHandlerMap[C]['args'] extends void ? [] : [IpcHandlerMap[C]['args']]
): Promise<IpcHandlerMap[C]['result']> {
  return window.api.invoke(channel, args[0]) as Promise<IpcHandlerMap[C]['result']>;
}
