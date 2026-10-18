# 隱私與安全邊界

全部使用者文字、數值與報告只保留本頁 memory。不傳網路、不寫 localStorage/sessionStorage/IndexedDB/Cache/Service Worker/cookie/URL/console。沒有 analytics/beacon/remote font/外部 CDN。頁面初載必要 static asset GET 不等於上傳；不能承諾完全無網路。pagehide 清全部輸入/結果/async state/ObjectURL；persisted pageshow 不恢復草稿。瀏覽器原生歷史、剪貼簿與下載檔由使用者/瀏覽器管理，不能聲稱已刪除它們。

只以 textContent/value 呈現不可信內容；不使用 innerHTML/eval/Function。validate exact schema、長度與大小，拒絕未知欄位/accessor/symbol，錯誤不echo原文。不在 audit/log 寫使用者資料。copy/download 只明確手勢；剪貼簿拒絕提供手動選取報告，不偽稱成功。copy 不能讀使用者原有 clipboard；驗收只可用自己寫入的假資料。

CSP 嚴格 self 資產，default-src 'none'、connect-src 'none'、object-src 'none'、base-uri 'none'、frame-ancestors 'none'、form-action 'none'，script-src self 及僅必要 JSON-LD 精確hash；不 unsafe-inline/eval、不為分析錯誤放寬。X-Content-Type-Options nosniff、Referrer-Policy no-referrer、Permissions-Policy 關閉不需能力。不要禁用本工具需用的 clipboard-write。正式 response 與本機模型各別驗。

完整 Network/Storage 需觀察載入、輸入、結果、copy/download、隱藏/恢復，含同源 /cdn-cgi/rum；只靜態檢查/沒外站不等於已證明零遙測。無該工具能力時 NOT_RUN。主代理管理共用 Cloudflare 設定，不由原功能對話更動。
