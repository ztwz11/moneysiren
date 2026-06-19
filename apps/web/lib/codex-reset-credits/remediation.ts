import type { ResetCreditErrorCode } from "./types";

export interface ResetCreditErrorRemediation {
  title: string;
  cause: string;
  actions: readonly string[];
}

export function resetCreditErrorRemediation(code: ResetCreditErrorCode): ResetCreditErrorRemediation {
  switch (code) {
    case "LOCAL_CODEX_AUTH_UNAVAILABLE":
      return {
        title: text("\ub85c\uceec Codex \uc778\uc99d\uc744 \uc77d\uc744 \uc218 \uc5c6\uc74c"),
        cause: text("Codex\uac00 \ub85c\uadf8\uc778\ub41c \uac19\uc740 PC\uc758 Node.js \ud658\uacbd\uc774 \uc544\ub2d9\ub2c8\ub2e4."),
        actions: [
          text("MoneySiren\uc744 Codex\uac00 \uc124\uce58\ub418\uace0 \ub85c\uadf8\uc778\ub41c \uac19\uc740 PC\uc5d0\uc11c \uc2e4\ud589\ud558\uc138\uc694."),
          text("Vercel, GitHub Actions \uac19\uc740 \uc6d0\uaca9 \ud658\uacbd\uc5d0 auth.json\uc744 \uc5c5\ub85c\ub4dc\ud558\uc9c0 \ub9c8\uc138\uc694."),
        ],
      };
    case "AUTH_FILE_NOT_FOUND":
      return {
        title: text("Codex \uc778\uc99d \ud30c\uc77c \uc5c6\uc74c"),
        cause: text("CODEX_AUTH_FILE, CODEX_HOME/auth.json, ~/.codex/auth.json \uc911 \uc77d\uc744 \uc218 \uc788\ub294 \uc778\uc99d \ud30c\uc77c\uc774 \uc5c6\uc2b5\ub2c8\ub2e4."),
        actions: [
          text("\ud130\ubbf8\ub110\uc5d0\uc11c codex login\uc744 \uc2e4\ud589\ud55c \ub4a4 \ub2e4\uc2dc \uc870\ud68c\ud558\uc138\uc694."),
          text("Codex \ud648 \uacbd\ub85c\ub97c \ubc14\uafd4 \uc4f4\ub2e4\uba74 CODEX_HOME \ub610\ub294 CODEX_AUTH_FILE \uac12\uc744 \ud655\uc778\ud558\uc138\uc694."),
        ],
      };
    case "AUTH_FILE_PERMISSION_DENIED":
      return {
        title: text("Codex \uc778\uc99d \ud30c\uc77c \uad8c\ud55c \uc624\ub958"),
        cause: text("MoneySiren Node.js \ud504\ub85c\uc138\uc2a4\uac00 Codex auth.json\uc744 \uc77d\uc744 \uad8c\ud55c\uc774 \uc5c6\uc2b5\ub2c8\ub2e4."),
        actions: [
          text("Codex\ub97c \ub85c\uadf8\uc778\ud55c \uac19\uc740 OS \uc0ac\uc6a9\uc790\ub85c MoneySiren\uc744 \uc2e4\ud589\ud558\uc138\uc694."),
          text("CODEX_AUTH_FILE\uc744 \uc9c0\uc815\ud588\ub2e4\uba74 \ud574\ub2f9 \ud30c\uc77c\uc758 \uc77d\uae30 \uad8c\ud55c\uc744 \ud655\uc778\ud558\uc138\uc694."),
        ],
      };
    case "AUTH_FILE_INVALID_JSON":
      return {
        title: text("Codex \uc778\uc99d \ud30c\uc77c JSON \uc624\ub958"),
        cause: text("auth.json\uc774 \uc190\uc0c1\ub418\uc5c8\uac70\ub098 \uc608\uc0c1\ud55c JSON \ud615\uc2dd\uc774 \uc544\ub2d9\ub2c8\ub2e4."),
        actions: [
          text("auth.json\uc744 \uc218\ub3d9 \ud3b8\uc9d1\ud558\uc9c0 \ub9d0\uace0 codex login\uc73c\ub85c \ub2e4\uc2dc \ub85c\uadf8\uc778\ud558\uc138\uc694."),
          text("\ud544\uc694\ud558\uba74 \uae30\uc874 auth.json\uc744 \ubc31\uc5c5\ud55c \ub4a4 Codex \ub85c\uadf8\uc778\uc744 \ub2e4\uc2dc \uc2e4\ud589\ud558\uc138\uc694."),
        ],
      };
    case "ACCESS_TOKEN_NOT_FOUND":
      return {
        title: text("access token \uc5c6\uc74c"),
        cause: text("Codex auth.json\uc5d0\uc11c \uc9c0\uc6d0\ud558\ub294 access token \ud544\ub4dc\ub97c \ucc3e\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4."),
        actions: [
          text("codex login\uc744 \ub2e4\uc2dc \uc2e4\ud589\ud574 \uc0c8 \uc778\uc99d \ud30c\uc77c\uc744 \ub9cc\ub4dc\uc138\uc694."),
          text("\uc124\uce58\ub41c Codex \ubc84\uc804\uc774 \ub108\ubb34 \uc624\ub798\ub410\ub2e4\uba74 \uc5c5\ub370\uc774\ud2b8\ud55c \ub4a4 \ub2e4\uc2dc \uc2dc\ub3c4\ud558\uc138\uc694."),
        ],
      };
    case "ACCOUNT_ID_NOT_FOUND":
      return {
        title: text("account ID \uc5c6\uc74c"),
        cause: text("Codex auth.json\uc5d0\uc11c \uc694\uccad\uc5d0 \ud544\uc694\ud55c account ID\ub97c \ucc3e\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4."),
        actions: [
          text("codex login\uc744 \ub2e4\uc2dc \uc2e4\ud589\ud558\uace0 \uc62c\ubc14\ub978 ChatGPT/Codex \uacc4\uc815\uc744 \uc120\ud0dd\ud558\uc138\uc694."),
          text("Codex App\uacfc CLI\uac00 \ub2e4\ub978 \uacc4\uc815\uc744 \uc4f0\uace0 \uc788\uc9c0 \uc54a\uc740\uc9c0 \ud655\uc778\ud558\uc138\uc694."),
        ],
      };
    case "UPSTREAM_UNAUTHORIZED":
      return {
        title: text("Codex \ub85c\uadf8\uc778 \ub9cc\ub8cc \uac00\ub2a5\uc131"),
        cause: text("ChatGPT \ub0b4\ubd80 API\uac00 \ud604\uc7ac Codex \ud1a0\ud070\uc744 \uc778\uc99d\ud558\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4."),
        actions: [
          text("\ud130\ubbf8\ub110\uc5d0\uc11c codex login\uc744 \uc2e4\ud589\ud55c \ud6c4 \ub2e4\uc2dc \uc870\ud68c\ud558\uc138\uc694."),
          text("\uc5ec\ub7ec \uacc4\uc815\uc744 \uc0ac\uc6a9\ud55c\ub2e4\uba74 \ucd08\uae30\ud654\uad8c\uc774 \uc788\ub294 \uacc4\uc815\uc73c\ub85c \ub85c\uadf8\uc778\ub418\uc5c8\ub294\uc9c0 \ud655\uc778\ud558\uc138\uc694."),
        ],
      };
    case "UPSTREAM_FORBIDDEN":
      return {
        title: text("API \uc811\uadfc \uad8c\ud55c \uc5c6\uc74c"),
        cause: text("\ud604\uc7ac \uacc4\uc815 \ub610\ub294 \ud1a0\ud070\uc774 \ucd08\uae30\ud654\uad8c API\uc5d0 \uc811\uadfc\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4."),
        actions: [
          text("Codex\uc640 ChatGPT\uc5d0 \ub85c\uadf8\uc778\ub41c \uacc4\uc815\uc774 \uc77c\uce58\ud558\ub294\uc9c0 \ud655\uc778\ud558\uc138\uc694."),
          text("\uc870\ud68c \uad8c\ud55c\uc774 \uc5c6\ub294 \uacc4\uc815\uc774\uba74 \ud574\ub2f9 \uacc4\uc815\uc758 Codex \uc0ac\uc6a9\uad8c\uc744 \ud655\uc778\ud558\uc138\uc694."),
        ],
      };
    case "UPSTREAM_RATE_LIMITED":
      return {
        title: text("ChatGPT API \uc694\uccad \ud55c\ub3c4"),
        cause: text("\uc9e7\uc740 \uc2dc\uac04\uc5d0 \ub108\ubb34 \ub9ce\uc740 \uc870\ud68c\ub97c \uc2dc\ub3c4\ud588\uc2b5\ub2c8\ub2e4."),
        actions: [
          text("\uba87 \ubd84 \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud558\uace0 \uc218\ub3d9 \uc0c8\ub85c\uace0\uce68\uc744 \uc904\uc774\uc138\uc694."),
          text("cron \uc8fc\uae30\ub97c \ub108\ubb34 \uc9e7\uac8c \uc124\uc815\ud588\ub2e4\uba74 30\ubd84 \uc774\uc0c1\uc73c\ub85c \ub298\ub9ac\uc138\uc694."),
        ],
      };
    case "UPSTREAM_UNAVAILABLE":
      return {
        title: text("ChatGPT \ub0b4\ubd80 API \uc0ac\uc6a9 \ubd88\uac00"),
        cause: text("\ub124\ud2b8\uc6cc\ud06c \uc624\ub958, ChatGPT \uc11c\ube44\uc2a4 \uc7a5\uc560, \ub610\ub294 \ube44\uacf5\uc2dd endpoint \ubcc0\uacbd \uac00\ub2a5\uc131\uc774 \uc788\uc2b5\ub2c8\ub2e4."),
        actions: [
          text("\uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc870\ud68c\ud558\uc138\uc694."),
          text("endpoint\uac00 \ubc14\ub00c \uac83\uc73c\ub85c \uc758\uc2ec\ub418\uba74 CODEX_RESET_CREDIT_ENDPOINT \uac12\uc744 \ud655\uc778\ud558\uc138\uc694."),
        ],
      };
    case "UPSTREAM_TIMEOUT":
      return {
        title: text("API \uc694\uccad \uc2dc\uac04 \ucd08\uacfc"),
        cause: text("ChatGPT \ub0b4\ubd80 API\uac00 \uc124\uc815\ub41c \uc2dc\uac04 \uc548\uc5d0 \uc751\ub2f5\ud558\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4."),
        actions: [
          text("\ub124\ud2b8\uc6cc\ud06c \uc0c1\ud0dc\ub97c \ud655\uc778\ud558\uace0 \ub2e4\uc2dc \uc2dc\ub3c4\ud558\uc138\uc694."),
          text("\ud544\uc694\ud558\uba74 CODEX_API_TIMEOUT_MS\ub97c 15000\ubcf4\ub2e4 \ud070 \uac12\uc73c\ub85c \ub298\ub9ac\uc138\uc694."),
        ],
      };
    case "UPSTREAM_INVALID_JSON":
      return {
        title: text("API JSON \ud30c\uc2f1 \uc2e4\ud328"),
        cause: text("ChatGPT \ub0b4\ubd80 API\uac00 JSON\uc774 \uc544\ub2cc \uc751\ub2f5\uc744 \ubcf4\ub0c8\uc2b5\ub2c8\ub2e4."),
        actions: [
          text("\uba87 \ubd84 \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud558\uc138\uc694."),
          text("\uacc4\uc18d \ubc1c\uc0dd\ud558\uba74 \ube44\uacf5\uc2dd API endpoint \ubcc0\uacbd \uac00\ub2a5\uc131\uc774 \uc788\uc73c\ubbc0\ub85c MoneySiren \uc5c5\ub370\uc774\ud2b8\uac00 \ud544\uc694\ud569\ub2c8\ub2e4."),
        ],
      };
    case "UPSTREAM_INVALID_RESPONSE":
      return {
        title: text("API \uc751\ub2f5 \uad6c\uc870 \ubcc0\uacbd \uac00\ub2a5\uc131"),
        cause: text("ChatGPT \ub0b4\ubd80 API \uc751\ub2f5\uc5d0\uc11c \ucd08\uae30\ud654\uad8c \uac1c\uc218\ub098 \ub9cc\ub8cc \ud544\ub4dc\ub97c \ucc3e\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4."),
        actions: [
          text("\ud604\uc7ac Codex \uacc4\uc815\uc5d0 \ucd08\uae30\ud654\uad8c\uc774 \uc788\ub294\uc9c0 Codex UI\uc5d0\uc11c \uba3c\uc800 \ud655\uc778\ud558\uc138\uc694."),
          text("\uc751\ub2f5 \uad6c\uc870\uac00 \ubc14\ub010 \uc218 \uc788\uc73c\ubbc0\ub85c MoneySiren \uc5c5\ub370\uc774\ud2b8 \ub610\ub294 normalize \ub85c\uc9c1 \uc218\uc815\uc774 \ud544\uc694\ud569\ub2c8\ub2e4."),
        ],
      };
    case "API_UNAUTHORIZED":
      return {
        title: text("MoneySiren API \uc778\uc99d \uc2e4\ud328"),
        cause: text("RESET_CREDIT_API_KEY\uac00 \uc124\uc815\ub41c \uc0c1\ud0dc\uc5d0\uc11c \uc62c\ubc14\ub978 Bearer \ud5e4\ub354\uac00 \uc5c6\uc2b5\ub2c8\ub2e4."),
        actions: [
          text("\uc2a4\ud06c\ub9bd\ud2b8\uc5d0\uc11c \ud638\ucd9c\ud55c\ub2e4\uba74 Authorization: Bearer <RESET_CREDIT_API_KEY> \ud5e4\ub354\ub97c \ucd94\uac00\ud558\uc138\uc694."),
          text("\ube0c\ub77c\uc6b0\uc800 \ub85c\uceec \ub300\uc2dc\ubcf4\ub4dc\uc5d0\uc11c \uc0ac\uc6a9\ud560 \uacbd\uc6b0 127.0.0.1\uc5d0\ub9cc \ubc14\uc778\ub529\ud558\uace0 RESET_CREDIT_API_KEY\ub97c \ube44\uc6cc\ub450\uc138\uc694."),
        ],
      };
    case "CRON_SECRET_NOT_CONFIGURED":
      return {
        title: text("cron secret \ubbf8\uc124\uc815"),
        cause: text("POST /api/cron/codex-reset-credits\ub294 CRON_SECRET\uc774 \ubc18\ub4dc\uc2dc \ud544\uc694\ud569\ub2c8\ub2e4."),
        actions: [
          text("CRON_SECRET \ud658\uacbd\ubcc0\uc218\ub97c \uc124\uc815\ud55c \ub4a4 \uc11c\ubc84\ub97c \ub2e4\uc2dc \uc2e4\ud589\ud558\uc138\uc694."),
          text("cron \ud638\ucd9c\uc5d0 Authorization: Bearer <CRON_SECRET> \ud5e4\ub354\ub97c \ucd94\uac00\ud558\uc138\uc694."),
        ],
      };
  }
}

function text(value: string): string {
  return value;
}
