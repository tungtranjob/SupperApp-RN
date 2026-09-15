import React, { createContext, useContext } from 'react';

/** Những thứ component trong registry cần mà không đến từ JSON. */
export type SduiRuntime = {
  refreshing: boolean;
  refresh: () => void;
};

const Ctx = createContext<SduiRuntime>({ refreshing: false, refresh: () => {} });

export const SduiRuntimeProvider = Ctx.Provider;
export const useSduiRuntime = () => useContext(Ctx);
