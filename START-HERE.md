# 開始：物品標籤列印

先讀 AGENTS.md、HANDOFF.md 及六份規格。M2 production/source 候選等待主代理驗收；沒有此功能對話的 live 部署。Node >=24、ESM、零套件。執行 npm test、npm run check、npm run build、npm run build:production、npm run check:production、npm run release:check。preview 4210 與 production HTTP model 5210 僅 loopback；build 目錄分離。不得為測試觸發原生列印或其他系統對話框；只用專用隱藏瀏覽器。所有人工 NOT_RUN 見 HANDOFF。六規格的 M0 狀態文字保留為歷史，不改規格來遷就實作。


後續 UI 驗收全面暫停：所有 browser/native/computer UI 呼叫均禁止，包括 hidden IAB、導航、截圖、輸入及 viewport；僅背景 CLI／檔案可繼續。不能以 hidden 推定不影響焦點。後續 UI 項目為 NOT_RUN_USER_FOCUS_INCIDENT，等待主代理重新明確放行。既有歷史實測保留，不關閉既有視窗、分頁或程序。

