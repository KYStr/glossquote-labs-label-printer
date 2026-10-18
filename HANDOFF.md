# 物品標籤列印來源候選

M2 production 工具鏈及 public source 候選；等待主代理獨立驗收。來源發布目標 https://github.com/KYStr/glossquote-labs-label-printer 。本功能對話沒有部署或修改首頁；labels.glossquote.com 是核准的部署目標，不是此來源交付的 live 驗收結果。

Node >=24，ESM／built-ins，零套件，無 npm install。M1 已由主代理放行；M2 新增固定 SEO、可見 FAQ 對應的 WebApplication/FAQPage JSON-LD、精確 script hash CSP、Cloudflare 合併標頭模型、robots 最長匹配、sitemap、404 及 static-assets-only wrangler.jsonc。public/ 十檔及六份規格保持 M1 bytes；只產生獨立 dist-production/，preview 仍 noindex。

驗收命令：npm test（131 tests）、npm run check、npm run build、npm run build:production、npm run check:production、npm run release:check。npm run dev 為 127.0.0.1:4210；npm run preview:production 為 127.0.0.1:5210，後者只是 HTTP 模型，不代表 Cloudflare 部署。測試序列化執行，避免安全測試的暫存 fixture 彼此碰撞。

固定 manifest 在各 build 目錄，含逐檔 bytes/SHA-256，排除自身。Git archive 的 commit 與 GitHub branch 為公開來源識別；內部環境、來源 ZIP、guard 及測試證據由主代理另存，不打包帳戶資訊或工作區證據。

原生列印預覽、四版型實體紙張尺寸、完整 Network/Storage、真機／低階裝置、原生 200% 縮放、斷線／停用 JS、persisted BFCache、screen reader 與系統 reduced-motion 偏好均有 NOT_RUN 限制。實際 back 返回空白已觀察；不冒稱已證明 persisted BFCache。

後續 UI 測試只用專用隔離隱藏瀏覽器分頁，不操作桌面／OS／剪貼簿、既有分頁或原生系統對話框。限制前的一次真實 print click 逾時紀錄保留於內部交接，未以 mock 取代。

README／PRODUCT／TECHNICAL／UX-SEO／ACCEPTANCE／TASKS 保留原始規格文字，舊 M0 狀態不代表目前來源缺少實作；本交接及 START-HERE 是目前里程碑入口。requested gpt-6.1-sol/max；實際 backend identity 未獨立確認。完整產品版本仍須主代理部署／首頁整合與外部確認，不標 complete。


後續 UI 驗收全面暫停：所有 browser/native/computer UI 呼叫均禁止，包括 hidden IAB、導航、截圖、輸入及 viewport；僅背景 CLI／檔案可繼續。不能以 hidden 推定不影響焦點。後續 UI 項目為 NOT_RUN_USER_FOCUS_INCIDENT，等待主代理重新明確放行。既有歷史實測保留，不關閉既有視窗、分頁或程序。

