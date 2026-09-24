"use client";

import { useCallback, useEffect, useState } from "react";

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramWebAppInitData {
  user?: TelegramWebAppUser;
  query_id?: string;
  auth_date?: number;
  hash?: string;
}

export interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  initDataUnsafe?: TelegramWebAppInitData;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

function readTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

export function useTelegram() {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);

  useEffect(() => {
    setWebApp(readTelegramWebApp());
  }, []);

  const user = webApp?.initDataUnsafe?.user;

  const ready = useCallback(() => {
    webApp?.ready();
  }, [webApp]);

  const expand = useCallback(() => {
    webApp?.expand();
  }, [webApp]);

  return { webApp, user, ready, expand };
}
