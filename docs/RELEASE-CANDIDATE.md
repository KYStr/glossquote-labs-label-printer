# M2 來源候選

M1 已放行，M2 等待主代理驗收。131 項離線／loopback 測試，test/check/build/build:production/check:production/release:check；實際結果另交主代理。預覽與 production 分離，固定 manifest 各含 bytes/SHA-256，自身排除。static-assets-only 設定僅供主代理部署，這裡沒有呼叫 Cloudflare。

原生列印預覽、四版型實體紙張尺寸、完整 Network/Storage、真機／低階裝置、原生 200% 縮放、斷線／停用 JS、persisted BFCache、screen reader 與系統 reduced-motion 偏好均有 NOT_RUN 限制。實際 back 返回空白已觀察；不冒稱已證明 persisted BFCache。

來源公開不代表已部署或外部驗收完成，版本不標 complete。


後續 UI 驗收全面暫停：所有 browser/native/computer UI 呼叫均禁止，包括 hidden IAB、導航、截圖、輸入及 viewport；僅背景 CLI／檔案可繼續。不能以 hidden 推定不影響焦點。後續 UI 項目為 NOT_RUN_USER_FOCUS_INCIDENT，等待主代理重新明確放行。既有歷史實測保留，不關閉既有視窗、分頁或程序。

