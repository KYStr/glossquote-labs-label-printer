# 里程碑紀錄

2026-10-18：M0 及 M1 已獲主代理放行；M2 新增 production/source 工具鏈，待主代理獨立驗收。M3 部署及首頁僅主代理。此公開副本省略本機路徑、內部對話識別與帳戶資訊。requested gpt-6.1-sol/max；backend identity 未獨立確認。


後續 UI 驗收全面暫停：所有 browser/native/computer UI 呼叫均禁止，包括 hidden IAB、導航、截圖、輸入及 viewport；僅背景 CLI／檔案可繼續。不能以 hidden 推定不影響焦點。後續 UI 項目為 NOT_RUN_USER_FOCUS_INCIDENT，等待主代理重新明確放行。既有歷史實測保留，不關閉既有視窗、分頁或程序。


M2-R1: primary identified that the source inventory was in deployed assets but hidden by the HTTP model. Moved it to root dist-production-manifest.json; exact deployable asset enumeration and accidental-inventory rejection are regression-tested. 133 tests; no UI retest or deployment. Earlier commit remains history.

